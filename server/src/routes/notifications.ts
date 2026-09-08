import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import {
  getAt,
  setAt,
  setRow,
  updateAt,
  updateRow,
  findMany,
  findOne,
  findAll,
  getById,
  hydrate,
} from "../db/firebaseClient.js";
import { authMiddleware } from "../auth/middleware.js";
import { getIO } from "../realtime/index.js";

const router = Router();
router.use(authMiddleware);

// Helper to create a notification (shared with realtime)
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body = "",
  data: Record<string, any> = {}
) {
  const id = uuid();
  await setRow("notifications", id, {
    userId,
    type,
    title,
    body,
    data: JSON.stringify(data),
    createdAt: Date.now(),
  });
  // Emit realtime
  const io = getIO();
  io.to(`user:${userId}`).emit("notification", { id, type, title, body, data });
  return id;
}

// GET /api/notifications
router.get("/", async (req: Request, res: Response) => {
  try {
    const rows = (await findMany("notifications", "userId", req.user!.id))
      .map((n) => hydrate("notifications", n))
      .sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 50);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// GET /api/notifications/unread-count
router.get("/unread-count", async (req: Request, res: Response) => {
  try {
    const rows = await findMany("notifications", "userId", req.user!.id);
    const unread = rows.filter((n: any) => !n.read);
    res.json({ count: unread.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/notifications/read-all
router.post("/read-all", async (req: Request, res: Response) => {
  try {
    const rows = await findMany("notifications", "userId", req.user!.id);
    for (const n of rows) {
      await updateAt(`notifications/${n.id}`, { read: true });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    await updateRow("notifications", String(req.params.id), { read: true });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// ============ GAMIFICATION ============
export async function awardXp(userId: string, amount: number) {
  const user = await getById("users", userId);
  if (!user) return;
  const xp = (user.xp || 0) + amount;
  const level = Math.floor(xp / 100) + 1;
  const currentLevel = user.level ?? 1;
  await updateRow("users", userId, {
    xp,
    level: level > currentLevel ? level : currentLevel,
  });
  if (level > currentLevel) {
    await createNotification(
      userId,
      "system",
      `Level up! 🎉`,
      `You reached level ${level}!`,
      { level }
    );
  }
}

export async function awardAchievement(userId: string, code: string) {
  const achievement = await findOne("achievements", "code", code);
  if (!achievement) return;

  const userAchievements = await findMany("userAchievements", "userId", userId);
  const existing = userAchievements.find(
    (e: any) => e.achievementId === achievement.id
  );
  if (existing) return;

  await setRow("userAchievements", uuid(), {
    userId,
    achievementId: achievement.id,
    earnedAt: Date.now(),
  });
  await awardXp(userId, 25);
  await createNotification(
    userId,
    "system",
    `Achievement unlocked: ${achievement.name}! 🏆`,
    achievement.description,
    {}
  );
}

// GET /api/notifications/achievements
router.get("/achievements", async (req: Request, res: Response) => {
  try {
    const all = await findAll("achievements");
    const earned = await findMany("userAchievements", "userId", req.user!.id);

    const earnedIds = new Set(earned.map((e: any) => e.achievementId));
    const fitness = await findMany("fitnessEntries", "userId", req.user!.id);
    const workouts = await findMany("workoutSessions", "userId", req.user!.id);
    const user = await getById("users", req.user!.id);
    const dailyStepsGoal = Number(user?.profile?.fitnessGoals?.dailySteps) || 10000;
    const today = new Date().toISOString().slice(0, 10);
    const todaySteps = fitness.find((entry: any) => entry.date === today)?.steps || 0;
    const progress: Record<string, { current: number; target: number }> = {
      first_workout: { current: workouts.length, target: 1 },
      "10_workouts": { current: workouts.length, target: 10 },
      "10k_steps": { current: todaySteps, target: dailyStepsGoal },
      "100_tasks": { current: 0, target: 100 },
    };
    res.json(
      all.map((a: any) => ({
          ...hydrate("achievements", a),
          earned: earnedIds.has(a.id),
          earnedAt: earned.find((e: any) => e.achievementId === a.id)?.earnedAt,
          progress: progress[a.code] || null,
        }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

export async function checkTaskAchievements(userId: string) {
  const userTasks = await findMany("tasks", "userId", userId);
  const completedCount = userTasks.filter((t: any) => t.completed).length;
  if (completedCount >= 1) await awardAchievement(userId, "first_task");
  if (completedCount >= 100) await awardAchievement(userId, "100_tasks");

  const userNotes = await findMany("notes", "userId", userId);
  if (userNotes.length >= 50) await awardAchievement(userId, "note_master");
}

export async function checkFitnessAchievements(userId: string) {
  const fitness = await findMany("fitnessEntries", "userId", userId);
  const cardio = await findMany("cardioEntries", "userId", userId);
  const workouts = await findMany("workoutSessions", "userId", userId);
  const totalSteps = fitness.reduce((sum: number, entry: any) => sum + (entry.steps || 0), 0);
  const totalWorkouts = workouts.length;
  const totalCardio = cardio.length;
  const user = await getById("users", userId);
  const dailyStepsGoal = Number(user?.profile?.fitnessGoals?.dailySteps) || 10000;
  const today = new Date().toISOString().slice(0, 10);
  const todaySteps = fitness.find((entry: any) => entry.date === today)?.steps || 0;

  if (todaySteps >= dailyStepsGoal) await awardAchievement(userId, "10k_steps");
  if (totalWorkouts >= 1) await awardAchievement(userId, "first_workout");
  if (totalWorkouts >= 10) await awardAchievement(userId, "10_workouts");
  if (totalCardio >= 10) await awardAchievement(userId, "10_cardio");
}

export default router;