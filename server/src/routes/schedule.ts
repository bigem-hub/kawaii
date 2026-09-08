import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import {
  setRow,
  updateRow,
  removeRow,
  findMany,
  findOne,
  getById,
  hydrate,
  getAt,
  setAt,
} from "../db/firebaseClient.js";
import { authMiddleware } from "../auth/middleware.js";
import { awardXp } from "./notifications.js";

const router = Router();
router.use(authMiddleware);

// ============ SUBJECTS ============

// GET /api/schedule/subjects
router.get("/subjects", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const rows = (await findMany("subjects", "userId", userId)).map((s) =>
      hydrate("subjects", s)
    );
    rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
});

// POST /api/schedule/subjects
router.post("/subjects", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    const { name, shortName, teacher, room, color, icon } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ error: "Subject name is required" });
      return;
    }
    await setRow("subjects", id, {
      userId: req.user!.id,
      name: name.trim(),
      shortName: shortName?.trim() || null,
      teacher: teacher?.trim() || null,
      room: room?.trim() || null,
      color: color || "#FF8FAB",
      icon: icon || "BookOpen",
      createdAt: Date.now(),
    });
    const subject = await getById("subjects", id);
    res.status(201).json(hydrate("subjects", { id, ...subject }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create subject" });
  }
});

// PATCH /api/schedule/subjects/:id
router.patch("/subjects/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const subjectSnap = await getAt(`subjects/${id}`);
    if (!subjectSnap || subjectSnap.userId !== req.user!.id) {
      res.status(404).json({ error: "Subject not found" });
      return;
    }
    const updates: Record<string, any> = {};
    const allowed = ["name", "shortName", "teacher", "room", "color", "icon"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    await updateRow("subjects", id, updates);
    const updatedSnap = await getAt(`subjects/${id}`);
    res.json(hydrate("subjects", { id, ...updatedSnap }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update subject" });
  }
});

// DELETE /api/schedule/subjects/:id
router.delete("/subjects/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const subjectSnap = await getAt(`subjects/${id}`);
    if (!subjectSnap || subjectSnap.userId !== req.user!.id) {
      res.status(404).json({ error: "Subject not found" });
      return;
    }
    await removeRow("subjects", id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete subject" });
  }
});

// ============ COLLEGE CLASSES ============

// GET /api/schedule/classes
router.get("/classes", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { day, active } = req.query;
    let rows = (await findMany("schedule_classes", "userId", userId)).map((c) =>
      hydrate("schedule_classes", c)
    );
    if (day !== undefined) {
      rows = rows.filter((c) => c.day === Number(day));
    }
    if (active === "true") {
      rows = rows.filter((c) => c.isActive);
    }
    rows.sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.startTime.localeCompare(b.startTime);
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch classes" });
  }
});

// POST /api/schedule/classes
router.post("/classes", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    const {
      subjectId,
      title,
      teacher,
      room,
      day,
      startTime,
      endTime,
      notes,
      color,
    } = req.body;

    if (!title?.trim() || day === undefined || !startTime || !endTime) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    await setRow("schedule_classes", id, {
      userId: req.user!.id,
      subjectId: subjectId || null,
      title: title.trim(),
      teacher: teacher?.trim() || null,
      room: room?.trim() || null,
      day: Number(day),
      startTime,
      endTime,
      notes: notes || "",
      color: color || "#FF8FAB",
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const cls = await getById("schedule_classes", id);
    res.status(201).json(hydrate("schedule_classes", { id, ...cls }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create class" });
  }
});

// PATCH /api/schedule/classes/:id
router.patch("/classes/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const classSnap = await getAt(`schedule_classes/${id}`);
    if (!classSnap || classSnap.userId !== req.user!.id) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    const updates: Record<string, any> = { updatedAt: Date.now() };
    const allowed = [
      "subjectId",
      "title",
      "teacher",
      "room",
      "day",
      "startTime",
      "endTime",
      "notes",
      "color",
      "isActive",
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    await updateRow("schedule_classes", id, updates);
    const updatedSnap = await getAt(`schedule_classes/${id}`);
    res.json(hydrate("schedule_classes", { id, ...updatedSnap }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update class" });
  }
});

// DELETE /api/schedule/classes/:id
router.delete("/classes/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const classSnap = await getAt(`schedule_classes/${id}`);
    if (!classSnap || classSnap.userId !== req.user!.id) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    await removeRow("schedule_classes", id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete class" });
  }
});

// ============ HOMEWORK ============

// GET /api/schedule/homework
router.get("/homework", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status, from, to, subjectId } = req.query;
    let rows = (await findMany("schedule_homework", "userId", userId)).map((h) =>
      hydrate("schedule_homework", h)
    );
    if (status) rows = rows.filter((h) => h.status === status);
    if (subjectId) rows = rows.filter((h) => h.subjectId === subjectId);
    if (from) rows = rows.filter((h) => h.dueDate >= String(from));
    if (to) rows = rows.filter((h) => h.dueDate <= String(to));
    rows.sort((a, b) => {
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (b.status === "completed" && a.status !== "completed") return -1;
      const dateA = new Date(`${a.dueDate}T${a.dueTime || "23:59"}`).getTime();
      const dateB = new Date(`${b.dueDate}T${b.dueTime || "23:59"}`).getTime();
      return dateA - dateB;
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch homework" });
  }
});

// POST /api/schedule/homework
router.post("/homework", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    const {
      subjectId,
      title,
      description,
      dueDate,
      dueTime,
      priority,
      estimatedMinutes,
      notes,
    } = req.body;

    if (!title?.trim() || !dueDate) {
      res.status(400).json({ error: "Title and due date are required" });
      return;
    }

    await setRow("schedule_homework", id, {
      userId: req.user!.id,
      subjectId: subjectId || null,
      title: title.trim(),
      description: description || "",
      dueDate,
      dueTime: dueTime || null,
      priority: priority || "medium",
      status: "not_started",
      estimatedMinutes: estimatedMinutes || 0,
      notes: notes || "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const hw = await getById("schedule_homework", id);
    res.status(201).json(hydrate("schedule_homework", { id, ...hw }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create homework" });
  }
});

// PATCH /api/schedule/homework/:id
router.patch("/homework/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const hwSnap = await getAt(`schedule_homework/${id}`);
    if (!hwSnap || hwSnap.userId !== req.user!.id) {
      res.status(404).json({ error: "Homework not found" });
      return;
    }
    const wasCompleted = hwSnap.status === "completed";
    const updates: Record<string, any> = { updatedAt: Date.now() };
    const allowed = [
      "subjectId",
      "title",
      "description",
      "dueDate",
      "dueTime",
      "priority",
      "status",
      "estimatedMinutes",
      "notes",
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.status === "completed" && !wasCompleted) {
      updates.completedAt = Date.now();
    } else if (updates.status !== "completed" && wasCompleted) {
      updates.completedAt = null;
    }
    await updateRow("schedule_homework", id, updates);
    const updatedSnap = await getAt(`schedule_homework/${id}`);
    const updated = hydrate("schedule_homework", { id, ...updatedSnap });
    
    // Award XP for completing homework
    if (updated.status === "completed" && !wasCompleted) {
      await awardXp(req.user!.id, 15);
    }
    
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update homework" });
  }
});

// DELETE /api/schedule/homework/:id
router.delete("/homework/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const hwSnap = await getAt(`schedule_homework/${id}`);
    if (!hwSnap || hwSnap.userId !== req.user!.id) {
      res.status(404).json({ error: "Homework not found" });
      return;
    }
    await removeRow("schedule_homework", id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete homework" });
  }
});

// ============ STUDY SESSIONS ============

// GET /api/schedule/study-sessions
router.get("/study-sessions", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status, from, to, subjectId } = req.query;
    let rows = (await findMany("schedule_study_sessions", "userId", userId)).map((s) =>
      hydrate("schedule_study_sessions", s)
    );
    if (status) rows = rows.filter((s) => s.status === status);
    if (subjectId) rows = rows.filter((s) => s.subjectId === subjectId);
    if (from) rows = rows.filter((s) => s.date >= String(from));
    if (to) rows = rows.filter((s) => s.date <= String(to));
    rows.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch study sessions" });
  }
});

// POST /api/schedule/study-sessions
router.post("/study-sessions", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    const {
      subjectId,
      title,
      topic,
      date,
      startTime,
      endTime,
      priority,
      notes,
    } = req.body;

    if (!title?.trim() || !date || !startTime || !endTime) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);
    const durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

    await setRow("schedule_study_sessions", id, {
      userId: req.user!.id,
      subjectId: subjectId || null,
      title: title.trim(),
      topic: topic?.trim() || "",
      date,
      startTime,
      endTime,
      durationMinutes,
      priority: priority || "medium",
      status: "planned",
      notes: notes || "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const session = await getById("schedule_study_sessions", id);
    res.status(201).json(hydrate("schedule_study_sessions", { id, ...session }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create study session" });
  }
});

// PATCH /api/schedule/study-sessions/:id
router.patch("/study-sessions/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const sessionSnap = await getAt(`schedule_study_sessions/${id}`);
    if (!sessionSnap || sessionSnap.userId !== req.user!.id) {
      res.status(404).json({ error: "Study session not found" });
      return;
    }
    const wasCompleted = sessionSnap.status === "completed";
    const updates: Record<string, any> = { updatedAt: Date.now() };
    const allowed = [
      "subjectId",
      "title",
      "topic",
      "date",
      "startTime",
      "endTime",
      "priority",
      "status",
      "notes",
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.startTime && updates.endTime && updates.date) {
      const start = new Date(`${updates.date}T${updates.startTime}`);
      const end = new Date(`${updates.date}T${updates.endTime}`);
      updates.durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    }
    if (updates.status === "completed" && !wasCompleted) {
      updates.completedAt = Date.now();
    } else if (updates.status !== "completed" && wasCompleted) {
      updates.completedAt = null;
    }
    await updateRow("schedule_study_sessions", id, updates);
    const updatedSnap = await getAt(`schedule_study_sessions/${id}`);
    const updated = hydrate("schedule_study_sessions", { id, ...updatedSnap });
    
    // Award XP for completing study session
    if (updated.status === "completed" && !wasCompleted) {
      await awardXp(req.user!.id, 10);
    }
    
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update study session" });
  }
});

// DELETE /api/schedule/study-sessions/:id
router.delete("/study-sessions/:id", async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const sessionSnap = await getAt(`schedule_study_sessions/${id}`);
    if (!sessionSnap || sessionSnap.userId !== req.user!.id) {
      res.status(404).json({ error: "Study session not found" });
      return;
    }
    await removeRow("schedule_study_sessions", id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete study session" });
  }
});

// ============ COMBINED TODAY/UPCOMING ============

// GET /api/schedule/today
router.get("/today", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    const currentDay = new Date().getDay(); // 0=Sunday, 1=Monday, ...

    // Get today's classes
    const classes = (await findMany("schedule_classes", "userId", userId))
      .map((c) => hydrate("schedule_classes", c))
      .filter((c) => c.isActive && c.day === currentDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Get today's homework (due today)
    const homework = (await findMany("schedule_homework", "userId", userId))
      .map((h) => hydrate("schedule_homework", h))
      .filter((h) => h.dueDate === today && h.status !== "completed")
      .sort((a, b) => {
        const timeA = a.dueTime ? new Date(`${a.dueDate}T${a.dueTime}`).getTime() : Infinity;
        const timeB = b.dueTime ? new Date(`${b.dueDate}T${b.dueTime}`).getTime() : Infinity;
        return timeA - timeB;
      });

    // Get today's study sessions
    const studySessions = (await findMany("schedule_study_sessions", "userId", userId))
      .map((s) => hydrate("schedule_study_sessions", s))
      .filter((s) => s.date === today)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Current class
    const currentClass = classes.find((c) => {
      const start = new Date(`${today}T${c.startTime}`).getTime();
      const end = new Date(`${today}T${c.endTime}`).getTime();
      return now >= start && now <= end;
    });

    // Next class
    const nextClass = classes.find((c) => {
      const start = new Date(`${today}T${c.startTime}`).getTime();
      return now < start;
    });

    res.json({
      date: today,
      day: currentDay,
      classes,
      homework,
      studySessions,
      currentClass: currentClass || null,
      nextClass: nextClass || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch today's schedule" });
  }
});

// GET /api/schedule/upcoming
router.get("/upcoming", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const today = new Date().toISOString().slice(0, 10);
    const now = Date.now();
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Upcoming classes (next 7 days)
    const classes = (await findMany("schedule_classes", "userId", userId))
      .map((c) => hydrate("schedule_classes", c))
      .filter((c) => c.isActive);

    // Upcoming homework (due in next 7 days, not completed)
    const homework = (await findMany("schedule_homework", "userId", userId))
      .map((h) => hydrate("schedule_homework", h))
      .filter((h) => h.status !== "completed" && h.dueDate >= today && h.dueDate <= nextWeek);

    // Upcoming study sessions (next 7 days)
    const studySessions = (await findMany("schedule_study_sessions", "userId", userId))
      .map((s) => hydrate("schedule_study_sessions", s))
      .filter((s) => s.date >= today && s.date <= nextWeek);

    // Build combined upcoming list
    const upcoming = [];

    for (const c of classes) {
      for (let d = 0; d < 7; d++) {
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() + d);
        if (checkDate.getDay() === c.day) {
          const dateStr = checkDate.toISOString().slice(0, 10);
          const start = new Date(`${dateStr}T${c.startTime}`).getTime();
          if (start >= now) {
            upcoming.push({
              id: c.id,
              type: "class",
              title: c.title,
              subjectId: c.subjectId,
              date: dateStr,
              time: c.startTime,
              endTime: c.endTime,
              location: c.room,
              timestamp: start,
            });
          }
        }
      }
    }

    for (const h of homework) {
      const dueTime = h.dueTime ? new Date(`${h.dueDate}T${h.dueTime}`).getTime() : new Date(`${h.dueDate}T23:59`).getTime();
      if (dueTime >= now) {
        upcoming.push({
          id: h.id,
          type: "homework",
          title: h.title,
          subjectId: h.subjectId,
          date: h.dueDate,
          time: h.dueTime || "23:59",
          priority: h.priority,
          timestamp: dueTime,
        });
      }
    }

    for (const s of studySessions) {
      const start = new Date(`${s.date}T${s.startTime}`).getTime();
      if (start >= now) {
        upcoming.push({
          id: s.id,
          type: "study",
          title: s.title,
          subjectId: s.subjectId,
          date: s.date,
          time: s.startTime,
          endTime: s.endTime,
          topic: s.topic,
          timestamp: start,
        });
      }
    }

    upcoming.sort((a, b) => a.timestamp - b.timestamp);

    res.json({ upcoming: upcoming.slice(0, 20) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch upcoming" });
  }
});

// GET /api/schedule/week
router.get("/week", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { start } = req.query;
    const weekStart = start ? String(start) : new Date().toISOString().slice(0, 10);
    
    const classes = (await findMany("schedule_classes", "userId", userId))
      .map((c) => hydrate("schedule_classes", c))
      .filter((c) => c.isActive);

    const homework = (await findMany("schedule_homework", "userId", userId))
      .map((h) => hydrate("schedule_homework", h));

    const studySessions = (await findMany("schedule_study_sessions", "userId", userId))
      .map((s) => hydrate("schedule_study_sessions", s));

    res.json({ classes, homework, studySessions, weekStart });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch week schedule" });
  }
});

export default router;