// StudyPulse data layer — localStorage store + cross-device server sync for kawaii.
// Focus sessions, streak and XP are persisted to kawaii's Firebase backend via the
// existing /api/schedule/study-sessions + /api/tasks/stats endpoints, so your phone
// and laptop share one study timeline. localStorage remains as an offline cache.
import { api } from "./api";

export type ServerSession = {
  id: string;
  title: string;
  topic: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  durationMinutes: number;
  status: string; // planned | completed
  subjectId: string | null;
};

export interface Task {
  id: string;
  title: string;
  subject: string;
  done: boolean;
  createdAt: number;
  day: string; // ISO date YYYY-MM-DD
}

export interface ScheduleEntry {
  id: string;
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  subject: string;
  type: "class" | "study" | "break" | "self" | "meals" | "commute";
  notes?: string;
  day: number; // 0-6, 0 = Sunday (Nepal week starts Sunday)
}

export interface StudySession {
  id: string;
  subject: string;
  minutes: number;
  date: string; // ISO date
  completed: boolean;
}

const KEYS = {
  tasks: "pulse_tasks",
  schedule: "pulse_schedule_v2",
  sessions: "pulse_sessions",
  streak: "pulse_streak",
  goals: "pulse_goals",
  starredQuotes: "pulse_starred",
};

function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet<T>(key: string, value: T) {
  try {
    if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("Failed to save data", e);
  }
}

export const store = {
  getTasks(day: string): Task[] {
    return safeGet<Task[]>(KEYS.tasks, []).filter((t) => t.day === day);
  },
  setTasks(day: string, tasks: Task[]) {
    const all = safeGet<Task[]>(KEYS.tasks, []);
    const others = all.filter((t) => t.day !== day);
    safeSet(KEYS.tasks, [...others, ...tasks]);
  },
  getSchedule(): ScheduleEntry[] {
    return safeGet<ScheduleEntry[]>(KEYS.schedule, defaultSchedule);
  },
  setSchedule(schedule: ScheduleEntry[]) {
    safeSet(KEYS.schedule, schedule);
  },
  getSessions(): StudySession[] {
    return safeGet<StudySession[]>(KEYS.sessions, []);
  },
  addSession(session: StudySession) {
    const all = safeGet<StudySession[]>(KEYS.sessions, []);
    safeSet(KEYS.sessions, [...all, session]);
  },
  getStreak() {
    return safeGet(KEYS.streak, { count: 0, lastDate: "" });
  },
  setStreak(s: { count: number; lastDate: string }) {
    safeSet(KEYS.streak, s);
  },
  getGoals(): number {
    return safeGet(KEYS.goals, 120);
  },
  setGoals(g: number) {
    safeSet(KEYS.goals, g);
  },
  getStarred(): string[] {
    return safeGet<string[]>(KEYS.starredQuotes, []);
  },
  toggleStarred(quote: string) {
    const starred = safeGet<string[]>(KEYS.starredQuotes, []);
    const idx = starred.indexOf(quote);
    if (idx > -1) starred.splice(idx, 1);
    else starred.push(quote);
    safeSet(KEYS.starredQuotes, starred);
  },
};

export const defaultSchedule: ScheduleEntry[] = [
  { id: "wake-1", start: "05:45", end: "06:45", subject: "Morning Self-Study", type: "study", day: 1 },
  { id: "commute-out-1", start: "07:00", end: "09:40", subject: "Commute + Revise Notes", type: "commute", day: 1 },
  { id: "class-1", start: "09:40", end: "13:00", subject: "College — Science", type: "class", day: 1 },
  { id: "lunch-1", start: "13:00", end: "13:30", subject: "Lunch Break", type: "meals", day: 1 },
  { id: "class-2", start: "13:30", end: "17:00", subject: "College — Science + CS", type: "class", day: 1 },
  { id: "class-3", start: "17:00", end: "18:30", subject: "College / Activities", type: "class", day: 1 },
  { id: "commute-home-1", start: "18:30", end: "19:00", subject: "Travel Home", type: "commute", day: 1 },
  { id: "dinner-1", start: "19:00", end: "20:00", subject: "Dinner & Rest", type: "meals", day: 1 },
  { id: "evening-1", start: "20:00", end: "22:00", subject: "Evening Deep Study — Math/Physics", type: "study", day: 1 },
  { id: "plan-1", start: "22:00", end: "22:30", subject: "Plan Tomorrow", type: "self", day: 1 },
  { id: "sleep-1", start: "22:30", end: "23:00", subject: "Wind Down & Sleep", type: "self", day: 1 },
  // Repeat the same pattern Mon-Fri (day 1..5)
  { id: "wake-2", start: "05:45", end: "06:45", subject: "Morning Self-Study", type: "study", day: 2 },
  { id: "class-2-2", start: "09:40", end: "18:00", subject: "College", type: "class", day: 2 },
  { id: "evening-2", start: "20:00", end: "22:00", subject: "Evening Deep Study", type: "study", day: 2 },
  { id: "wake-3", start: "05:45", end: "06:45", subject: "Morning Self-Study", type: "study", day: 3 },
  { id: "class-3-3", start: "09:40", end: "18:00", subject: "College", type: "class", day: 3 },
  { id: "evening-3", start: "20:00", end: "22:00", subject: "Evening Deep Study", type: "study", day: 3 },
  { id: "wake-4", start: "05:45", end: "06:45", subject: "Morning Self-Study", type: "study", day: 4 },
  { id: "class-4-4", start: "09:40", end: "18:00", subject: "College", type: "class", day: 4 },
  { id: "evening-4", start: "20:00", end: "22:00", subject: "Evening Deep Study", type: "study", day: 4 },
  { id: "wake-5", start: "05:45", end: "06:45", subject: "Morning Self-Study", type: "study", day: 5 },
  { id: "class-5-5", start: "09:40", end: "16:00", subject: "College", type: "class", day: 5 },
  { id: "evening-5", start: "20:00", end: "22:00", subject: "Deep Study — Revision", type: "study", day: 5 },
];

export const defaultSubjects = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "Computer Science",
  "English",
  "Nepali",
  "Biology",
  "Revision",
  "Practice",
];

export const quotes = [
  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "The best way to predict your future is to create it.", author: "Abraham Lincoln" },
  { text: "Success doesn't come to you, you go to it.", author: "Marva Collins" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Education is the most powerful weapon you can use to change the world.", author: "Nelson Mandela" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "तिमी आज गर्ने मिहिनेत नै भोलिको सफलताको जग हो।", author: "Nepali Proverb" },
  { text: "Push yourself because no one else is going to do it for you.", author: "Unknown" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Stephen Richards" },
];

// ---- Helpers ----
export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function getDayNumber(): number {
  return new Date().getDay(); // 0=Sun ... 6=Sat (matches Nepal Sunday week start)
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function nMin(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 11);
}

// ---------------------------------------------------------------------------
// Cross-device server sync (kawaii Firebase backend)
// ---------------------------------------------------------------------------

/** Format a Date as "HH:MM" for the API. */
function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Log a completed focus session to the server via the existing
 * /api/schedule/study-sessions endpoint. Creating it then marking it
 * "completed" triggers kawaii's server-side XP + streak update, so the
 * streak advances and is visible on every device.
 */
export async function syncFocusSession(subject: string, minutes: number): Promise<boolean> {
  const today = todayISO();
  const end = new Date();
  const start = new Date(end.getTime() - minutes * 60000);
  try {
    const created = await api.post<ServerSession>("/schedule/study-sessions", {
      title: subject,
      topic: "",
      date: today,
      startTime: hhmm(start),
      endTime: hhmm(end),
      priority: "high",
      notes: "StudyPulse focus session",
      status: "planned",
    });
    // Mark completed to award XP and advance the streak server-side.
    await api.patch(`/schedule/study-sessions/${created.id}`, { status: "completed" });
    // Cache locally for offline resilience
    store.addSession({ id: created.id, subject, minutes, date: today, completed: true });
    return true;
  } catch (e) {
    console.error("syncFocusSession failed — keeping local copy", e);
    store.addSession({ id: uid(), subject, minutes, date: today, completed: true });
    return false;
  }
}

/** Normalize a server study-session into the local StudySession shape. */
export function toLocalSession(s: ServerSession): StudySession {
  return {
    id: s.id,
    subject: s.title || "Study",
    minutes: s.durationMinutes || 0,
    date: s.date,
    completed: s.status === "completed",
  };
}

/**
 * Load all study focus sessions from the server. Falls back to the local
 * cache when offline or unauthenticated.
 */
export async function fetchServerSessions(): Promise<StudySession[]> {
  try {
    const rows = await api.get<ServerSession[]>("/schedule/study-sessions");
    const sessions = (rows || []).map(toLocalSession);
    // Merge with any locally-cached sessions not on the server yet
    const ids = new Set(sessions.map((s) => s.id));
    for (const local of store.getSessions()) {
      if (!ids.has(local.id)) sessions.push(local);
    }
    try {
      localStorage.setItem("pulse_sessions", JSON.stringify(sessions));
    } catch { /* ignore */ }
    return sessions;
  } catch {
    return store.getSessions();
  }
}

/** Fetch the user's current streak (uses existing /api/tasks/stats). */
export async function fetchServerStreak(): Promise<number> {
  try {
    const stats = await api.get<{ streak?: number }>("/tasks/stats");
    if (typeof stats?.streak === "number") return stats.streak;
    // Fall back to the user record fields if available
    const me = await api.get<{ streak?: number }>("/auth/me").catch(() => null);
    return me?.streak ?? 0;
  } catch {
    return store.getStreak().count;
  }
}