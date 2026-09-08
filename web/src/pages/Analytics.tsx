import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard, Skeleton } from "@/components/ui";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { TrendingUp, Target, Clock, Award } from "lucide-react";

interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  completedToday: number;
  completedThisWeek: number;
  weeklyRate: number;
  streak: number;
}

interface FitnessStats {
  totalDistance: number;
  totalCalories: number;
  totalWorkoutMinutes: number;
  totalSteps: number;
  currentWeight: number | null;
  workoutCount: number;
  cardioCount: number;
  workoutStreak: number;
}

export default function Analytics() {
  const [period, setPeriod] = useState("7d");

  const { data: stats, isLoading: statsLoading } = useQuery<TaskStats>({
    queryKey: ["taskStats"],
    queryFn: () => api.get("/tasks/stats"),
  });

  const { data: fitnessStats } = useQuery<FitnessStats>({
    queryKey: ["fitnessStats"],
    queryFn: () => api.get("/fitness/stats"),
  });

  const { data: allTasks } = useQuery<any[]>({
    queryKey: ["tasks"],
    queryFn: () => api.get("/tasks"),
  });

  if (statsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const s = stats;
  const f = fitnessStats;

  // Build a real 7-day completed-tasks chart by bucketing completedAt timestamps
  const weeklyData = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - i));
    const dayStart = date.getTime();
    const dayEnd = dayStart + 86_400_000;
    const dayTasks = (allTasks || []).filter(
      (t) => t.completed && t.completedAt && t.completedAt >= dayStart && t.completedAt < dayEnd
    ).length;
    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      tasks: dayTasks,
    };
  });

  // Real priority distribution from allTasks
  const taskList = allTasks || [];
  const priorityData = [
    { name: "High",   value: taskList.filter((t) => t.priority === "high").length,   color: "#ef4444" },
    { name: "Medium", value: taskList.filter((t) => t.priority === "medium").length, color: "#f59e0b" },
    { name: "Low",    value: taskList.filter((t) => t.priority === "low").length,    color: "#22c55e" },
    { name: "None",   value: taskList.filter((t) => !t.priority || t.priority === "none").length, color: "#94a3b8" },
  ].filter((p) => p.value > 0);

  // Fallback when no data yet
  const showPriority = priorityData.length > 0;
  const pieData = showPriority
    ? priorityData
    : [{ name: "No tasks", value: 1, color: "#e2e8f0" }];

  // Weekly completion rate for a trend line (cumulative tasks done each day of the week)
  const cumulativeData = weeklyData.reduce<{ day: string; total: number }[]>((acc, d) => {
    const prev = acc[acc.length - 1]?.total || 0;
    acc.push({ day: d.day, total: prev + d.tasks });
    return acc;
  }, []);

  return (
    <motion.div className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stats & Analytics 📊</h1>
        <div className="flex gap-1 p-1 card">
          {(["7d", "30d", "90d"] as const).map((p) => (
            <button
              key={p}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-all ${
                period === p ? "bg-[var(--accent)] text-white shadow-sm" : "text-[var(--text-muted)]"
              }`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="✅" label="Total completed" value={s?.completed ?? 0} sub={`${s?.total ?? 0} total`} />
        <StatCard icon="🔥" label="Current streak" value={`${s?.streak ?? 0} days`} sub={`${s?.completedToday ?? 0} today`} />
        <StatCard icon="🏃" label="Cardio sessions" value={f?.cardioCount ?? 0} sub={`${Math.round(f?.totalDistance ?? 0)} km total`} />
        <StatCard icon="💪" label="Workouts" value={f?.workoutCount ?? 0} sub={`${f?.totalWorkoutMinutes ?? 0} min total`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tasks completed per day this week */}
        <div className="card p-5">
          <h3 className="font-bold flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-[var(--accent)]" /> Tasks Completed (7 days)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="tasks" name="Completed" fill="var(--accent)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cumulative completion trend */}
        <div className="card p-5">
          <h3 className="font-bold flex items-center gap-2 mb-4">
            <Award size={18} className="text-yellow-500" /> Cumulative Progress
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cumulativeData}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis hide allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Line
                dataKey="total"
                name="Total done"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Priority distribution + fitness */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="font-bold flex items-center gap-2 mb-4">
            <Target size={18} className="text-purple-500" /> Priority Distribution
          </h3>
          {!showPriority && (
            <p className="text-sm text-[var(--text-muted)] text-center py-4">No tasks yet — add some to see a breakdown!</p>
          )}
          {showPriority && (
            <>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {priorityData.map((p) => (
                  <div key={p.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
                    <span>{p.name}</span>
                    <span className="text-[var(--text-muted)]">({p.value})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Fitness stats */}
        <div className="card p-5">
          <h3 className="font-bold flex items-center gap-2 mb-4">
            <Clock size={18} className="text-green-500" /> Fitness Summary
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-2)]">
              <span className="text-sm">Total distance</span>
              <span className="font-bold">{(f?.totalDistance ?? 0).toFixed(1)} km</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-2)]">
              <span className="text-sm">Calories burned</span>
              <span className="font-bold">{f?.totalCalories ?? 0} kcal</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-2)]">
              <span className="text-sm">Total active time</span>
              <span className="font-bold">{f?.totalWorkoutMinutes ?? 0} min</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-2)]">
              <span className="text-sm">Current weight</span>
              <span className="font-bold">
                {f?.currentWeight !== null && f?.currentWeight !== undefined ? `${f.currentWeight} kg` : "Not logged"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
