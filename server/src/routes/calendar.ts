import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import {
  setAt,
  setRow,
  updateRow,
  findMany,
  getById,
  hydrate,
} from "../db/firebaseClient.js";
import { authMiddleware } from "../auth/middleware.js";

const router = Router();
router.use(authMiddleware);

// GET /api/calendar/events?from=&to=
router.get("/events", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { from, to } = req.query;

    let rows = (await findMany("events", "userId", userId)).map((e) =>
      hydrate("events", e)
    );

    if (from) rows = rows.filter((e) => e.end == null || e.end >= Number(from));
    if (to) rows = rows.filter((e) => e.start <= Number(to));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

// POST /api/calendar/events
router.post("/events", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    const { title, type, start, end, allDay, location, description, color, linkedTaskId } = req.body;

    if (!title || !start) {
      res.status(400).json({ error: "Title and start time required" });
      return;
    }

    await setRow("events", id, {
      userId: req.user!.id,
      title,
      type: type || "event",
      start,
      end: end || null,
      allDay: allDay || false,
      location: location || "",
      description: description || "",
      color: color || "#FF8FAB",
      linkedTaskId: linkedTaskId || null,
      createdAt: Date.now(),
    });

    const event = await getById("events", id);
    res.status(201).json(hydrate("events", event));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create event" });
  }
});

// PATCH /api/calendar/events/:id
router.patch("/events/:id", async (req: Request, res: Response) => {
  try {
    const updates: Record<string, any> = {};
    const allowed = [
      "title",
      "type",
      "start",
      "end",
      "allDay",
      "location",
      "description",
      "color",
    ];
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // null fields delete in Firebase — strip + explicit delete, hydration fills back
    for (const k of Object.keys(updates)) {
      if (updates[k] === null) {
        delete updates[k];
        await setAt(`events/${String(req.params.id)}/${k}`, null);
      }
    }
    await updateRow("events", String(req.params.id), updates);
    const event = await getById("events", String(req.params.id));
    res.json(hydrate("events", event));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update event" });
  }
});

// DELETE /api/calendar/events/:id
router.delete("/events/:id", async (req: Request, res: Response) => {
  try {
    await setAt(`events/${String(req.params.id)}`, null);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete event" });
  }
});

// ============ REMINDERS ============
router.get("/reminders", async (req: Request, res: Response) => {
  try {
    const rows = (await findMany("reminders", "userId", req.user!.id))
      .map((r) => hydrate("reminders", r))
      .filter((r: any) => !r.completed);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch reminders" });
  }
});

router.post("/reminders", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    const { title, datetime, repeat, linkedTaskId } = req.body;
    await setRow("reminders", id, {
      userId: req.user!.id,
      title,
      datetime,
      repeat: repeat || "none",
      linkedTaskId: linkedTaskId || null,
      createdAt: Date.now(),
    });
    const reminder = await getById("reminders", id);
    res.status(201).json(hydrate("reminders", reminder));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create reminder" });
  }
});

router.patch("/reminders/:id", async (req: Request, res: Response) => {
  try {
    await updateRow("reminders", String(req.params.id), {
      completed: req.body.completed ?? false,
    });
    const reminder = await getById("reminders", String(req.params.id));
    res.json(hydrate("reminders", reminder));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update reminder" });
  }
});

router.delete("/reminders/:id", async (req: Request, res: Response) => {
  try {
    await setAt(`reminders/${String(req.params.id)}`, null);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete reminder" });
  }
});

// GET /api/calendar/combined - all items for the calendar
router.get("/combined", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { from, to } = req.query;

    let eventRows = (await findMany("events", "userId", userId)).map((e) =>
      hydrate("events", e)
    );
    const taskRows = await findMany("tasks", "userId", userId);
    let reminderRows = (await findMany("reminders", "userId", userId)).map((r) =>
      hydrate("reminders", r)
    );

    // Combine tasks with due dates as calendar items
    const taskItems = taskRows
      .filter((t: any) => t.dueDate)
      .map((t: any) => ({
        id: t.id,
        kind: "task",
        title: t.title,
        type: "task",
        start: t.dueDate,
        end: t.dueDate,
        allDay: false,
        color: "#C3FF68",
        completed: t.completed,
      }));

    const reminderItems = reminderRows
      .filter((r: any) => !r.completed)
      .map((r: any) => ({
        id: r.id,
        kind: "reminder",
        title: `🔔 ${r.title}`,
        type: "reminder",
        start: r.datetime,
        end: r.datetime,
        allDay: false,
        color: "#FFDAC1",
      }));

    if (from)
      eventRows = eventRows.filter((e) => e.end == null || e.end >= Number(from));
    if (to) eventRows = eventRows.filter((e) => e.start <= Number(to));

    res.json({ events: eventRows, tasks: taskItems, reminders: reminderItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch calendar" });
  }
});

export default router;