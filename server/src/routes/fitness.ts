import { Router, Request, Response } from "express";
import { v4 as uuid } from "uuid";
import {
  setAt,
  setRow,
  updateAt,
  findMany,
  getNested,
  getById,
  hydrate,
} from "../db/firebaseClient.js";
import { authMiddleware } from "../auth/middleware.js";

const router = Router();
router.use(authMiddleware);

// ============ FITNESS ENTRIES ============
router.get("/", async (req: Request, res: Response) => {
  try {
    const { from, to, limit } = req.query;
    let rows = (await findMany("fitnessEntries", "userId", req.user!.id)).map((e) =>
      hydrate("fitnessEntries", e)
    );

    if (from && typeof from === "string") rows = rows.filter((r) => r.date >= from);
    if (to && typeof to === "string") rows = rows.filter((r) => r.date <= to);

    rows.sort((a, b) => (a.date < b.date ? -1 : 1));
    if (limit) rows = rows.slice(-Number(limit));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch fitness data" });
  }
});

// POST /api/fitness - upsert entry by date
router.post("/", async (req: Request, res: Response) => {
  try {
    const { date, weight, height, calories, steps, distanceKm, activeMinutes } = req.body;
    const userId = req.user!.id;
    const entryDate = date || new Date().toISOString().slice(0, 10);

    // Find existing entry for this date
    const all = await findMany("fitnessEntries", "userId", userId);
    const existing = all.find((e: any) => e.date === entryDate);

    const updates: Record<string, any> = {};
    if (weight !== undefined) updates.weight = weight;
    if (height !== undefined) updates.height = height;
    if (calories !== undefined) updates.calories = calories;
    if (steps !== undefined) updates.steps = steps;
    if (distanceKm !== undefined) updates.distanceKm = distanceKm;
    if (activeMinutes !== undefined) updates.activeMinutes = activeMinutes;

    if (existing) {
      await updateAt(`fitnessEntries/${existing.id}`, updates);
      const updated = await getById("fitnessEntries", existing.id);
      res.json(hydrate("fitnessEntries", updated));
    } else {
      const id = uuid();
      await setRow("fitnessEntries", id, {
        userId,
        date: entryDate,
        ...updates,
        createdAt: Date.now(),
      });
      const created = await getById("fitnessEntries", id);
      res.status(201).json(hydrate("fitnessEntries", created));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save fitness data" });
  }
});

// ============ CARDIO ============
router.get("/cardio", async (req: Request, res: Response) => {
  try {
    const rows = (await findMany("cardioEntries", "userId", req.user!.id))
      .map((c) => hydrate("cardioEntries", c))
      .sort((a: any, b: any) => (b.date ?? "").localeCompare(a.date ?? ""));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch cardio" });
  }
});

router.post("/cardio", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    const { type, date, durationMin, distanceKm, calories, heartRate, notes } = req.body;
    const entryDate = date || new Date().toISOString().slice(0, 10);

    const speed = durationMin > 0 ? (distanceKm || 0) / (durationMin / 60) : 0;
    const pace = distanceKm > 0 ? formatPace(durationMin, distanceKm) : null;

    await setRow("cardioEntries", id, {
      userId: req.user!.id,
      type: type || "running",
      date: entryDate,
      durationMin: durationMin || 0,
      distanceKm: distanceKm || 0,
      calories: calories || 0,
      avgSpeed: speed,
      pace,
      heartRate: heartRate || null,
      notes: notes || "",
      createdAt: Date.now(),
    });

    const created = await getById("cardioEntries", id);
    res.status(201).json(hydrate("cardioEntries", created));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add cardio" });
  }
});

router.delete("/cardio/:id", async (req: Request, res: Response) => {
  try {
    await setAt(`cardioEntries/${String(req.params.id)}`, null);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete cardio" });
  }
});

// ============ WORKOUT ROUTINES ============
router.get("/routines", async (req: Request, res: Response) => {
  try {
    const routines = (
      await findMany("workoutRoutines", "userId", req.user!.id)
    ).map((r) => hydrate("workoutRoutines", r));

    const enriched = await Promise.all(
      routines.map(async (r) => {
        const exercises = (
          await getNested(`workoutRoutines/${r.id}/exercises`, { routineId: r.id })
        )
          .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        return { ...r, exercises };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch routines" });
  }
});

router.post("/routines", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    const { name, description, color, icon, exercises } = req.body;

    await setRow("workoutRoutines", id, {
      userId: req.user!.id,
      name: name || "New Routine",
      description: description || "",
      color: color || "#FF8FAB",
      icon: icon || "💪",
      createdAt: Date.now(),
    });

    const createdExercises: any[] = [];
    if (Array.isArray(exercises)) {
      for (let idx = 0; idx < exercises.length; idx++) {
        const ex = exercises[idx];
        const exId = uuid();
        await setAt(`workoutRoutines/${id}/exercises/${exId}`, {
          name: ex.name,
          targetSets: ex.targetSets || 3,
          targetReps: ex.targetReps || 10,
          restSeconds: ex.restSeconds || 90,
          sortOrder: idx,
        });
        createdExercises.push({
          id: exId,
          routineId: id,
          name: ex.name,
          targetSets: ex.targetSets || 3,
          targetReps: ex.targetReps || 10,
          restSeconds: ex.restSeconds || 90,
          sortOrder: idx,
        });
      }
    }

    const routine = await getById("workoutRoutines", id);
    res.status(201).json({ ...hydrate("workoutRoutines", routine), exercises: createdExercises });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create routine" });
  }
});

router.delete("/routines/:id", async (req: Request, res: Response) => {
  try {
    await setAt(`workoutRoutines/${String(req.params.id)}`, null);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete routine" });
  }
});

// ============ WORKOUT SESSIONS ============
router.get("/sessions", async (req: Request, res: Response) => {
  try {
    const sessions = (
      await findMany("workoutSessions", "userId", req.user!.id)
    )
      .map((s) => hydrate("workoutSessions", s))
      .sort((a: any, b: any) => (b.date ?? "").localeCompare(a.date ?? ""));

    const enriched = await Promise.all(
      sessions.map(async (s) => {
        const sets = await getNested(`workoutSessions/${s.id}/sets`, { sessionId: s.id });
        return { ...s, sets };
      })
    );

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

// POST /api/fitness/sessions - create a session with sets
router.post("/sessions", async (req: Request, res: Response) => {
  try {
    const id = uuid();
    const { name, routineId, date, durationMin, calories, notes, sets } = req.body;

    await setRow("workoutSessions", id, {
      userId: req.user!.id,
      routineId: routineId || null,
      name: name || "Workout",
      date: date || new Date().toISOString().slice(0, 10),
      durationMin: durationMin || 0,
      calories: calories || 0,
      notes: notes || "",
      createdAt: Date.now(),
    });

    const createdSets: any[] = [];
    if (Array.isArray(sets)) {
      for (let idx = 0; idx < sets.length; idx++) {
        const set = sets[idx];
        const setId = uuid();
        await setAt(`workoutSessions/${id}/sets/${setId}`, {
          exerciseName: set.exerciseName,
          setNumber: set.setNumber || idx + 1,
          reps: set.reps || 0,
          weightKg: set.weightKg || 0,
          done: set.done || false,
          sortOrder: idx,
        });
        createdSets.push({
          id: setId,
          sessionId: id,
          exerciseName: set.exerciseName,
          setNumber: set.setNumber || idx + 1,
          reps: set.reps || 0,
          weightKg: set.weightKg || 0,
          done: set.done || false,
          sortOrder: idx,
        });
      }
    }

    const session = await getById("workoutSessions", id);
    res.status(201).json({ ...hydrate("workoutSessions", session), sets: createdSets });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.delete("/sessions/:id", async (req: Request, res: Response) => {
  try {
    await setAt(`workoutSessions/${String(req.params.id)}`, null);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete session" });
  }
});

// ============ STATS ============
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const cardio = await findMany("cardioEntries", "userId", userId);
    const workouts = await findMany("workoutSessions", "userId", userId);
    const fitness = await findMany("fitnessEntries", "userId", userId);

    const totalDistance = cardio.reduce(
      (sum: number, c: any) => sum + (c.distanceKm || 0),
      0
    );
    const totalCalories =
      cardio.reduce((sum: number, c: any) => sum + (c.calories || 0), 0) +
      workouts.reduce((sum: number, w: any) => sum + (w.calories || 0), 0);
    const totalWorkoutMinutes =
      workouts.reduce((sum: number, w: any) => sum + (w.durationMin || 0), 0) +
      cardio.reduce((sum: number, c: any) => sum + (c.durationMin || 0), 0);
    const totalSteps = fitness.reduce(
      (sum: number, f: any) => sum + (f.steps || 0),
      0
    );
    const currentWeight =
      fitness
        .filter((f: any) => f.weight)
        .sort((a: any, b: any) => (a.date < b.date ? 1 : -1))[0]?.weight ?? null;

    // Workout streak
    let streak = 0;
    const workoutDates = new Set(workouts.map((w: any) => w.date));
    const check = new Date();
    while (workoutDates.has(check.toISOString().slice(0, 10))) {
      streak++;
      check.setDate(check.getDate() - 1);
    }

    res.json({
      totalDistance,
      totalCalories,
      totalWorkoutMinutes,
      totalSteps,
      currentWeight,
      workoutCount: workouts.length,
      cardioCount: cardio.length,
      workoutStreak: streak,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

function formatPace(durationMin: number, distanceKm: number): string {
  const minPerKm = durationMin / distanceKm;
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${s.toString().padStart(2, "0")} /km`;
}

export default router;