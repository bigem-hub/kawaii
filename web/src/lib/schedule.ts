/**
 * Types + display constants for the Schedule & Task Manager (Notion-style).
 * Values are stored on the server as: category, status, priority, tags[],
 * subtasks[], progress.
 */

export type ScheduleCategory = "homework" | "study" | "exam" | "personal" | "habit";
export type ScheduleStatus = "todo" | "in_progress" | "done";
export type SchedulePriority = "high" | "medium" | "low";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface ScheduleItem {
  id: string;
  userId: string;
  title: string;
  category: ScheduleCategory;
  status: ScheduleStatus;
  priority: SchedulePriority;
  subjectId: string | null;
  dueDate: string | null; // YYYY-MM-DD
  dueTime: string | null; // HH:mm
  date: string | null; // YYYY-MM-DD (time-blocking day)
  startTime: string | null; // HH:mm
  endTime: string | null; // HH:mm
  tags: string[];
  subtasks: Subtask[];
  progress: number; // 0-100 manual; derived from subtasks when present
  estimatedMinutes: number;
  notes: string;
  reminderAt: number | null;
  sortOrder: number;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Subject {
  id: string;
  name: string;
  shortName: string | null;
  teacher: string | null;
  room: string | null;
  color: string;
}

export const CATEGORY_KEYS: ScheduleCategory[] = ["homework", "study", "exam", "personal", "habit"];

export const SCHEDULE_CATEGORIES: Record<
  ScheduleCategory,
  { label: string; color: string; icon: string }
> = {
  homework: { label: "Homework", color: "#FF6B6B", icon: "📚" },
  study: { label: "Study", color: "#4ECDC4", icon: "🧠" },
  exam: { label: "Exams", color: "#F7DC6F", icon: "📝" },
  personal: { label: "Personal", color: "#BB8FCE", icon: "🗓️" },
  habit: { label: "Daily Habits", color: "#2ECC71", icon: "🌱" },
};

export function categoryInfo(cat: string): { label: string; color: string; icon: string } {
  return SCHEDULE_CATEGORIES[(cat as ScheduleCategory) in SCHEDULE_CATEGORIES ? (cat as ScheduleCategory) : "study"];
}

export const SCHEDULE_STATUSES: { value: ScheduleStatus; label: string }[] = [
  { value: "todo", label: "To-Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

export function statusLabel(status: string): string {
  return SCHEDULE_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export const PRIORITIES: Record<SchedulePriority, { label: string; color: string; bg: string }> = {
  high: { label: "High", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  medium: { label: "Medium", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  low: { label: "Low", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
};

export function priorityInfo(priority: string): { label: string; color: string; bg: string } {
  return (
    PRIORITIES[priority as SchedulePriority] ?? { label: priority, color: "#8a858b", bg: "rgba(138,133,139,0.12)" }
  );
}

/** Derive a 0-100 progress from completed subtasks (override with manual value). */
export function deriveProgress(subtasks: Subtask[], manual?: number): number {
  if (subtasks.length > 0) {
    const done = subtasks.filter((s) => s.completed).length;
    return Math.round((done / subtasks.length) * 100);
  }
  return manual ?? 0;
}

export function isOverdue(item: ScheduleItem): boolean {
  if (item.status === "done" || !item.dueDate) return false;
  const endOfDay = new Date(`${item.dueDate}T23:59:59`).getTime();
  return endOfDay < Date.now();
}

export function newSubtaskId(): string {
  return Math.random().toString(36).slice(2, 9);
}