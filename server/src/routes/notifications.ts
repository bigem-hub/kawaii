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
  // Emit realtime — null-safe no-op on serverless where Socket.IO isn't
  // initialized; the notification is already persisted and served via REST.
  getIO()?.to(`user:${userId}`).emit("notification", { id, type, title, body, data });
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
  // --- Tasks ---
  { code: "first_task", name: "First Steps", description: "Complete your first task", icon: "✅" },
  { code: "25_tasks", name: "Getting Busy", description: "Complete 25 tasks", icon: "⚡" },
  { code: "50_tasks", name: "Hustler", description: "Complete 50 tasks", icon: "📈" },
  { code: "100_tasks", name: "Century", description: "Complete 100 tasks", icon: "💯" },
  { code: "250_tasks", name: "Task Titan", description: "Complete 250 tasks", icon: "🤖" },
  { code: "500_tasks", name: "Absolute Legend", description: "Complete 500 tasks", icon: "👑" },
  // --- Notes ---
  { code: "note_10", name: "Noted", description: "Create 10 notes", icon: "📝" },
  { code: "note_master", name: "Note Master", description: "Create 50 notes", icon: "📒" },
  // --- Streaks ---
  { code: "7_streak", name: "On Fire!", description: "Keep a 7-day productivity streak", icon: "🔥" },
  { code: "14_streak", name: "Fortnight", description: "Keep a 14-day productivity streak", icon: "📅" },
  { code: "30_streak", name: "Unstoppable!", description: "Keep a 30-day productivity streak", icon: "🌟" },
  // --- Fitness ---
  { code: "first_workout", name: "Getting Started", description: "Log your first workout", icon: "💪" },
  { code: "10_workouts", name: "Fitness Fanatic", description: "Complete 10 workouts", icon: "🏋️" },
  { code: "50_workouts", name: "Gym Rat", description: "Complete 50 workouts", icon: "🏆" },
  { code: "10_cardio", name: "Cardio King", description: "Complete 10 cardio sessions", icon: "🏃" },
  { code: "10k_steps", name: "Step Champion", description: "Walk 10,000 steps in one day", icon: "👟" },
  { code: "100k_steps", name: "Marathoner", description: "Walk 100,000 steps in total", icon: "🌍" },
  // --- Social ---
  { code: "first_friend", name: "Buddy Up", description: "Add your first friend", icon: "🤝" },
  { code: "social_butterfly", name: "Social Butterfly", description: "Add 5 friends", icon: "🦋" },
  { code: "first_chat", name: "Chatterbox", description: "Send your first message", icon: "💬" },
  { code: "chat_50", name: "Conversationalist", description: "Send 50 messages", icon: "🗣️" },
  // --- Watch Together ---
  { code: "watch_party", name: "Party Time!", description: "Join a watch party", icon: "🎬" },
  { code: "watch_host", name: "Show Host", description: "Create a watch party room", icon: "🎥" },
  // --- Schedule / Study ---
  { code: "hw_10", name: "Diligent", description: "Complete 10 homework assignments", icon: "📚" },
  { code: "study_buddy", name: "Study Buddy", description: "Create a Virtual Study Room", icon: "🎓" },
  // --- Special ---
  { code: "early_bird", name: "Early Bird", description: "Complete a task before 8 AM", icon: "🐦" },
  { code: "night_owl", name: "Night Owl", description: "Complete a task after midnight", icon: "🦉" },
];

/**
 * Upsert the achievement catalog. Deterministic ids (`ach_<code>`) so
 * re-running updates descriptions/icons for existing codes and adds new ones.
 */
export async function seedAchievements() {
  for (const ach of ACHIEVEMENT_DEFS) {
    await setRow("achievements", `ach_${ach.code}`, ach);
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
  if (newStreak >= 14) await awardAchievement(userId, "14_streak");
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
      `Level up!`,
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
    `Achievement unlocked: ${achievement.name}!`,
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
    const uid = req.user!.id;
    const user = await getById("users", uid);
    const dailyStepsGoal = Number(user?.profile?.fitnessGoals?.dailySteps) || 10000;

    // Counts used to show live progress toward every trinket/tier achievement.
    const tasks = await findMany("tasks", "userId", uid);
    const completedTasks = tasks.filter((t: any) => t.completed).length;
    const notes = await findMany("notes", "userId", uid);
    const fitness = await findMany("fitnessEntries", "userId", uid);
    const workouts = await findMany("workoutSessions", "userId", uid);
    const cardio = await findMany("cardioEntries", "userId", uid);
    const today = new Date().toISOString().slice(0, 10);
    const todaySteps = fitness.find((entry: any) => entry.date === today)?.steps || 0;
    const totalSteps = fitness.reduce((sum: number, e: any) => sum + (e.steps || 0), 0);
    const friends = Object.keys((await getAt(`friendships/${uid}`)) ?? {}).length;
    const messages = await findMany("messages", "senderId", uid);
    const watchMembers = await findMany("watchRoomMembers", "userId", uid);
    const watchRooms = await findMany("watchRooms", "hostId", uid);
    const homework = await findMany("schedule_homework", "userId", uid);
    const completedHw = homework.filter((h: any) => h.status === "completed").length;
    const studyRooms = await findMany("studyRooms", "hostId", uid);
    const earlyBird = tasks.filter(
      (t: any) => t.completed && t.completedAt && new Date(t.completedAt).getHours() < 8
    ).length;
    const nightOwl = tasks.filter(
      (t: any) => t.completed && t.completedAt && new Date(t.completedAt).getHours() < 5
    ).length;

    const progress: Record<string, { current: number; target: number }> = {
      first_task: { current: completedTasks, target: 1 },
      "25_tasks": { current: completedTasks, target: 25 },
      "50_tasks": { current: completedTasks, target: 50 },
      "100_tasks": { current: completedTasks, target: 100 },
      "250_tasks": { current: completedTasks, target: 250 },
      "500_tasks": { current: completedTasks, target: 500 },
      note_10: { current: notes.length, target: 10 },
      note_master: { current: notes.length, target: 50 },
      "7_streak": { current: user?.streak || 0, target: 7 },
      "14_streak": { current: user?.streak || 0, target: 14 },
      "30_streak": { current: user?.streak || 0, target: 30 },
      first_workout: { current: workouts.length, target: 1 },
      "10_workouts": { current: workouts.length, target: 10 },
      "50_workouts": { current: workouts.length, target: 50 },
      "10_cardio": { current: cardio.length, target: 10 },
      "10k_steps": { current: todaySteps, target: dailyStepsGoal },
      "100k_steps": { current: totalSteps, target: 100000 },
      first_friend: { current: friends, target: 1 },
      social_butterfly: { current: friends, target: 5 },
      first_chat: { current: messages.length, target: 1 },
      chat_50: { current: messages.length, target: 50 },
      watch_party: { current: watchMembers.length, target: 1 },
      watch_host: { current: watchRooms.length, target: 1 },
      hw_10: { current: completedHw, target: 10 },
      study_buddy: { current: studyRooms.length, target: 1 },
      early_bird: { current: earlyBird, target: 1 },
      night_owl: { current: nightOwl, target: 1 },
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
  if (completedCount >= 25) await awardAchievement(userId, "25_tasks");
  if (completedCount >= 50) await awardAchievement(userId, "50_tasks");
  if (completedCount >= 100) await awardAchievement(userId, "100_tasks");
  if (completedCount >= 250) await awardAchievement(userId, "250_tasks");
  if (completedCount >= 500) await awardAchievement(userId, "500_tasks");

  // Early Bird / Night Owl are time-based; count tasks completed in those windows.
  const earlyBird = userTasks.filter(
    (t: any) => t.completed && t.completedAt && new Date(t.completedAt).getHours() < 8
  ).length;
  if (earlyBird >= 1) await awardAchievement(userId, "early_bird");
  const nightOwl = userTasks.filter(
    (t: any) => t.completed && t.completedAt && new Date(t.completedAt).getHours() < 5
  ).length;
  if (nightOwl >= 1) await awardAchievement(userId, "night_owl");

  const userNotes = await findMany("notes", "userId", userId);
  if (userNotes.length >= 10) await awardAchievement(userId, "note_10");
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
  if (totalSteps >= 100000) await awardAchievement(userId, "100k_steps");
  if (totalWorkouts >= 1) await awardAchievement(userId, "first_workout");
  if (totalWorkouts >= 10) await awardAchievement(userId, "10_workouts");
  if (totalWorkouts >= 50) await awardAchievement(userId, "50_workouts");
  if (totalCardio >= 10) await awardAchievement(userId, "10_cardio");
}

// ============ SOCIAL / SCHEDULE / STUDY ACHIEVEMENTS ============

export async function checkFriendAchievements(userId: string) {
  const friends = Object.keys((await getAt(`friendships/${userId}`)) ?? {});
  if (friends.length >= 1) await awardAchievement(userId, "first_friend");
  if (friends.length >= 5) await awardAchievement(userId, "social_butterfly");
}

export async function checkChatAchievements(userId: string) {
  const messages = await findMany("messages", "senderId", userId);
  if (messages.length >= 1) await awardAchievement(userId, "first_chat");
  if (messages.length >= 50) await awardAchievement(userId, "chat_50");
}

export async function checkWatchAchievements(userId: string) {
  const memberships = await findMany("watchRoomMembers", "userId", userId);
  if (memberships.length >= 1) await awardAchievement(userId, "watch_party");
  const rooms = await findMany("watchRooms", "hostId", userId);
  if (rooms.length >= 1) await awardAchievement(userId, "watch_host");
}

export async function checkHomeworkAchievements(userId: string) {
  const homework = await findMany("schedule_homework", "userId", userId);
  const completed = homework.filter((h: any) => h.status === "completed").length;
  if (completed >= 10) await awardAchievement(userId, "hw_10");
}

export async function checkStudyAchievements(userId: string) {
  const rooms = await findMany("studyRooms", "hostId", userId);
  if (rooms.length >= 1) await awardAchievement(userId, "study_buddy");
}

export default router;