import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Modal, EmptyState, Skeleton, StatCard } from "@/components/ui";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Scale, Flame, Timer, Footprints, Dumbbell, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface FitnessEntry {
  id: string;
  date: string;
  weight?: number;
  height?: number;
  calories?: number;
  steps?: number;
  distance?: number;
  notes?: string;
}

interface CardioEntry {
  id: string;
  type: string;
  distance: number;
  duration: number;
  calories?: number;
  avgHeartRate?: number;
  avgSpeed: number;
  pace: string;
  notes?: string;
  date: number;
}

interface WorkoutRoutine {
  id: string;
  name: string;
  exercises: any[];
}

export default function Fitness() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"overview" | "weight" | "cardio" | "workouts">("overview");
  const [showAddCardio, setShowAddCardio] = useState(false);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [showAddRoutine, setShowAddRoutine] = useState(false);

  // Weight / daily entries
  const { data: fitnessEntry, isLoading: entryLoading } = useQuery<FitnessEntry>({
    queryKey: ["fitnessToday"],
    queryFn: () => api.get("/fitness"),
  });

  // Cardio list
  const { data: cardioEntries, isLoading: cardioLoading } = useQuery<CardioEntry[]>({
    queryKey: ["cardio"],
    queryFn: () => api.get("/fitness/cardio"),
    enabled: tab === "cardio",
  });

  // Routines
  const { data: routines, isLoading: routinesLoading } = useQuery<WorkoutRoutine[]>({
    queryKey: ["routines"],
    queryFn: () => api.get("/fitness/routines"),
    enabled: tab === "workouts",
  });

  // Stats
  const { data: stats } = useQuery<any>({
    queryKey: ["fitnessStats"],
    queryFn: () => api.get("/fitness/stats"),
  });

  const weightMutation = useMutation({
    mutationFn: (data: any) => api.post("/fitness", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fitnessToday"] });
      toast.success("Weight logged! ⚖️");
      setShowAddWeight(false);
    },
  });

  const cardioMutation = useMutation({
    mutationFn: (data: any) => api.post("/fitness/cardio", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cardio"] });
      toast.success("Cardio session logged! 🏃");
      setShowAddCardio(false);
    },
  });

  const routineMutation = useMutation({
    mutationFn: (data: any) => api.post("/fitness/routines", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      toast.success("Routine created! 💪");
      setShowAddRoutine(false);
    },
  });

  const deleteCardio = useMutation({
    mutationFn: (id: string) => api.delete(`/fitness/cardio/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cardio"] });
      toast.success("Deleted");
    },
  });

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h1 className="text-2xl font-bold">Fitness 💪</h1>

      <div className="flex gap-1 p-1 card overflow-x-auto">
        {(["overview", "weight", "cardio", "workouts"] as const).map((t) => (
          <button
            key={t}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize whitespace-nowrap transition-all ${
              tab === t ? "bg-[var(--accent)] text-white shadow-sm" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-4">
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon="⚖️" label="Today's Weight" value={`${(stats as any).todayWeight || "N/A"} kg`} />
              <StatCard icon="🏃" label="Total Cardio" value={`${(stats as any).totalCardio || 0} sessions`} />
              <StatCard icon="🔥" label="Calories Burned" value={`${(stats as any).totalCalories || 0}`} />
              <StatCard icon="💪" label="Workouts" value={`${(stats as any).totalWorkouts || 0}`} />
            </div>
          )}
          {fitnessEntry && (
            <div className="card p-5">
              <h3 className="font-bold mb-3">Today's Entry</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-xl bg-[var(--surface-2)]">
                  <Scale size={20} className="mx-auto mb-1 text-[var(--accent)]" />
                  <div className="font-bold">{(fitnessEntry as any).weight || "—"} kg</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Weight</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-[var(--surface-2)]">
                  <Footprints size={20} className="mx-auto mb-1 text-green-500" />
                  <div className="font-bold">{(fitnessEntry as any).steps?.toLocaleString() || "—"}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Steps</div>
                </div>
                <div className="text-center p-3 rounded-xl bg-[var(--surface-2)]">
                  <Flame size={20} className="mx-auto mb-1 text-orange-500" />
                  <div className="font-bold">{(fitnessEntry as any).calories || "—"} kcal</div>
                  <div className="text-[10px] text-[var(--text-muted)]">Calories</div>
                </div>
              </div>
            </div>
          )}
          <button className="btn-primary w-full" onClick={() => setShowAddWeight(true)}>
            <Plus size={18} /> Log Today's Weight & Steps
          </button>
        </div>
      )}

      {/* Weight tab */}
      {tab === "weight" && (
        <div className="space-y-3">
          <button className="btn-primary" onClick={() => setShowAddWeight(true)}>
            <Plus size={18} /> Log Entry
          </button>
          {entryLoading ? (
            <Skeleton className="h-20" />
          ) : fitnessEntry ? (
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Today</span>
                <span className="text-sm text-[var(--text-muted)]">{format(new Date(), "MMM d")}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div><span className="text-xs text-[var(--text-muted)]">Weight</span><div className="font-bold">{(fitnessEntry as any).weight || "—"} kg</div></div>
                <div><span className="text-xs text-[var(--text-muted)]">Steps</span><div className="font-bold">{(fitnessEntry as any).steps?.toLocaleString() || "—"}</div></div>
                <div><span className="text-xs text-[var(--text-muted)]">Distance</span><div className="font-bold">{(fitnessEntry as any).distance || "—"} km</div></div>
              </div>
            </div>
          ) : (
            <EmptyState icon="⚖️" title="No weight logged today" message="Start tracking your progress!" />
          )}
        </div>
      )}

      {/* Cardio tab */}
      {tab === "cardio" && (
        <div className="space-y-3">
          <button className="btn-primary" onClick={() => setShowAddCardio(true)}>
            <Plus size={18} /> Log Cardio
          </button>
          {cardioLoading ? (
            [1, 2].map((i) => <Skeleton key={i} className="h-20" />)
          ) : !cardioEntries?.length ? (
            <EmptyState icon="🏃" title="No cardio sessions" message="Track your runs, walks, cycles and more!" />
          ) : (
            <AnimatePresence>
              {cardioEntries.map((entry) => (
                <motion.div key={entry.id} layout className="card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent)] flex items-center justify-center text-white font-bold text-sm">
                    {entry.type === "running" ? "🏃" : entry.type === "cycling" ? "🚴" : entry.type === "swimming" ? "🏊" : "🚶"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm capitalize">{entry.type}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {entry.distance} km • {Math.floor(entry.duration / 60)}m {entry.duration % 60}s
                      {entry.pace && ` • ${entry.pace}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm">{entry.calories || "—"} kcal</div>
                    <div className="text-[10px] text-[var(--text-muted)]">{format(new Date(entry.date), "MMM d")}</div>
                  </div>
                  <button
                    className="p-1.5 text-[var(--text-muted)] hover:text-red-500"
                    onClick={() => deleteCardio.mutate(entry.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      )}

      {/* Workouts tab */}
      {tab === "workouts" && (
        <div className="space-y-3">
          <button className="btn-primary" onClick={() => setShowAddRoutine(true)}>
            <Plus size={18} /> New Routine
          </button>
          {routinesLoading ? (
            <Skeleton className="h-20" />
          ) : !routines?.length ? (
            <EmptyState icon="🏋️" title="No routines yet" message="Create workout routines to track your exercises!" />
          ) : (
            routines.map((r) => (
              <div key={r.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <Dumbbell size={20} className="text-[var(--accent)]" />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">{r.name}</div>
                    <div className="text-xs text-[var(--text-muted)]">{r.exercises?.length || 0} exercises</div>
                  </div>
                </div>
                {r.exercises?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {r.exercises.map((ex: any) => (
                      <div key={ex.id} className="text-xs p-2 rounded-lg bg-[var(--surface-2)]">
                        {ex.name} — {ex.sets}×{ex.reps} {ex.weight ? `@ ${ex.weight}kg` : ""}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Weight Modal */}
      <Modal open={showAddWeight} onClose={() => setShowAddWeight(false)} title="Log Weight & Steps">
        <WeightForm
          onSubmit={(d) => weightMutation.mutate(d)}
          onClose={() => setShowAddWeight(false)}
          isPending={weightMutation.isPending}
        />
      </Modal>

      {/* Add Cardio Modal */}
      <Modal open={showAddCardio} onClose={() => setShowAddCardio(false)} title="Log Cardio">
        <CardioForm
          onSubmit={(d) => cardioMutation.mutate(d)}
          onClose={() => setShowAddCardio(false)}
          isPending={cardioMutation.isPending}
        />
      </Modal>

      {/* Add Routine Modal */}
      <Modal open={showAddRoutine} onClose={() => setShowAddRoutine(false)} title="New Workout Routine">
        <RoutineForm
          onSubmit={(d) => routineMutation.mutate(d)}
          onClose={() => setShowAddRoutine(false)}
          isPending={routineMutation.isPending}
        />
      </Modal>
    </motion.div>
  );
}

function WeightForm({ onSubmit, onClose, isPending }: { onSubmit: (d: any) => void; onClose: () => void; isPending: boolean }) {
  const [weight, setWeight] = useState("");
  const [steps, setSteps] = useState("");
  const [calories, setCalories] = useState("");
  const [distance, setDistance] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Weight (kg)</label>
        <input type="number" step="0.1" className="input" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="70.5" />
      </div>
      <div>
        <label className="label">Steps</label>
        <input type="number" className="input" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="8000" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Calories</label>
          <input type="number" className="input" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="2200" />
        </div>
        <div>
          <label className="label">Distance (km)</label>
          <input type="number" step="0.1" className="input" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="5.2" />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button
          className="btn-primary"
          onClick={() => onSubmit({ weight: weight ? parseFloat(weight) : undefined, steps: steps ? parseInt(steps) : undefined, calories: calories ? parseInt(calories) : undefined, distance: distance ? parseFloat(distance) : undefined })}
          disabled={isPending}
        >
          Save
        </button>
      </div>
    </div>
  );
}

function CardioForm({ onSubmit, onClose, isPending }: { onSubmit: (d: any) => void; onClose: () => void; isPending: boolean }) {
  const [type, setType] = useState("running");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [calories, setCalories] = useState("");
  const [heartRate, setHeartRate] = useState("");

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Activity</label>
        <div className="flex gap-2 flex-wrap">
          {["running", "walking", "cycling", "swimming"].map((t) => (
            <button key={t} className={`btn-secondary capitalize text-sm ${type === t ? "ring-2 ring-[var(--accent)]" : ""}`} onClick={() => setType(t)}>
              {t === "running" ? "🏃" : t === "cycling" ? "🚴" : t === "swimming" ? "🏊" : "🚶"} {t}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Distance (km)</label>
          <input type="number" step="0.01" className="input" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="5.0" />
        </div>
        <div>
          <label className="label">Duration (minutes)</label>
          <input type="number" className="input" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Calories</label>
          <input type="number" className="input" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="300" />
        </div>
        <div>
          <label className="label">Avg Heart Rate</label>
          <input type="number" className="input" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} placeholder="140" />
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button
          className="btn-primary"
          onClick={() => {
            if (!distance || !duration) return toast.error("Distance and duration required");
            onSubmit({
              type,
              distance: parseFloat(distance),
              duration: parseInt(duration) * 60,
              calories: calories ? parseInt(calories) : undefined,
              avgHeartRate: heartRate ? parseInt(heartRate) : undefined,
            });
          }}
          disabled={isPending}
        >
          Log
        </button>
      </div>
    </div>
  );
}

function RoutineForm({ onSubmit, onClose, isPending }: { onSubmit: (d: any) => void; onClose: () => void; isPending: boolean }) {
  const [name, setName] = useState("");
  const [exercises, setExercises] = useState([{ name: "", sets: 3, reps: 10, weight: 0 }]);

  return (
    <div className="space-y-4">
      <div>
        <label className="label">Routine name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Upper body day" autoFocus />
      </div>
      {exercises.map((ex, i) => (
        <div key={i} className="p-3 rounded-xl bg-[var(--surface-2)] space-y-2">
          <input className="input" placeholder="Exercise name" value={ex.name} onChange={(e) => {
            const n = [...exercises]; n[i] = { ...n[i], name: e.target.value }; setExercises(n);
          }} />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label text-[10px]">Sets</label>
              <input type="number" className="input text-sm" value={ex.sets} onChange={(e) => {
                const n = [...exercises]; n[i] = { ...n[i], sets: parseInt(e.target.value) || 0 }; setExercises(n);
              }} />
            </div>
            <div>
              <label className="label text-[10px]">Reps</label>
              <input type="number" className="input text-sm" value={ex.reps} onChange={(e) => {
                const n = [...exercises]; n[i] = { ...n[i], reps: parseInt(e.target.value) || 0 }; setExercises(n);
              }} />
            </div>
            <div>
              <label className="label text-[10px]">Weight (kg)</label>
              <input type="number" step="0.5" className="input text-sm" value={ex.weight} onChange={(e) => {
                const n = [...exercises]; n[i] = { ...n[i], weight: parseFloat(e.target.value) || 0 }; setExercises(n);
              }} />
            </div>
          </div>
        </div>
      ))}
      <button
        className="text-sm text-[var(--accent)] font-semibold"
        onClick={() => setExercises([...exercises, { name: "", sets: 3, reps: 10, weight: 0 }])}
      >
        + Add Exercise
      </button>
      <div className="flex gap-3 justify-end">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={() => { if (name.trim()) onSubmit({ name, exercises: exercises.filter(e => e.name.trim()) }); }} disabled={isPending || !name.trim()}>
          Create
        </button>
      </div>
    </div>
  );
}