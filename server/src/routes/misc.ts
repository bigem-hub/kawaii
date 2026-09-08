import { Router, Request, Response } from "express";
import {
  getAt,
  findOne,
  findMany,
  findAll,
} from "../db/firebaseClient.js";
import { authMiddleware } from "../auth/middleware.js";

const router = Router();

// TEMP DIAGNOSTIC — remove after debugging (before auth middleware)
router.get("/diag", async (_req: Request, res: Response) => {
  try {
    const hasSa = !!process.env.FIREBASE_SERVICE_ACCOUNT;
    const hasDb = !!process.env.FIREBASE_DATABASE_URL;
    let saLen = 0;
    let saProject: string | null = null;
    if (hasSa) {
      try {
        const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT as string);
        saLen = (process.env.FIREBASE_SERVICE_ACCOUNT as string).length;
        saProject = parsed.project_id;
      } catch (e: any) {
        return res.json({ hasSa, hasDb, saParseError: e.message, saLen });
      }
    }
    let dbStatus = "not-tried";
    try {
      const { getDB } = await import("../firebase.js");
      getDB();
      dbStatus = "ok";
    } catch (e: any) {
      dbStatus = "ERROR: " + (e.message || String(e));
    }
    res.json({ hasSa, hasDb, saLen, saProject, dbStatus, nodeEnv: process.env.NODE_ENV });
  } catch (e: any) {
    res.status(500).json({ diagError: e.message || String(e) });
  }
});

router.use(authMiddleware);

// GET /api/users/:username - public profile
router.get("/users/:username", async (req: Request, res: Response) => {
  try {
    const user = await findOne("users", "username", String(req.params.username));
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Public stats (load user-scoped data)
    const userTasks = await findMany("tasks", "userId", user.id);
    const userNotes = await findMany("notes", "userId", user.id);
    const userWorkouts = await findMany("workoutSessions", "userId", user.id);

    res.json({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar ?? null,
      bio: user.bio ?? "",
      online: user.online ?? false,
      lastSeen: user.lastSeen ?? 0,
      createdAt: user.createdAt,
      xp: user.xp ?? 0,
      level: user.level ?? 1,
      streak: user.streak ?? 0,
      stats: {
        tasksCompleted: userTasks.filter((t: any) => t.completed).length,
        notesCreated: userNotes.length,
        workouts: userWorkouts.length,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/search?q=&type=
router.get("/search", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { q, type } = req.query;
    const query = typeof q === "string" ? q.toLowerCase() : "";
    const types = type && type !== "all" ? String(type).split(",") : null;

    const result: Record<string, any> = {};

    if (!types || types.includes("tasks")) {
      const allTasks = await findMany("tasks", "userId", userId);
      result.tasks = allTasks
        .filter(
          (t: any) =>
            t.title.toLowerCase().includes(query) ||
            (t.description ?? "").toLowerCase().includes(query)
        )
        .slice(0, 10);
    }

    if (!types || types.includes("notes")) {
      const allNotes = await findMany("notes", "userId", userId);
      result.notes = allNotes
        .filter(
          (n: any) =>
            (n.title ?? "").toLowerCase().includes(query) ||
            (n.contentText ?? "").toLowerCase().includes(query)
        )
        .slice(0, 10);
    }

    if (!types || types.includes("users")) {
      const allUsers = await findAll("users");
      result.users = allUsers
        .filter(
          (u: any) =>
            u.id !== userId &&
            ((u.username ?? "").toLowerCase().includes(query) ||
              (u.displayName ?? "").toLowerCase().includes(query))
        )
        .map((u: any) => ({
          id: u.id,
          username: u.username,
          displayName: u.displayName,
          avatar: u.avatar ?? null,
        }))
        .slice(0, 10);
    }

    if (!types || types.includes("cardio")) {
      const allCardio = await findMany("cardioEntries", "userId", userId);
      result.cardio = allCardio
        .filter((c: any) => (c.type ?? "").includes(query))
        .slice(0, 10);
    }

    if (!types || types.includes("events")) {
      const allEvents = await findMany("events", "userId", userId);
      result.events = allEvents
        .filter((e: any) => (e.title ?? "").toLowerCase().includes(query))
        .slice(0, 10);
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

// GET /api/dashboard - aggregated dashboard data
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const allTasks = await findMany("tasks", "userId", userId);
    const todayTasks = allTasks
      .filter(
        (t: any) =>
          !t.completed &&
          t.dueDate &&
          t.dueDate >= today.getTime() &&
          t.dueDate <= todayEnd.getTime()
      );
    const completed = allTasks.filter((t: any) => t.completed);
    const completedToday = completed.filter(
      (t: any) => t.completedAt && t.completedAt >= today.getTime()
    );

    const userSnap = await getAt(`users/${userId}`);

    // Upcoming events
    const allEvents = await findMany("events", "userId", userId);
    const upcomingEvents = allEvents
      .filter((e: any) => e.start >= now)
      .sort((a: any, b: any) => a.start - b.start)
      .slice(0, 5);

    // Quick notes (most recent non-archived)
    const allNotes = await findMany("notes", "userId", userId);
    const quickNotes = allNotes
      .filter((n: any) => !n.archived)
      .sort((a: any, b: any) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, 3);

    // Recent cardio
    const cardio = await findMany("cardioEntries", "userId", userId);
    const recentCardio = cardio.slice(-7);

    // Workouts count
    const workouts = await findMany("workoutSessions", "userId", userId);

    res.json({
      greeting: getGreeting(),
      date: new Date().toLocaleDateString(),
      todayTasks,
      taskStats: {
        total: allTasks.length,
        completed: completed.length,
        pending: allTasks.length - completed.length,
        completedToday: completedToday.length,
        percentage: allTasks.length
          ? Math.round((completed.length / allTasks.length) * 100)
          : 0,
      },
      upcomingEvents: upcomingEvents.map((e: any) => ({
        ...e,
        startTime: e.start,
        endTime: e.end || e.start + 3600000,
      })),
      quickNotes,
      fitness: { cardioCount: recentCardio.length, workouts: workouts.length },
      user: {
        id: userId,
        username: userSnap?.username || req.user?.username || "user",
        displayName: userSnap?.displayName || userSnap?.display_name || req.user?.username || "User",
        avatar: userSnap?.avatar ?? null,
        streak: userSnap?.streak || 0,
        level: userSnap?.level || 1,
        xp: userSnap?.xp || 0,
        online: !!(userSnap?.online),
        createdAt: userSnap?.createdAt || Date.now(),
      },
      motivation: getMotivation(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

function getMotivation(): string {
  const messages = [
    "Small steps every day lead to big results ✨",
    "You're doing better than you think! 🌟",
    "Progress, not perfection 💖",
    "One task at a time — you've got this! 🌸",
    "Today is a fresh start 🌈",
    "Be kind to yourself while you build 💫",
    "Consistency beats intensity 🎯",
    "Your future self says thank you 💌",
  ];
  const day = new Date().getDate();
  return messages[day % messages.length];
}

export default router;