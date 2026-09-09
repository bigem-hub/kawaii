import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Timer,
  CalendarDays,
  CheckSquare,
  BarChart3,
  Flame,
  Clock,
  Target,
  TrendingUp,
  Play,
  Pause,
  RotateCcw,
  Star,
  Quote,
  Plus,
  Trash2,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  Trophy,
} from "lucide-react";
import { StatCard, ProgressBar, Tag, toast } from "@/components/ui";
import {
  store,
  quotes,
  defaultSubjects,
  todayISO,
  getDayNumber,
  toMinutes,
  nMin,
  uid,
  type ScheduleEntry,
} from "@/lib/studyPulse";

const TABS = [
  { key: "home", label: "Home", icon: LayoutDashboard },
  { key: "focus", label: "Timer", icon: Timer },
  { key: "schedule", label: "Timetable", icon: CalendarDays },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "progress", label: "Progress", icon: BarChart3 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const SUBJECT_COLORS: Record<string, string> = {
  Physics: "#f87171",
  Chemistry: "#a78bfa",
  Mathematics: "#60a5fa",
  "Computer Science": "#22d3ee",
  English: "#f472b6",
  Nepali: "#fbbf24",
  Biology: "#34d399",
  Revision: "#fbbf24",
  Practice: "#2dd4bf",
};

const TYPE_STYLE: Record<string, { color: string; label: string }> = {
  class: { color: "#60a5fa", label: "Class" },
  study: { color: "#34d399", label: "Study" },
  meals: { color: "#f472b6", label: "Meal" },
  break: { color: "#fbbf24", label: "Break" },
  self: { color: "#22d3ee", label: "Self" },
  commute: { color: "#fbbf24", label: "Commute" },
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function StudyPulse() {
  const [tab, setTab] = useState<TabKey>("home");
  const today = todayISO();

  return (
    <motion.div
      className="space-y-5 max-w-6xl mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[var(--accent)] text-sm font-semibold">
            <GraduationCap size={18} /> Study + Motivation
          </div>
          <h1 className="text-3xl font-bold mt-1 gradient-text">StudyPulse</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Beat procrastination. One focused minute at a time.
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => { setTab("focus"); toast("Let's get focused! 🔥"); }}>
            <Play size={16} /> Start Focus
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap transition-all ${
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
              }`}
            >
              <t.icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {tab === "home" && <HomeTab onStartFocus={() => setTab("focus")} key={today} />}
          {tab === "focus" && <FocusTab />}
          {tab === "schedule" && <ScheduleTab />}
          {tab === "tasks" && <TasksTab />}
          {tab === "progress" && <ProgressTab />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

/* ----------------------------- HOME TAB ----------------------------- */
function HomeTab({ onStartFocus }: { onStartFocus: () => void }) {
  const today = todayISO();
  const [tasks, setTasks] = useState<any[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [sessionsMin, setSessionsMin] = useState<number>(0);
  const [goal, setGoal] = useState<number>(120);
  const [quote, setQuote] = useState(quotes[0]);
  const [starred, setStarred] = useState(false);
  const [now, setNow] = useState(nMin());

  useEffect(() => {
    setTasks(store.getTasks(today));
    setStreak(store.getStreak().count);
    const mins = store.getSessions().filter((s) => s.date === today).reduce((a, s) => a + s.minutes, 0);
    setSessionsMin(mins);
    setGoal(store.getGoals());
    const q = quotes[Math.floor(Date.now() / 86400000) % quotes.length];
    setQuote(q);
    setStarred(store.getStarred().includes(q.text));
    const id = setInterval(() => setNow(nMin()), 30000);
    return () => clearInterval(id);
  }, [today]);

  const toggleTask = (id: string) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    setTasks(updated);
    store.setTasks(today, updated);
  };

  const done = tasks.filter((t) => t.done).length;
  const pct = Math.min(100, Math.round((sessionsMin / goal) * 100));
  const color = pct >= 100 ? "#34d399" : pct >= 60 ? "#60a5fa" : "var(--accent)";

  const dayEntries = useMemo(
    () =>
      store
        .getSchedule()
        .filter((e) => e.day === getDayNumber())
        .sort((a, b) => toMinutes(a.start) - toMinutes(b.start)),
    []
  );
  const nextEntry = dayEntries.find((e) => toMinutes(e.end) > now);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Greeting */}
      <div>
        <h2 className="text-xl font-bold text-[var(--text)]">
          {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </h2>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">
          {streak > 0 ? `🔥 ${streak}-day streak — don't break it today!` : "Start a focus session to build your streak."}
        </p>
      </div>

      {/* Quote */}
      <div className="card p-6 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-[var(--accent-soft)] blur-3xl" />
        <div className="relative flex items-start gap-3">
          <Quote size={24} className="text-[var(--accent)] shrink-0" />
          <p className="flex-1 text-lg font-medium leading-relaxed">"{quote.text}"</p>
          <button
            onClick={() => { store.toggleStarred(quote.text); setStarred(!starred); }}
            className={`p-2 rounded-xl transition-all ${starred ? "text-amber-400" : "text-[var(--text-muted)] hover:text-[var(--accent)]"}`}
            aria-label="Save quote"
          >
            <Star size={20} className={starred ? "fill-amber-400" : ""} />
          </button>
        </div>
        <p className="relative text-xs text-[var(--text-muted)] mt-2 pl-9">— {quote.author}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Flame size={22} />} label="Streak" value={`${streak} days`} />
        <StatCard icon={<Clock size={22} />} label="Studied today" value={`${sessionsMin} min`} />
        <StatCard icon={<CheckSquare size={22} />} label="Tasks done" value={`${done}/${tasks.length}`} />
        <StatCard icon={<Target size={22} />} label="Daily goal" value={`${goal} min`} />
      </div>

      {/* Goal progress */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold flex items-center gap-2 text-[var(--text)]">
            <TrendingUp size={20} className="text-[var(--accent)]" /> Today's goal
          </h3>
          <span className="text-sm font-bold text-[var(--text-muted)]">{sessionsMin}/{goal} min</span>
        </div>
        <ProgressBar value={pct} color={color} />
        <p className="text-xs text-[var(--text-muted)] mt-3">
          {pct >= 100 ? "🎉 Goal achieved! Rest well." : pct >= 50 ? "Halfway there — one more focused session!" : "Start a 25-min session to make progress."}
        </p>
      </div>

      {/* Big CTA */}
      <button
        onClick={onStartFocus}
        className="w-full card p-6 text-left border-[var(--accent-soft)] bg-gradient-to-r from-[var(--accent-soft)] to-[#a78bfa26] group transition-all hover:shadow-[var(--accent-soft)]"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold flex items-center gap-2 text-[var(--text)]">
              <Play size={22} className="text-[var(--accent)]" /> Ready to focus?
            </h3>
            <p className="text-sm text-[var(--text-muted)] mt-1">Deep work now pays off at the exam hall. You've got this.</p>
          </div>
          <ChevronRight size={24} className="text-[var(--text-muted)] group-hover:translate-x-1 transition-transform" />
        </div>
      </button>

      {/* Next up */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Schedule */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2"><CalendarDays size={20} className="text-[var(--accent)]" /> Next up today</h3>
          </div>
          {nextEntry ? (
            <div className="p-3 rounded-2xl bg-[var(--surface-2)] mb-3">
              <span className="text-[10px] uppercase tracking-wide font-bold text-[var(--accent)]">Next</span>
              <p className="font-semibold mt-0.5 text-[var(--text)]">{nextEntry.subject}</p>
              <p className="text-xs text-[var(--text-muted)]">{nextEntry.start} – {nextEntry.end}</p>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)] mb-3">No more scheduled items — free time! Great for a focus session.</p>
          )}
          <div className="space-y-1.5">
            {dayEntries.slice(0, 5).map((entry) => {
              const style = TYPE_STYLE[entry.type];
              return (
                <div key={entry.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-[var(--surface-2)] transition-colors">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)]">{entry.start}</span>
                  <span className="text-sm flex-1 truncate text-[var(--text)]">{entry.subject}</span>
                  <Tag color={style?.color}>{style?.label || entry.type}</Tag>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tasks */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2"><CheckSquare size={20} className="text-[var(--accent)]" /> Today's tasks</h3>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-8">No tasks yet — plan your day!</p>
          ) : (
            <div className="space-y-1.5">
              {tasks.slice(0, 6).map((task) => (
                <button key={task.id} onClick={() => toggleTask(task.id)} className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors ${task.done ? "opacity-50" : "hover:bg-[var(--surface-2)]"}`}>
                  <span className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 ${task.done ? "bg-[#34d399] border-[#34d399]" : "border-[var(--border)]"}`}>
                    {task.done && <CheckSquare size={13} className="text-white" />}
                  </span>
                  <span className={`text-sm flex-1 ${task.done ? "line-through text-[var(--text-muted)]" : "text-[var(--text)]"}`}>{task.title}</span>
                  <Tag color={SUBJECT_COLORS[task.subject]}>{task.subject}</Tag>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- FOCUS TAB ----------------------------- */
const DURATIONS = [25, 45, 60, 90];

function FocusTab() {
  const [subject, setSubject] = useState("Physics");
  const [custom, setCustom] = useState("");
  const [duration, setDuration] = useState(25);
  const [left, setLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [todayMin, setTodayMin] = useState(0);
  const timer = useRef<any>(null);

  useEffect(() => {
    setTodayMin(store.getSessions().filter((s) => s.date === todayISO()).reduce((a, s) => a + s.minutes, 0));
  }, [done]);

  useEffect(() => {
    if (!running) return;
    timer.current = setInterval(() => {
      setLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer.current);
          setRunning(false);
          complete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const complete = () => {
    const name = subject || custom.trim() || "Study";
    store.addSession({ id: uid(), subject: name, minutes: duration, date: todayISO(), completed: true });
    bumpStreakFromSessions();
    setDone(true);
    toast(`🎉 ${duration} min of ${name} logged!`);
  };

  const bumpStreakFromSessions = () => {
    const today = todayISO();
    const cur = store.getStreak();
    if (cur.lastDate === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    store.setStreak({
      count: cur.lastDate === yesterday ? cur.count + 1 : 1,
      lastDate: today,
    });
  };

  const pick = (d: number) => { setDuration(d); setLeft(d * 60); setDone(false); setRunning(false); };
  const start = () => { setRunning(true); setDone(false); };
  const pause = () => setRunning(false);
  const reset = () => { setRunning(false); setLeft(duration * 60); setDone(false); };

  const m = String(Math.floor(left / 60)).padStart(2, "0");
  const s = String(left % 60).padStart(2, "0");
  const pct = duration > 0 ? ((duration * 60 - left) / (duration * 60)) * 100 : 0;

  return (
    <div className="space-y-5">
      {done && (
        <div className="card p-6 text-center border-[#34d39966]">
          <div className="w-12 h-12 rounded-2xl bg-[#34d399]/20 flex items-center justify-center mx-auto mb-2"><Trophy size={24} className="text-[#34d399]" /></div>
          <h3 className="text-lg font-extrabold text-[var(--text)]">Session complete! 🎉</h3>
          <p className="text-sm text-[var(--text-muted)] mt-1">{duration} minutes logged. Discipline wins.</p>
        </div>
      )}

      <div className="card p-8 text-center">
        <div className="relative w-52 h-52 mx-auto mb-6">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" stroke="var(--surface-2)" strokeWidth="8" fill="transparent" />
            <circle cx="50" cy="50" r="42" stroke="var(--accent)" strokeWidth="8" fill="transparent" strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 264} 264`} className="transition-all duration-500" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-5xl font-bold tabular-nums text-[var(--text)]">{m}:{s}</p>
            <p className="text-xs text-[var(--text-muted)] mt-2">{running ? "Focusing..." : "Ready"}</p>
          </div>
        </div>

        {/* Subject chips */}
        <div className="flex flex-wrap justify-center gap-1.5 mb-5">
          {defaultSubjects.map((sub) => (
            <button key={sub} onClick={() => { setSubject(sub); setCustom(""); }}
              className={`px-3 py-1 rounded-full text-xs transition-all ${subject === sub && !custom ? "bg-[var(--accent-soft)] text-[var(--accent)] font-semibold" : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
              {sub}
            </button>
          ))}
          <input value={custom} onChange={(e) => { setCustom(e.target.value); setSubject(""); }}
            placeholder="Custom..."
            className="px-3 py-1 rounded-full text-xs bg-[var(--surface-2)] text-[var(--text)] placeholder-[var(--text-muted)] w-28 outline-none focus:ring-2 ring-[var(--accent-soft)]" />
        </div>

        {/* Durations */}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {DURATIONS.map((d) => (
            <button key={d} onClick={() => pick(d)}
              className={`px-4 py-2 rounded-2xl text-sm font-semibold transition-all ${duration === d && !done ? "bg-[var(--surface-2)] text-[var(--accent)] ring-1 ring-[var(--accent-soft)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"}`}>
              {d} min
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-3">
          {!running ? (
            <button onClick={start} className="btn flex items-center gap-2 px-8 py-3"><Play size={18} />{left === duration * 60 ? "Start" : "Resume"}</button>
          ) : (
            <button onClick={pause} className="btn-secondary flex items-center gap-2 px-8 py-3"><Pause size={18} /> Pause</button>
          )}
          {left !== duration * 60 && (
            <button onClick={reset} className="btn-ghost flex items-center gap-2 px-5 py-3 text-[var(--text-muted)]"><RotateCcw size={16} /> Reset</button>
          )}
        </div>
      </div>

      <div className="card p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-[var(--accent-soft)] flex items-center justify-center"><Clock size={20} className="text-[var(--accent)]" /></div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--text)]">Today's total</p>
          <p className="text-xs text-[var(--text-muted)]">{todayMin} minutes logged so far</p>
        </div>
        <span className="text-2xl font-bold text-[var(--accent)]">{todayMin}<span className="text-sm text-[var(--text-muted)]"> min</span></span>
      </div>
    </div>
  );
}

/* ----------------------------- SCHEDULE TAB ----------------------------- */
function ScheduleTab() {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [day, setDay] = useState<number>(() => getDayNumber());
  const [editing, setEditing] = useState<ScheduleEntry | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { setSchedule(store.getSchedule()); }, []);

  const save = (next: ScheduleEntry[]) => { setSchedule(next); store.setSchedule(next); };

  const entries = useMemo(() =>
    schedule.filter((e) => e.day === day).sort((a, b) => toMinutes(a.start) - toMinutes(b.start)),
    [schedule, day]
  );

  const studyMins = (d: number) =>
    schedule.filter((e) => e.day === d && e.type === "study").reduce((sum, e) => sum + (toMinutes(e.end) - toMinutes(e.start)), 0);
  const weekHours = Math.round(DAYS.reduce((sum, _, i) => sum + studyMins(i), 0) / 6) / 10;

  const openAdd = () => {
    setEditing({ id: uid(), start: "19:00", end: "20:00", subject: "Self-Study", type: "study", day });
    setShowForm(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-[var(--text)]">Weekly timetable</h2>
          <p className="text-sm text-[var(--text-muted)]">~{weekHours || 0}h structured study per week.</p>
        </div>
        <button className="btn-secondary flex items-center gap-2 text-sm" onClick={openAdd}><Plus size={16} /> Add block</button>
      </div>

      {/* Day picker */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {DAYS_SHORT.map((d, i) => (
          <button key={d} onClick={() => setDay(i)}
            className={`shrink-0 px-4 py-2 rounded-2xl text-sm font-semibold transition-all ${i === day ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
            {d}
          </button>
        ))}
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 text-sm mb-4">
          <CalendarDays size={16} className="text-[var(--accent)]" />
          <span className="font-bold text-[var(--text)]">{DAYS[day]}</span>
          <ChevronLeft size={16} className="cursor-pointer hover:text-[var(--accent)] ml-auto" onClick={() => setDay((day + 6) % 7)} />
          <ChevronRight size={16} className="cursor-pointer hover:text-[var(--accent)]" onClick={() => setDay((day + 1) % 7)} />
        </div>

        <div className="space-y-1">
          {entries.length === 0 && <p className="text-center text-sm text-[var(--text-muted)] py-8">No blocks scheduled for {DAYS[day]}.</p>}
          {entries.map((entry) => {
            const style = TYPE_STYLE[entry.type];
            const mins = toMinutes(entry.end) - toMinutes(entry.start);
            return (
              <button key={entry.id} onClick={() => { setEditing({ ...entry }); setShowForm(true); }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/70 text-left transition-colors">
                <span className="text-[11px] font-mono px-2 py-1 rounded-xl bg-[var(--surface)] text-[var(--text-muted)] shrink-0">{entry.start}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] truncate">{entry.subject}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{entry.start}–{entry.end} · {mins} min</p>
                </div>
                <Tag color={style?.color}>{style?.label || entry.type}</Tag>
              </button>
            );
          })}
        </div>

        <button onClick={openAdd} className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent-soft)] transition-colors">
          <Plus size={16} /> Add to {DAYS[day]}
        </button>
      </div>

      {/* Week overview */}
      <div className="card p-6">
        <h3 className="font-bold text-[var(--text)] mb-4">Weekly study overview</h3>
        <div className="space-y-3">
          {DAYS.map((d, i) => {
            const mins = studyMins(i);
            const max = Math.max(...DAYS.map((_, di) => studyMins(di)), 60);
            const pct = max > 0 ? Math.round((mins / max) * 100) : 0;
            return (
              <div key={d} className="flex items-center gap-3">
                <span className="w-12 text-xs text-[var(--text-muted)]">{d.slice(0, 3)}</span>
                <div className="flex-1 h-3 bg-[var(--surface-2)] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[#a78bfa] transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-12 text-right text-xs text-[var(--text-muted)]">{Math.round((mins / 60) * 10) / 10}h</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit modal */}
      {showForm && editing && (
        <Modal onClose={() => setShowForm(false)} title={schedule.some((e) => e.id === editing.id) ? "Edit block" : "Add block"}>
          <ScheduleForm entry={editing} onSave={(next) => {
            const exists = schedule.some((e) => e.id === next.id);
            save(exists ? schedule.map((e) => (e.id === next.id ? next : e)) : [...schedule, next]);
            setShowForm(false);
          }} onDelete={(id) => { save(schedule.filter((e) => e.id !== id)); setShowForm(false); }} existing={schedule.some((e) => e.id === editing.id)} />
        </Modal>
      )}
    </div>
  );
}

function ScheduleForm({ entry, onSave, onDelete, existing }: {
  entry: ScheduleEntry;
  onSave: (e: ScheduleEntry) => void;
  onDelete: (id: string) => void;
  existing: boolean;
}) {
  const [e, setE] = useState<ScheduleEntry>(entry);
  const typeKeys = Object.keys(TYPE_STYLE);
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-[var(--text-muted)] mb-1">Subject / activity</label>
        <input value={e.subject} onChange={(ev) => setE({ ...e, subject: ev.target.value })}
          className="w-full px-3 py-2.5 rounded-2xl bg-[var(--surface-2)] text-[var(--text)] outline-none focus:ring-2 ring-[var(--accent-soft)]" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">Start</label>
          <input type="time" value={e.start} onChange={(ev) => setE({ ...e, start: ev.target.value })}
            className="w-full px-3 py-2.5 rounded-2xl bg-[var(--surface-2)] text-[var(--text)] outline-none" />
        </div>
        <div>
          <label className="block text-xs text-[var(--text-muted)] mb-1">End</label>
          <input type="time" value={e.end} onChange={(ev) => setE({ ...e, end: ev.target.value })}
            className="w-full px-3 py-2.5 rounded-2xl bg-[var(--surface-2)] text-[var(--text)] outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-[var(--text-muted)] mb-1">Type</label>
        <div className="flex flex-wrap gap-1.5">
          {typeKeys.map((tk) => (
            <button key={tk} onClick={() => setE({ ...e, type: tk as ScheduleEntry["type"] })}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${e.type === tk ? "text-white" : "bg-[var(--surface-2)] text-[var(--text-muted)]"}`}
              style={e.type === tk ? { background: TYPE_STYLE[tk].color } : {}}>
              {TYPE_STYLE[tk].label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3 pt-1">
        <button onClick={() => onSave(e)} className="btn flex-1 justify-center">Save</button>
        {existing && (
          <button onClick={() => onDelete(e.id)} className="btn px-5 !bg-red-500/15 !text-red-400 hover:!bg-red-500/25 justify-center"><Trash2 size={16} /></button>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- TASKS TAB ----------------------------- */
function TasksTab() {
  const [offset, setOffset] = useState(0);
  const [tasks, setTasks] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");

  const date = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  }, [offset]);

  useEffect(() => { setTasks(store.getTasks(date)); }, [date]);

  const save = (next: any[]) => { setTasks(next); store.setTasks(date, next); };
  const add = () => { if (!title.trim()) return; save([...tasks, { id: uid(), title: title.trim(), subject: subject || "General", done: false, createdAt: Date.now(), day: date }]); setTitle(""); };
  const toggle = (id: string) => save(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const remove = (id: string) => save(tasks.filter((t) => t.id !== id));
  const done = tasks.filter((t) => t.done).length;

  const chip = (d: Date, label: string, i: number) => {
    const iso = d.toISOString().split("T")[0];
    const active = iso === date;
    return (
      <button key={iso} onClick={() => setOffset(i)}
        className={`shrink-0 px-4 py-2 rounded-2xl text-sm transition-all ${active ? "bg-[var(--accent-soft)] text-[var(--accent)] font-semibold" : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]"}`}>
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {Array.from({ length: 7 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() + i);
          return chip(d, i === 0 ? "Today" : DAYS_SHORT[d.getDay()], i);
        })}
      </div>

      <div className="card p-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="e.g. Finish physics numericals"
            className="flex-1 px-4 py-3 rounded-2xl bg-[var(--surface-2)] text-[var(--text)] placeholder-[var(--text-muted)] outline-none focus:ring-2 ring-[var(--accent-soft)]" />
          <select value={subject} onChange={(e) => setSubject(e.target.value)}
            className="sm:w-44 px-4 py-3 rounded-2xl bg-[var(--surface-2)] text-[var(--text)] outline-none">
            <option value="">Subject</option>
            {defaultSubjects.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button onClick={add} className="btn justify-center sm:w-auto"><Plus size={16} /> Add</button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="card p-10 text-center">
          <CheckSquare size={32} className="text-[var(--text-muted)]/40 mx-auto mb-3" />
          <p className="text-[var(--text-muted)]">No tasks for this day. Add one to plan your study.</p>
        </div>
      ) : (
        <div className="card p-4 space-y-1">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-[var(--surface-2)] group transition-colors">
              <button onClick={() => toggle(task.id)} className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all ${task.done ? "bg-[#34d399] border-[#34d399]" : "border-[var(--border)] hover:border-[var(--accent)]"}`}>
                {task.done && <CheckSquare size={14} className="text-white" />}
              </button>
              <span className={`flex-1 text-sm ${task.done ? "line-through text-[var(--text-muted)]" : "text-[var(--text)]"}`}>{task.title}</span>
              <Tag color={SUBJECT_COLORS[task.subject]}>{task.subject}</Tag>
              <button onClick={() => remove(task.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
      {tasks.length > 0 && (
        <p className="text-sm text-[var(--text-muted)]">{done === tasks.length ? "🎉 All done today!" : `${tasks.length - done} task${tasks.length - done > 1 ? "s" : ""} left. Keep going!`}</p>
      )}
    </div>
  );
}

/* ----------------------------- PROGRESS TAB ----------------------------- */
function ProgressTab() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [goal, setGoal] = useState(120);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setSessions(store.getSessions());
    setGoal(store.getGoals());
    setStreak(store.getStreak().count);
  }, []);

  const stats = useMemo(() => {
    const total = sessions.reduce((a, s) => a + s.minutes, 0);
    const days = new Set(sessions.map((s) => s.date)).size;
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      last7.push({ label: d.toLocaleDateString("en-US", { weekday: "short" }), mins: sessions.filter((s) => s.date === iso).reduce((a, s) => a + s.minutes, 0) });
    }
    const subj: Record<string, number> = {};
    sessions.forEach((s) => { subj[s.subject] = (subj[s.subject] || 0) + s.minutes; });
    const subjectList = Object.entries(subj).sort((a, b) => b[1] - a[1]).map(([name, minutes]) => ({ name, minutes }));
    return { total, days, last7, subjectList, avg: days ? Math.round(total / days) : 0 };
  }, [sessions]);

  const max7 = Math.max(...stats.last7.map((d) => d.mins), 1);
  const maxSubj = Math.max(...stats.subjectList.map((s) => s.minutes), 1);
  const barColors = ["#f87171", "#a78bfa", "#60a5fa", "#22d3ee", "#f472b6", "#34d399"];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Flame size={22} />} label="Streak" value={`${streak} days`} />
        <StatCard icon={<Clock size={22} />} label="Total studied" value={`${stats.total} min`} />
        <StatCard icon={<TrendingUp size={22} />} label="Avg / day" value={`${stats.avg} min`} />
        <StatCard icon={<CheckSquare size={22} />} label="Active days" value={`${stats.days}`} />
      </div>

      <div className="card p-6">
        <h3 className="font-bold text-[var(--text)] mb-4 flex items-center gap-2"><TrendingUp size={20} className="text-[var(--accent)]" /> Last 7 days</h3>
        {stats.total === 0 ? (
          <p className="text-sm text-[var(--text-muted)] text-center py-8">Complete a focus session to see your chart.</p>
        ) : (
          <div className="flex items-end gap-3 h-40">
            {stats.last7.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5 justify-end">
                <span className="text-[10px] text-[var(--text-muted)]">{d.mins > 0 ? d.mins : ""}</span>
                <div className="w-full rounded-t-lg bg-gradient-to-t from-[var(--accent)] to-[#a78bfa] transition-all duration-500"
                  style={{ height: `${d.mins > 0 ? Math.max(8, (d.mins / max7) * 100) : 4}%` }} />
                <span className="text-[10px] text-[var(--text-muted)]">{d.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card p-6">
          <h3 className="font-bold text-[var(--text)] mb-4">Time by subject</h3>
          {stats.subjectList.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No data yet.</p> : (
            <div className="space-y-3">
              {stats.subjectList.slice(0, 6).map((s, i) => (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="w-24 truncate text-sm text-[var(--text)]">{s.name}</span>
                  <div className="flex-1 h-4 bg-[var(--surface-2)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(6, (s.minutes / maxSubj) * 100)}%`, background: barColors[i % barColors.length] }} />
                  </div>
                  <span className="w-16 text-right text-xs text-[var(--text-muted)]">{Math.round((s.minutes / 60) * 10) / 10}h</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6">
          <h3 className="font-bold text-[var(--text)] mb-4 flex items-center gap-2"><Target size={20} className="text-[var(--accent)]" /> Milestones</h3>
          <div className="space-y-2.5">
            {[{ mins: 360, label: "6 hours club 🏆" }, { mins: 300, label: "5 hours club 🌟" }, { mins: 240, label: "4 hours club 💪" }].map((m) => {
              const reached = stats.total >= m.mins;
              return (
                <div key={m.mins} className={`flex items-center gap-3 p-3 rounded-2xl border ${reached ? "border-amber-300/40 bg-amber-400/10" : "border-[var(--border)] bg-[var(--surface-2)]"}`}>
                  <Trophy size={20} className={reached ? "text-amber-400" : "text-[var(--text-muted)]/50"} />
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${reached ? "text-amber-500" : "text-[var(--text)]"}`}>{m.label}</p>
                    <p className="text-xs text-[var(--text-muted)]">{Math.min(stats.total, m.mins)}/{m.mins} minutes</p>
                  </div>
                  <div className="w-24 shrink-0"><ProgressBar value={(stats.total / m.mins) * 100} color={reached ? "#fbbf24" : "var(--accent)"} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Reusable Modal ----------------------------- */
function Modal({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg mb-4 text-[var(--text)]">{title}</h3>
        {children}
      </motion.div>
    </div>
  );
}