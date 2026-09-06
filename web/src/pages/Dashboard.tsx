import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/store/useAuth";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { StatCard, ProgressBar, Skeleton } from "@/components/ui";
import { CheckCircle, Flame, Trophy, Calendar, BookOpen, MessageCircle, Dumbbell, ArrowRight } from "lucide-react";
import { format } from "date-fns";

interface DashboardData {
  greeting: string;
  date: string;
  todayTasks: any[];
  taskStats: {
    total: number;
    completed: number;
    pending: number;
    completedToday: number;
    percentage: number;
  };
  upcomingEvents: any[];
  quickNotes: any[];
  fitness: { cardioCount: number; workouts: number };
  user: { streak: number; level: number; xp: number };
  motivation: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/dashboard"),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const d = data!;

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            className="text-2xl lg:text-3xl font-bold"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {d.greeting}, {user?.displayName}! 👋
          </motion.h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {format(new Date(), "EEEE, MMMM d, yyyy")} • Level {d.user.level} ✨
          </p>
        </div>
      </div>

      {/* Motivation */}
      <motion.div
        className="card p-4 bg-gradient-to-r from-[var(--accent)]/10 via-purple-500/5 to-blue-500/10 border-[var(--accent)]/20"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
      >
        <p className="text-sm font-medium italic">"{d.motivation}"</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="✅" label="Tasks done today" value={d.taskStats.completedToday} sub={`${d.taskStats.pending} pending`} />
        <StatCard icon="🔥" label="Current streak" value={`${d.user.streak} days`} />
        <StatCard icon="🎯" label="Total completed" value={d.taskStats.completed} sub={`${d.taskStats.total} total`} />
        <StatCard icon="✨" label="XP" value={`${d.user.xp || 0} xp`} sub={`Level ${d.user.level}`} />
      </div>

      {/* Task Progress */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold">Today's Progress</h2>
          <Link to="/tasks" className="text-xs font-semibold text-[var(--accent)] flex items-center gap-1 hover:underline">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <ProgressBar value={d.taskStats.percentage} />
        <p className="text-xs text-[var(--text-muted)] mt-2">
          {d.taskStats.percentage}% complete — {d.taskStats.completed} of {d.taskStats.total} tasks
        </p>
        {d.todayTasks.length > 0 && (
          <div className="mt-4 space-y-2">
            {d.todayTasks.slice(0, 5).map((task: any) => (
              <div key={task.id} className="flex items-center gap-3 p-2 rounded-xl bg-[var(--surface-2)]">
                <CheckCircle size={16} className="text-[var(--text-muted)]" />
                <span className="text-sm">{task.title}</span>
                {task.priority === "high" && <span className="badge bg-red-100 text-red-600 ml-auto">High</span>}
                {task.priority === "medium" && <span className="badge bg-yellow-100 text-yellow-600 ml-auto">Med</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upcoming events */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2"><Calendar size={18} /> Upcoming</h2>
            <Link to="/calendar" className="text-xs font-semibold text-[var(--accent)] hover:underline">View all</Link>
          </div>
          {d.upcomingEvents.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No upcoming events 🎉</p>
          ) : (
            <div className="space-y-2">
              {d.upcomingEvents.slice(0, 4).map((e: any) => (
                <div key={e.id} className="p-2.5 rounded-xl bg-[var(--surface-2)] text-sm">
                  <div className="font-medium">{e.title}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {format(new Date(e.start), "MMM d, h:mm a")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Notes */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2"><BookOpen size={18} /> Quick Notes</h2>
            <Link to="/notes" className="text-xs font-semibold text-[var(--accent)] hover:underline">View all</Link>
          </div>
          {d.quickNotes.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No notes yet 📝</p>
          ) : (
            <div className="space-y-2">
              {d.quickNotes.map((n: any) => (
                <Link
                  to={`/notes/${n.id}`}
                  key={n.id}
                  className="block p-2.5 rounded-xl bg-[var(--surface-2)] text-sm hover:shadow-sm transition-shadow"
                >
                  <div className="font-medium">{n.title}</div>
                  <div className="text-xs text-[var(--text-muted)] truncate">{n.contentText}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fitness summary */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2"><Dumbbell size={18} /> Fitness</h2>
            <Link to="/fitness" className="text-xs font-semibold text-[var(--accent)] hover:underline">Details</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[var(--surface-2)] text-center">
              <div className="text-2xl mb-1">🏃</div>
              <div className="font-bold text-lg">{d.fitness.cardioCount}</div>
              <div className="text-[10px] text-[var(--text-muted)]">Cardio sessions</div>
            </div>
            <div className="p-3 rounded-xl bg-[var(--surface-2)] text-center">
              <div className="text-2xl mb-1">💪</div>
              <div className="font-bold text-lg">{d.fitness.workouts}</div>
              <div className="text-[10px] text-[var(--text-muted)]">Workouts</div>
            </div>
          </div>
        </div>

        {/* Chat preview */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2"><MessageCircle size={18} /> Recent Chat</h2>
            <Link to="/chat" className="text-xs font-semibold text-[var(--accent)] hover:underline">Open chat</Link>
          </div>
          <div className="text-center py-6">
            <div className="text-3xl mb-2">💬</div>
            <p className="text-sm text-[var(--text-muted)]">Start a conversation!</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}