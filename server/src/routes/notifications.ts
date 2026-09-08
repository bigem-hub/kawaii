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

// ============ SEED ACHIEVEMENTS IN FIREBASE ============
const ACHIEVEMENT_DEFS = [
  { code: "first_task", name: "First Steps", description: "Completed your first task", icon: "✅" },
  { code: "7_streak", name: "On Fire!", description: "7-day productivity streak", icon: "🔥" },
  { code: "100_tasks", name: "Century", description: "Completed 100 tasks", icon: "💯" },
  { code: "first_workout", name: "Getting Started", description: "Completed your first workout", icon: "💪" },
  { code: "10_workouts", name: "Fitness Fanatic", description: "Completed 10 workouts", icon: "🏋️" },
  { code: "note_master", name: "Note Master", description: "Created 50 notes", icon: "📒" },
  { code: "30_streak", name: "Unstoppable!", description: "30-day productivity streak", icon: "🌟" },
  { code: "social_butterfly", name: "Social Butterfly", description: "Added 5 friends", icon: "🦋" },
  { code: "first_chat", name: "Chatterbox", description: "Sent your first message", icon: "💬" },
  { code: "watch_party", name: "Party Time!", description: "Joined a watch party", icon: "🎬" },
  { code: "early_bird", name: "Early Bird", description: "Completed a task before 8am", icon: "🐦" },
  { code: "night_owl", name: "Night Owl", description: "Completed a task after midnight", icon: "🦉" },
  { code: "10k_steps", name: "Step Champion", description: "Hit 10,000 steps in a day", icon: "👟" },
  { code: "10_cardio", name: "Cardio King", description: "Completed 10 cardio sessions", icon: "🏃" },
];

export async function seedAchievements() {
  const existing = await findAll("achievements");
  const existingCodes = new Set(existing.map((a: any) => a.code));
  for (const ach of ACHIEVEMENT_DEFS) {
    if (!existingCodes.has(ach.code)) {
      await setRow("achievements", `ach_${ach.code}`, ach);
    }
  }
}

// ============ STREAK ============
export async function updateStreak(userId: string) {
  const user = await getById("users", userId);
  if (!user) return;

  const today = new Date().toISOString().slice(0, 10);
  const lastDate = user.lastActivityDate;

  // Already counted today
  if (lastDate === today) return;

  let newStreak = user.streak || 0;
  let longestStreak = user.longestStreak || 0;

  if (lastDate) {
    const last = new Date(lastDate);
    const now = new Date(today);
    const diffDays = Math.floor((now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays === 1) {
      // Consecutive day — extend streak
      newStreak += 1;
    } else if (diffDays > 1) {
      // Streak broken
      newStreak = 1;
    }
    // diffDays === 0 already handled above
  } else {
    // First activity ever
    newStreak = 1;
  }

  if (newStreak > longestStreak) {
    longestStreak = newStreak;
  }

  await updateRow("users", userId, {
    streak: newStreak,
    longestStreak,
    lastActivityDate: today,
  });

  // Check streak achievements
  if (newStreak >= 7) await awardAchievement(userId, "7_streak");
  if (newStreak >= 30) await awardAchievement(userId, "30_streak");
}

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
  await seedAchievements();
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
    await seedAchievements();
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