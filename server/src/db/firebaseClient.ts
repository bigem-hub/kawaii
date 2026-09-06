/**
 * firebaseClient — data access layer for Firebase Realtime Database.
 *
 * Replaces the Drizzle SQLite `db` object across all routes. Every method is
 * async and mirrors the row semantics the routes rely on:
 *   - getById(table, id)      → { id, ...fields } or null
 *   - findMany(table, child, value) → [{ id, ...fields }, ...]
 *   - findOne(...)            → first match or null
 *   - setRow / updateRow / removeRow / pushRow
 *
 * IDs live in the path (`/users/{id}`), not in the stored object. When
 * reading, the key is re-attached as `id` so route code that uses `.id`
 * keeps working unchanged.
 *
 * Nested tables (subtasks, comments, reactions, exercises, sets) are stored
 * under their parent node and expanded into row objects with the parent's FK
 * attached by the route (e.g. a subtask read from `/tasks/{t}/subtasks/{s}`
 * is returned with `taskId`) so response shapes match the old SQLite rows.
 */
import { getDB } from "../firebase.js";
import type { DataSnapshot } from "firebase-admin/database";

// ---------------------------------------------------------------------------
// Low-level access
// ---------------------------------------------------------------------------

/** Read whatever is at a path (null if nothing). */
export async function getAt(path: string): Promise<any> {
  const snap = await getDB().ref(path).once("value");
  return snap.val();
}

/** Set (overwrite) the entire node at a path. Use only for known-new keys. */
export async function setAt(path: string, data: unknown): Promise<void> {
  await getDB().ref(path).set(data);
}

/** Merge `data` into the node at a path (non-destructive). */
export async function updateAt(path: string, data: Record<string, unknown>): Promise<void> {
  await getDB().ref(path).update(data);
}

/** Delete the node at a path. */
export async function removeAt(path: string): Promise<void> {
  await getDB().ref(path).remove();
}

// ---------------------------------------------------------------------------
// Table helpers
// ---------------------------------------------------------------------------

/** Convert a `{ key: object }` snapshot map into `[{ id, ...object }]`. */
export function snapToRows(snap: DataSnapshot): any[] {
  const val = snap.val();
  if (!val || typeof val !== "object") return [];
  const rows: any[] = [];
  for (const [key, data] of Object.entries(val)) {
    if (data !== null && typeof data === "object") {
      rows.push({ id: key, ...(data as any) });
    } else {
      rows.push({ id: key, value: data });
    }
  }
  return rows;
}

/** Convert a plain object map into `[{ id, ...object }, ...]` (for nested reads). */
export function mapToRows(map: Record<string, any> | null, extra: Record<string, any> = {}): any[] {
  if (!map) return [];
  return Object.entries(map).map(([id, d]) => {
    const base: any = { id };
    if (d !== null && typeof d === "object") Object.assign(base, d);
    else base.value = d;
    Object.assign(base, extra);
    return base;
  });
}

/** Get a single row `{ id, ...fields }` or null. */
export async function getById(table: string, id: string): Promise<any | null> {
  const snap = await getDB().ref(`${table}/${id}`).once("value");
  if (!snap.exists()) return null;
  const val = snap.val();
  if (val && typeof val === "object") return { id, ...val };
  return { id, value: val };
}

/** List every row in a collection. */
export async function findAll(table: string): Promise<any[]> {
  const snap = await getDB().ref(table).once("value");
  return snapToRows(snap);
}

/** Query rows where `child` equals `value`. */
export async function findMany(table: string, child: string, value: unknown): Promise<any[]> {
  const snap = await getDB()
    .ref(table)
    .orderByChild(child)
    .equalTo(value as string | number | boolean | null)
    .once("value");
  return snapToRows(snap);
}

/** First row where `child` equals `value`, or null. */
export async function findOne(table: string, child: string, value: unknown): Promise<any | null> {
  const snap = await getDB()
    .ref(table)
    .orderByChild(child)
    .equalTo(value as string | number | boolean | null)
    .limitToFirst(1)
    .once("value");
  return snapToRows(snap)[0] ?? null;
}

/** Create/overwrite `{ table }/{ id }` with `data`. */
export async function setRow(table: string, id: string, data: unknown): Promise<void> {
  await setAt(`${table}/${id}`, data);
}

/** Merge `data` into `{ table }/{ id }`. */
export async function updateRow(table: string, id: string, data: Record<string, unknown>): Promise<void> {
  await updateAt(`${table}/${id}`, data);
}

/** Delete `{ table }/{ id }`. */
export async function removeRow(table: string, id: string): Promise<void> {
  await removeAt(`${table}/${id}`);
}

/** Push a new auto-keyed child and return its key. */
export async function pushRow(table: string, data: unknown): Promise<string> {
  const ref = getDB().ref(table).push();
  await ref.set(data);
  return ref.key as string;
}

// ---------------------------------------------------------------------------
// Defaults / hydration
//
// SQLite schemas store every column with a default (including NULL). Firebase
// omits unset keys, so readings would drop defaults unless we re-attach them.
// These maps let reads return rows identical to the old SQLite rows.
// ---------------------------------------------------------------------------

const userProfileDefaults = {
  theme: "light",
  accentColor: "#FF8FAB",
  uiDensity: "comfortable",
  animations: true,
  profileVisibility: "public",
  onlineStatusVisible: true,
  friendRequestsOpen: true,
  showFitness: false,
  showNotes: false,
  showStats: true,
  notifPush: true,
  notifEmail: true,
  notifChat: true,
  notifReminders: true,
  dashboardWidgets:
    "greeting,todayTasks,progress,reminders,quickNotes,study,fitness,cardio,chat,sharedNotes,events,watch,streak,motivation",
};

const DEFAULTS: Record<string, Record<string, any>> = {
  users: {
    bio: "",
    emailVerified: false,
    provider: "email",
    online: false,
    lastSeen: 0,
    xp: 0,
    level: 1,
    streak: 0,
    longestStreak: 0,
    lastActivityDate: null,
    passwordHash: null,
    avatar: null,
  },
  categories: { color: "#FF8FAB", icon: "📁", isDefault: false, sortOrder: 0 },
  tasks: {
    categoryId: null,
    description: "",
    notes: "",
    priority: "none",
    status: "pending",
    completed: false,
    completedAt: null,
    dueDate: null,
    startDate: null,
    tags: "[]",
    recurring: "none",
    reminderAt: null,
    reminderSent: false,
    sortOrder: 0,
  },
  notes: {
    title: "Untitled note",
    content: "",
    contentText: "",
    type: "note",
    categoryId: null,
    tags: "[]",
    pinned: false,
    archived: false,
    favorite: false,
    shareStatus: "private",
    studyHours: 0,
  },
  subtasks: { completed: false },
  noteShares: { userId: null, shareLink: null, permission: "view" },
  noteComments: { mentions: "[]" },
  friendRequests: { status: "pending" },
  socialLinks: { label: "", sortOrder: 0 },
  conversations: { type: "direct", name: null, avatar: null, createdBy: null },
  conversationMembers: { role: "member", lastReadAt: 0 },
  messages: {
    type: "text",
    content: "",
    replyTo: null,
    fileUrl: null,
    fileName: null,
    fileType: null,
    edited: false,
    pinned: false,
  },
  fitnessEntries: {
    weight: null,
    height: null,
    calories: null,
    steps: null,
    distanceKm: null,
    activeMinutes: null,
    source: "manual",
  },
  cardioEntries: {
    type: "running",
    distanceKm: 0,
    calories: 0,
    avgSpeed: null,
    pace: null,
    heartRate: null,
    notes: "",
  },
  workoutRoutines: { description: "", color: "#FF8FAB", icon: "💪" },
  workoutSessions: { routineId: null, durationMin: 0, calories: 0, notes: "" },
  events: {
    type: "event",
    end: null,
    allDay: false,
    location: "",
    description: "",
    color: "#FF8FAB",
    linkedTaskId: null,
  },
  reminders: { repeat: "none", completed: false, sent: false, linkedTaskId: null },
  notifications: { body: "", data: "{}", read: false },
  watchRooms: {
    name: "Watch Party",
    mediaUrl: "",
    mediaProvider: "",
    mediaId: "",
    isPlaying: false,
    currentTime: 0,
    privacy: "private",
    active: true,
  },
  watchRoomMembers: { role: "member" },
  achievements: { icon: "🏆" },
};

function deepMergeDefaults(defs: Record<string, any>, row: any): any {
  const out: any = { ...row };
  for (const [k, v] of Object.entries(defs)) {
    if (out[k] === undefined) {
      // Nested profile object
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if (out[k] === null) out[k] = v;
        else out[k] = { ...v, ...(out[k] || {}) };
      } else {
        out[k] = v;
      }
    }
  }
  if (row.profile !== undefined && row.profile !== null) {
    out.profile = { ...userProfileDefaults, ...row.profile };
  }
  return out;
}

/** Attach SQLite-equivalent defaults to a read row. */
export function hydrate(table: string, row: any): any {
  if (!row) return row;
  const defs = DEFAULTS[table];
  if (!defs) return row;
  return deepMergeDefaults(defs, row);
}

/** user profile defaults, used when creating new users. */
export function defaultProfile(): Record<string, any> {
  return { ...userProfileDefaults };
}

// ---------------------------------------------------------------------------
// Nested help
// ---------------------------------------------------------------------------

/** Read nested rows under `path` as `[{ id, ...fields, ...extra }]`. */
export async function getNested(path: string, extra: Record<string, any> = {}): Promise<any[]> {
  const map = await getAt(path);
  return mapToRows(map, extra);
}

/** Read a specific nested child at `path` (null-safe). */
export async function getNestedOne(path: string): Promise<any | null> {
  const val = await getAt(path);
  if (val === null || val === undefined) return null;
  if (typeof val === "object") return val;
  return { value: val };
}