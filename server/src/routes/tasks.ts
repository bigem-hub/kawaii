import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import {
  getAt,
  setAt,
  setRow,
  updateAt,
  updateRow,
  removeRow,
  findMany,
  getNested,
  hydrate,
} from "../db/firebaseClient.js";
import { authMiddleware } from "../auth/middleware.js";
import { updateStreak, checkTaskAchievements } from "./notifications.js";

const router = Router();
router.use(authMiddleware);

// GET /api/tasks - list tasks with optional filters
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status, category, priority, search, view } = req.query;

    // Load all the user's tasks, then JS-filter (mirrors the SQLite behavior)
    let results: any[] = (await findMany("tasks", "userId", userId)).map((t) =>
      hydrate("tasks", t)
    );

    if (status === "completed") results = results.filter((t) => t.completed);
    else if (status === "active") results = results.filter((t) => !t.completed);

    if (category && category !== "all")
      results = results.filter((t) => t.categoryId === category);
    if (priority && priority !== "none")
      results = results.filter((t) => t.priority === priority);

    if (view === "overdue") {
      results = results.filter(
        (t) => !t.completed && t.dueDate && t.dueDate <= Date.now()
      );
    }

    // Sort by sortOrder asc, then dueDate asc (matches original SQL ORDER BY)
    results.sort((a: any, b: any) => {
      if ((a.sortOrder ?? 0) !== (b.sortOrder ?? 0))
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      return (a.dueDate ?? 0) - (b.dueDate ?? 0);
    });

    // Attach subtasks
    const taskMap: any[] = [];
    for (const task of results) {
      const subs = await getNested(`tasks/${task.id}/subtasks`, { taskId: task.id });
      taskMap.push({ ...task, subtasks: subs.map((s) => hydrate("subtasks", s)) });
    }

    // Simple search filter
    let filtered = taskMap;
    if (search && typeof search === "string") {
      const q = search.toLowerCase();
      filtered = taskMap.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q)
      );
    }

    // Filter for "today" view
    if (view === "today") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (t) =>
          t.dueDate &&
          t.dueDate >= todayStart.getTime() &&
          t.dueDate <= todayEnd.getTime()
      );
    }

    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// GET /api/tasks/stats
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const allTasks = (await findMany("tasks", "userId", userId)).map((t) =>
      hydrate("tasks", t)
    );

    const completed = allTasks.filter((t) => t.completed);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const completedToday = completed.filter(
      (t) => t.completedAt && t.completedAt >= today.getTime()
    );

    // Weekly stats
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const completedThisWeek = completed.filter(
      (t) => t.completedAt && t.completedAt >= weekAgo
    );

    // Streak calculation
    let streak = 0;
    let checkDate = new Date();
    checkDate.setHours(0, 0, 0, 0);
    while (true) {
      const dayStart = checkDate.getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const dayCompleted = completed.some(
        (t) => t.completedAt && t.completedAt >= dayStart && t.completedAt < dayEnd
      );
      if (!dayCompleted) break;
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    res.json({
      total: allTasks.length,
      completed: completed.length,
      pending: allTasks.length - completed.length,
      completedToday: completedToday.length,
      completedThisWeek: completedThisWeek.length,
      weeklyRate:
        allTasks.length > 0
          ? Math.round((completedThisWeek.length / Math.max(allTasks.length, 1)) * 100)
          : 0,
      streak,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// POST /api/tasks
router.post("/", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    const now = Date.now();
    const {
      title,
      description,
      notes,
      categoryId,
      priority,
      dueDate,
      startDate,
      tags,
      recurring,
      reminderAt,
      sortOrder,
    } = req.body;

    if (!title?.trim()) {
      res.status(400).json({ error: "Title is required" });
      return;
    }

    await setRow("tasks", id, {
      userId: req.user!.id,
      title: title.trim(),
      description: description || "",
      notes: notes || "",
      categoryId: categoryId || null,
      priority: priority || "none",
      dueDate: dueDate || null,
      startDate: startDate || null,
      tags: tags ? JSON.stringify(tags) : "[]",
      recurring: recurring || "none",
      reminderAt: reminderAt || null,
      sortOrder: sortOrder || 0,
      createdAt: now,
      updatedAt: now,
    });

    const task = await getAt(`tasks/${id}`);
    res.status(201).json({ ...hydrate("tasks", { id, ...task }), subtasks: [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// PATCH /api/tasks/:id
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const taskSnap = await getAt(`tasks/${id}`);
    if (!taskSnap || taskSnap.userId !== req.user!.id) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    const task = hydrate("tasks", { id, ...taskSnap });

    const updates: Record<string, any> = { updatedAt: Date.now() };
    const allowed = [
      "title",
      "description",
      "notes",
      "categoryId",
      "priority",
      "status",
      "dueDate",
      "startDate",
      "tags",
      "recurring",
      "reminderAt",
      "sortOrder",
      "completed",
    ];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = key === "tags" ? JSON.stringify(req.body[key]) : req.body[key];
      }
    }

    // Handle completion
    if (updates.completed === true && !task.completed) {
      updates.completedAt = Date.now();
      updates.status = "completed";
      
      // Award XP for completing task
      const userSnap = await getAt(`users/${req.user!.id}`);
      if (userSnap) {
        const currentXp = userSnap.xp || 0;
        const currentLevel = userSnap.level || 1;
        const xpGain = 10; // Base XP per task
        const newXp = currentXp + xpGain;
        const newLevel = Math.floor(newXp / 100) + 1;

        await updateRow("users", req.user!.id, {
          xp: newXp,
          level: newLevel,
        });
      }

      // Update streak and check achievements
      await updateStreak(req.user!.id);
      await checkTaskAchievements(req.user!.id);
    } else if (updates.completed === false && task.completed) {
      updates.completedAt = null;
      updates.status = "pending";
    }

    // Strip nulls for Firebase update (null = delete key). Hydration restores them.
    for (const k of Object.keys(updates)) {
      if (updates[k] === null) {
        delete updates[k];
        await setAt(`tasks/${id}/${k}`, null);
      }
    }
    await updateRow("tasks", id, updates);

    const updatedSnap = await getAt(`tasks/${id}`);
    const updated = hydrate("tasks", { id, ...updatedSnap });
    const taskSubtasks = (
      await getNested(`tasks/${id}/subtasks`, { taskId: id })
    ).map((s) => hydrate("subtasks", s));

    // Return updated user info if task was completed
    let userInfo = null;
    if (updates.completed === true && !task.completed) {
      const userSnap = await getAt(`users/${req.user!.id}`);
      if (userSnap) {
        userInfo = {
          xp: userSnap.xp || 0,
          level: userSnap.level || 1,
        };
      }
    }

    res.json({ ...updated, subtasks: taskSubtasks, userInfo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update task" });
  }
});

// DELETE /api/tasks/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const taskSnap = await getAt(`tasks/${id}`);
    if (!taskSnap || taskSnap.userId !== req.user!.id) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    // Cascade: delete subtasks + task
    await setAt(`tasks/${id}`, null);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// POST /api/tasks/:id/subtasks
router.post("/:id/subtasks", async (req: Request, res: Response) => {
  try {
    const taskId = String(req.params.id);
    const taskSnap = await getAt(`tasks/${taskId}`);
    if (!taskSnap || taskSnap.userId !== req.user!.id) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    const subtask = await getNested(`tasks/${taskId}/subtasks`, { taskId });

    const id = uuid();
    await setAt(`tasks/${taskId}/subtasks/${id}`, {
      title: req.body.title || "Subtask",
      sortOrder: subtask.length,
      createdAt: Date.now(),
    });

    const newSubtask = await getAt(`tasks/${taskId}/subtasks/${id}`);
    res.status(201).json({ id, taskId, title: req.body.title || "Subtask", completed: false, sortOrder: subtask.length, createdAt: newSubtask?.createdAt ?? Date.now() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create subtask" });
  }
});

// PATCH /api/tasks/:id/subtasks/:subId
router.patch("/:id/subtasks/:subId", async (req: Request, res: Response) => {
  try {
    const taskId = String(req.params.id);
    const subId = String(req.params.subId);
    const { title, completed } = req.body;

    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title;
    if (completed !== undefined) updates.completed = completed;

    if (Object.keys(updates).length > 0) {
      await updateAt(`tasks/${taskId}/subtasks/${subId}`, updates);
    }
    const subSnap = await getAt(`tasks/${taskId}/subtasks/${subId}`);
    res.json({ id: subId, taskId, ...(subSnap ?? {}) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update subtask" });
  }
});

// DELETE /api/tasks/:id/subtasks/:subId
router.delete("/:id/subtasks/:subId", async (req: Request, res: Response) => {
  try {
    await setAt(`tasks/${req.params.id}/subtasks/${req.params.subId}`, null);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete subtask" });
  }
});

// Category CRUD
router.get("/categories", async (_req: Request, res: Response) => {
  try {
    const userCategories = (await findMany("categories", "userId", _req.user!.id))
      .map((c) => hydrate("categories", c))
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    res.json(userCategories);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/categories", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    await setRow("categories", id, {
      userId: req.user!.id,
      name: req.body.name || "New Category",
      color: req.body.color || "#FF8FAB",
      icon: req.body.icon || "📁",
      createdAt: Date.now(),
    });
    const cat = await getAt(`categories/${id}`);
    res.status(201).json(hydrate("categories", { id, ...cat }));
  } catch (err) {
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.patch("/categories/:id", async (req: Request, res: Response) => {
  try {
    const catId = String(req.params.id);
    const updates: Record<string, any> = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.color) updates.color = req.body.color;
    if (req.body.icon) updates.icon = req.body.icon;

    await updateRow("categories", catId, updates);
    const cat = await getAt(`categories/${catId}`);
    res.json(hydrate("categories", { id: catId, ...cat }));
  } catch (err) {
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/categories/:id", async (req: Request, res: Response) => {
  try {
    await removeRow("categories", String(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete category" });
  }
});

export default router;