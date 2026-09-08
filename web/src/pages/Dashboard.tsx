import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/store/useAuth";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { StatCard, ProgressBar, Skeleton } from "@/components/ui";
import { formatRs } from "@/lib/currency";
import { CheckCircle, Flame, Trophy, Calendar, BookOpen, MessageCircle, Dumbbell, ArrowRight, GraduationCap, Timer, Play, Pause, Wallet, TrendingUp, TrendingDown, CalendarDays } from "lucide-react";
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

interface FinanceSummary {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  monthIncome: number;
  monthExpense: number;
  totalBudget: number;
  budgetSpent: number;
  budgetRemaining: number;
  budgetsByCategory: { id: string; category: string; budget: number; spent: number; remaining: number }[];
}

interface TodaySchedule {
  date: string;
  day: number;
  classes: any[];
  homework: any[];
  studySessions: any[];
  currentClass: any | null;
  nextClass: any | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [focusRunning, setFocusRunning] = useState(false);
  const [studyMinutes, setStudyMinutes] = useState(() => Number(localStorage.getItem("studyMinutesToday")) || 0);
  const [studyTarget, setStudyTarget] = useState(() => Number(localStorage.getItem("studyTargetMinutes")) || 120);

  const [timeGreeting, setTimeGreeting] = useState("");

  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) setTimeGreeting("Good morning");
      else if (hour >= 12 && hour < 17) setTimeGreeting("Good afternoon");
      else if (hour >= 17 && hour < 21) setTimeGreeting("Good evening");
      else setTimeGreeting("Good night");
    };
    updateGreeting();
    const interval = setInterval(updateGreeting, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!focusRunning) return;
    const interval = window.setInterval(() => {
      setFocusSeconds((seconds) => {
        if (seconds <= 1) {
          setFocusRunning(false);
          setStudyMinutes((minutes) => {
            const next = minutes + 25;
            localStorage.setItem("studyMinutesToday", String(next));
            return next;
          });
          return 25 * 60;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [focusRunning]);

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/dashboard"),
  });

  const { data: finance, isLoading: financeLoading } = useQuery<FinanceSummary>({
    queryKey: ["finance", "summary"],
    queryFn: () => api.get("/finance/summary"),
  });

  const { data: todaySched, isLoading: schedLoading } = useQuery<TodaySchedule>({
    queryKey: ["schedule", "today"],
    queryFn: () => api.get("/schedule/today"),
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
  const classesToday = todaySched?.classes ?? [];
  const homeworkToday = todaySched?.homework ?? [];

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
            {timeGreeting}, {user?.displayName}
          </motion.h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            {format(new Date(), "EEEE, MMMM d, yyyy")} • Level {d.user.level}
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

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<CheckCircle size={20} />} label="Tasks done today" value={d.taskStats.completedToday} sub={`${d.taskStats.pending} pending`} />
        <StatCard icon={<CalendarDays size={20} />} label="Classes today" value={classesToday.length} sub={homeworkToday.length ? `${homeworkToday.length} due` : "No homework due"} />
        <StatCard icon={<Wallet size={20} />} label="Balance" value={formatRs(finance?.balance ?? 0)} sub="See Finance" />
        <StatCard icon={<Flame size={20} />} label="Current streak" value={`${d.user.streak} days`} />
      </div>

      {/* Today's Agenda (classes + homework) */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold flex items-center gap-2"><CalendarDays size={18} /> Today's Agenda</h2>
          <Link to="/schedule" className="text-xs font-semibold text-[var(--accent)] flex items-center gap-1 hover:underline">
            Open schedule <ArrowRight size={14} />
          </Link>
        </div>
        {schedLoading ? (
          <Skeleton className="h-20" />
        ) : classesToday.length === 0 && homeworkToday.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] py-2">Nothing scheduled today. Enjoy the free time! 🌿</p>
        ) : (
          <div className="space-y-2">
            {classesToday.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--surface-2)]">
                <GraduationCap size={16} className="text-[var(--accent)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{c.subjectName || c.name || "Class"}</span>
                  {c.room && <span className="text-[11px] text-[var(--text-muted)] ml-2">Room {c.room}</span>}
                </div>
                <span className="text-xs font-semibold text-[var(--text-muted)] whitespace-nowrap">
                  {c.startTime}–{c.endTime}
                </span>
              </div>
            ))}
            {homeworkToday.map((h: any) => (
              <div key={h.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--surface-2)]">
                <BookOpen size={16} className="text-amber-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm">{h.title || h.name}</span>
                </div>
                <span className="badge bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 text-[10px]">Due today</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* XP Progress */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold">Level Progress</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Level {d.user.level} &rarr; Level {d.user.level + 1}
            </p>
          </div>
          <div className="text-sm font-semibold text-[var(--accent)]">
            {(d.user.xp || 0) % 100} / 100 XP
          </div>
        </div>
        <ProgressBar value={(d.user.xp || 0) % 100} />
        <p className="text-xs text-[var(--text-muted)] mt-2">
          {100 - ((d.user.xp || 0) % 100)} XP to next level
        </p>
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
        {/* Study Focus */}
        <div className="card p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold flex items-center gap-2"><GraduationCap size={18} /> Study Focus</h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">Build a focused study habit in short sessions.</p>
            </div>
            <Link to="/study" className="text-xs font-semibold text-[var(--accent)] flex items-center gap-1">Open workspace <ArrowRight size={14} /></Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
            <div className="p-4 rounded-xl bg-[var(--surface-2)]">
              <div className="text-xs text-[var(--text-muted)] mb-1">Today&apos;s target</div>
              <div className="flex items-center gap-2">
                <input className="input h-9 w-24" type="number" min="15" step="15" value={studyTarget} onChange={(e) => { const value = Math.max(15, Number(e.target.value)); setStudyTarget(value); localStorage.setItem("studyTargetMinutes", String(value)); }} />
                <span className="text-sm">minutes</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--border)] mt-3 overflow-hidden"><div className="h-full bg-[var(--accent)]" style={{ width: `${Math.min(100, (studyMinutes / studyTarget) * 100)}%` }} /></div>
              <div className="text-xs text-[var(--text-muted)] mt-1">{studyMinutes} of {studyTarget} minutes</div>
            </div>
            <div className="text-center min-w-36">
              <Timer size={20} className="mx-auto text-[var(--accent)] mb-1" />
              <div className="text-3xl font-bold tabular-nums">{String(Math.floor(focusSeconds / 60)).padStart(2, "0")}:{String(focusSeconds % 60).padStart(2, "0")}</div>
              <button className="btn-primary mt-2" onClick={() => setFocusRunning((running) => !running)}>{focusRunning ? <Pause size={16} /> : <Play size={16} />} {focusRunning ? "Pause" : "Start"}</button>
            </div>
            <div className="p-4 rounded-xl border border-[var(--border)]">
              <div className="text-xs text-[var(--text-muted)]">Suggested rhythm</div>
              <div className="font-semibold mt-1">25 min focus / 5 min break</div>
              <p className="text-xs text-[var(--text-muted)] mt-2">Use the Schedule tab to plan homework and study blocks.</p>
            </div>
          </div>
        </div>

        {/* Finance summary */}
        <div className="card p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2"><Wallet size={18} /> Finance</h2>
            <Link to="/finance" className="text-xs font-semibold text-[var(--accent)] hover:underline">View Finances</Link>
          </div>
          {financeLoading ? (
            <Skeleton className="h-24" />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-xs text-[var(--text-muted)]">Balance</div>
                  <div className="font-bold text-lg mt-1">{formatRs(finance?.balance ?? 0)}</div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-xs text-[var(--text-muted)] flex items-center gap-1"><TrendingUp size={11} /> Income (Month)</div>
                  <div className="font-bold text-lg mt-1 text-green-500">+{formatRs(finance?.monthIncome ?? 0)}</div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-xs text-[var(--text-muted)] flex items-center gap-1"><TrendingDown size={11} /> Expenses (Month)</div>
                  <div className="font-bold text-lg mt-1 text-red-500">-{formatRs(finance?.monthExpense ?? 0)}</div>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-2)]">
                  <div className="text-xs text-[var(--text-muted)]">Budget remaining</div>
                  <div className="font-bold text-lg mt-1">{formatRs(finance?.budgetRemaining ?? 0)}</div>
                  {finance && finance.totalBudget > 0 && (
                    <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      of {formatRs(finance.totalBudget)} budget
                    </div>
                  )}
                </div>
              </div>
              {finance && finance.budgetsByCategory.length > 0 && (
                <div className="mt-4 space-y-2">
                  {finance.budgetsByCategory.map((b) => {
                    const pct = b.budget > 0 ? Math.min(100, Math.round((b.spent / b.budget) * 100)) : 0;
                    const over = b.spent > b.budget;
                    return (
                      <div key={b.id || b.category}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium capitalize">{b.category}</span>
                          <span className={over ? "text-red-500 font-semibold" : "text-[var(--text-muted)]"}>
                            {formatRs(b.spent)} / {formatRs(b.budget)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-[var(--accent)]"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Upcoming events */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2"><Calendar size={18} /> Upcoming</h2>
            <Link to="/calendar" className="text-xs font-semibold text-[var(--accent)] hover:underline">View all</Link>
          </div>
          {d.upcomingEvents.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No upcoming events</p>
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
            <p className="text-sm text-[var(--text-muted)]">No notes yet</p>
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

      {/* De-emphasized fitness + chat preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-4 opacity-60 hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold text-sm flex items-center gap-2"><Dumbbell size={16} /> Fitness</h2>
            <Link to="/fitness" className="text-xs font-semibold text-[var(--accent)] hover:underline">Details</Link>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-xl bg-[var(--surface-2)] text-center">
              <div className="font-bold text-base">{d.fitness.cardioCount}</div>
              <div className="text-[10px] text-[var(--text-muted)]">Cardio</div>
            </div>
            <div className="p-2 rounded-xl bg-[var(--surface-2)] text-center">
              <div className="font-bold text-base">{d.fitness.workouts}</div>
              <div className="text-[10px] text-[var(--text-muted)]">Workouts</div>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold flex items-center gap-2"><MessageCircle size={18} /> Recent Chat</h2>
            <Link to="/chat" className="text-xs font-semibold text-[var(--accent)] hover:underline">Open chat</Link>
          </div>
          <div className="text-center py-6">
            <MessageCircle size={28} className="mx-auto mb-2 text-[var(--accent)]" />
            <p className="text-sm text-[var(--text-muted)]">Start a conversation!</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}