#!/usr/bin/env node
/**
 * migrate-to-firebase.mjs
 *
 * One-time data migration from SQLite → Firebase Realtime Database.
 *
 * The server now runs on Firebase only, but this script migrates any data
 * that still lives in the old `server/data.db` SQLite file so nothing is
 * lost (this DB is currently empty — 4KB — so the main job is seeding the
 * default achievements, same as SQLite's initializeDatabase() did).
 *
 * PROPERTIES
 *  - Idempotent: safe to run repeatedly. Every table is processed with an
 *    "already exists / conflicts" guard and rows are only inserted where
 *    the destination node is absent. Nothing is overwritten.
 *  - Non-destructive: never calls set() on existing data. It only writes
 *    to paths that are currently empty (or via update() for seeding).
 *  - Resumable: tracks a marker at `_migration/state` recording which
 *    tables finished, so a crashed run picks up where it left off.
 *  - Conflict-detecting: reports rows that already exist with DIFFERENT
 *    data instead of silently overwriting them.
 *
 * USAGE
 *   FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' \
 *     node scripts/migrate-to-firebase.mjs [--force]
 *
 *   `--force` re-runs seeding steps (achievements) even if previously marked
 *   done — still never overwrites an existing non-null node.
 */
import "dotenv/config";
import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase } from "firebase-admin/database";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DB_PATH = path.resolve(ROOT, "server/data.db");

// ---------------------------------------------------------------------------
// Firebase init (same logic as server/src/firebase.ts)
// ---------------------------------------------------------------------------
const databaseUrl =
  process.env.FIREBASE_DATABASE_URL ||
  "https://kawaiilife-55132-default-rtdb.firebaseio.com/";

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT is invalid JSON. Pass the raw JSON string, not a path."
      );
    }
  }
  const saPath = path.resolve(ROOT, "server/service-account.json");
  if (fs.existsSync(saPath)) {
    return JSON.parse(fs.readFileSync(saPath, "utf-8"));
  }
  throw new Error(
    "No Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT env var or place server/service-account.json"
  );
}

const serviceAccount = getServiceAccount();
initializeApp({ credential: cert(serviceAccount), databaseURL: databaseUrl });
const db = getDatabase();

// ---------------------------------------------------------------------------
// SQLite access
// ---------------------------------------------------------------------------
if (!fs.existsSync(DB_PATH)) {
  console.warn("⚠️  No SQLite database found at", DB_PATH, "— nothing to migrate.");
  process.exit(0);
}
const sqlite = new Database(DB_PATH, { readonly: true });

/** Read one table's rows as plain objects (snake_case → camelCase NOT applied here).
 *  The SQLite schema columns are snake_case; we remap explicitly below. */
function tableRows(table) {
  const stmt = sqlite.prepare(`SELECT * FROM ${table}`);
  return stmt.all();
}

function hasTable(table) {
  const row = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(table);
  return !!row;
}

// ---------------------------------------------------------------------------
// Migration helpers
// ---------------------------------------------------------------------------
const MIGRATION_STATE = "_migration/state";

async function getState() {
  const snap = await db.ref(MIGRATION_STATE).once("value");
  return snap.val() || {};
}

async function setStateDone(table) {
  const state = await getState();
  state[table] = { doneAt: Date.now() };
  await db.ref(MIGRATION_STATE).set(state);
}

/** Deep equality with NO key-order dependence. Firebase RTDB alphabetizes
 *  object keys on write, so two logically-identical objects may differ in
 *  insertion order — JSON.stringify() would falsely report those as
 *  conflicts. This compares recursively instead. */
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return a === b;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

/** Write a single row into `{ table }/{ id }` ONLY if the node is absent.
 *  Returns 'created' | 'skipped-empty' | 'conflict' | 'identical'.
 *  Never overwrites existing data. */
async function writeIfAbsent(table, id, data) {
  const ref = db.ref(`${table}/${id}`);
  const snap = await ref.once("value");

  if (!snap.exists() || snap.val() === null) {
    await ref.set(data);
    return "created";
  }

  if (deepEqual(snap.val(), data)) {
    return "identical";
  }

  return "conflict";
}

/**
 * Migrate a nested table `{ tableName }/{ id }` → `{ parentTable }/{ parentId }/{ nestedPath }/{ id }`.
 * Requires the parent row to exist so we can nest under it. Idempotent, never overwrites.
 */
async function migrateNested(tableName, parentTable, parentIdField, remap) {
  if (!hasTable(tableName)) {
    console.log(`  [skip]  table ${tableName} does not exist in SQLite`);
    return;
  }
  const rows = tableRows(tableName);
  if (rows.length === 0) {
    console.log(`  [skip]  table ${tableName} is empty`);
    await setStateDone(tableName);
    return;
  }

  const state = await getState();
  if (state[tableName] && !process.argv.includes("--force")) {
    console.log(`  [done]  table ${tableName} already migrated — skipping`);
    return;
  }

  let created = 0,
    identical = 0,
    conflicts = 0,
    skipped = 0;
  const conflictRows = [];

  for (const row of rows) {
    const { id, ...fields } = remap(row);
    const parentId = fields[parentIdField];
    if (!id || !parentId) {
      skipped++;
      continue;
    }
    // Drop the parent FK from the stored object — it lives in the path.
    const { [parentIdField]: _parent, ...nestedFields } = fields;
    const path = `${parentTable}/${parentId}/${tableName}/${id}`;
    const result = await writeIfAbsentPath(path, nestedFields);
    if (result === "created") created++;
    else if (result === "identical") identical++;
    else if (result === "conflict") {
      conflicts++;
      conflictRows.push(`${parentId}/${id}`);
    }
  }

  console.log(
    `  [migrate] ${tableName} (nested under ${parentTable}): ${created} created, ${identical} identical, ${conflicts} conflicts, ${skipped} skipped`
  );
  if (conflictRows.length) {
    console.warn(`    ⚠️  CONFLICTS (existing data differs — not overwritten): ${conflictRows.join(", ")}`);
  }

  if (conflicts === 0) await setStateDone(tableName);
}

/** WriteIfAbsent but for an arbitrary path (nested destinations). */
async function writeIfAbsentPath(path, data) {
  const ref = db.ref(path);
  const snap = await ref.once("value");

  if (!snap.exists() || snap.val() === null) {
    await ref.set(data);
    return "created";
  }

  if (deepEqual(snap.val(), data)) {
    return "identical";
  }

  return "conflict";
}

async function migrateTable(tableName, remap, shouldSkip = () => false) {
  if (!hasTable(tableName)) {
    console.log(`  [skip]  table ${tableName} does not exist in SQLite`);
    return;
  }
  const rows = tableRows(tableName);
  if (rows.length === 0) {
    console.log(`  [skip]  table ${tableName} is empty`);
    await setStateDone(tableName);
    return;
  }

  // Done-at marker (resumable). --force re-checks.
  const state = await getState();
  if (state[tableName] && !process.argv.includes("--force")) {
    console.log(`  [done]  table ${tableName} already migrated — skipping`);
    return;
  }

  let created = 0,
    identical = 0,
    conflicts = 0,
    skipped = 0;
  const conflictRows = [];

  for (const row of rows) {
    if (shouldSkip(row)) {
      skipped++;
      continue;
    }
    const { id, ...fields } = remap(row);
    if (!id) {
      skipped++;
      continue;
    }
    const result = await writeIfAbsent(tableName, String(id), fields);
    if (result === "created") created++;
    else if (result === "identical") identical++;
    else if (result === "conflict") {
      conflicts++;
      conflictRows.push(id);
    }
  }

  console.log(
    `  [migrate] ${tableName}: ${created} created, ${identical} identical, ${conflicts} conflicts, ${skipped} skipped`
  );
  if (conflictRows.length) {
    console.warn(`    ⚠️  CONFLICTS (existing data differs — not overwritten): ${conflictRows.join(", ")}`);
  }

  if (conflicts === 0) await setStateDone(tableName);
}

// ---------------------------------------------------------------------------
// Column remappers (snake_case → camelCase, matching DB schema/DEFAULTS)
// ---------------------------------------------------------------------------
const remap = {
  users: (r) => ({
    id: r.id,
    email: r.email,
    username: r.username,
    displayName: r.display_name,
    passwordHash: r.password_hash,
    avatar: r.avatar,
    bio: r.bio,
    emailVerified: r.email_verified,
    provider: r.provider,
    online: r.online,
    lastSeen: r.last_seen,
    xp: r.xp,
    level: r.level,
    streak: r.streak,
    longestStreak: r.longest_streak,
    lastActivityDate: r.last_activity_date,
    createdAt: r.created_at,
  }),

  userProfiles: (r) => ({
    id: r.user_id, // keyed by user_id (matches /users/{id}/profile nesting)
    theme: r.theme,
    accentColor: r.accent_color,
    uiDensity: r.ui_density,
    animations: r.animations,
    profileVisibility: r.profile_visibility,
    onlineStatusVisible: r.online_status_visible,
    friendRequestsOpen: r.friend_requests_open,
    showFitness: r.show_fitness,
    showNotes: r.show_notes,
    showStats: r.show_stats,
    notifPush: r.notif_push,
    notifEmail: r.notif_email,
    notifChat: r.notif_chat,
    notifReminders: r.notif_reminders,
    dashboardWidgets: r.dashboard_widgets,
  }),

  categories: (r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    color: r.color,
    icon: r.icon,
    isDefault: r.is_default,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }),

  tasks: (r) => ({
    id: r.id,
    userId: r.user_id,
    categoryId: r.category_id,
    title: r.title,
    description: r.description,
    notes: r.notes,
    priority: r.priority,
    status: r.status,
    completed: r.completed,
    completedAt: r.completed_at,
    dueDate: r.due_date,
    startDate: r.start_date,
    tags: r.tags,
    recurring: r.recurring,
    reminderAt: r.reminder_at,
    reminderSent: r.reminder_sent,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }),

  subtasks: (r) => ({
    id: r.id,
    taskId: r.task_id, // stored nested: tasks/{taskId}/subtasks/{id}
    title: r.title,
    completed: r.completed,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }),

  notes: (r) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    content: r.content,
    contentText: r.content_text,
    type: r.type,
    categoryId: r.category_id,
    tags: r.tags,
    pinned: r.pinned,
    archived: r.archived,
    favorite: r.favorite,
    shareStatus: r.share_status,
    studyHours: r.study_hours,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }),

  noteShares: (r) => ({
    id: r.id,
    noteId: r.note_id,
    sharedBy: r.shared_by,
    userId: r.user_id,
    shareLink: r.share_link,
    permission: r.permission,
    createdAt: r.created_at,
  }),

  noteComments: (r) => ({
    id: r.id,
    noteId: r.note_id, // stored nested: notes/{noteId}/comments/{id}
    userId: r.user_id,
    content: r.content,
    mentions: r.mentions,
    createdAt: r.created_at,
  }),

  friendRequests: (r) => ({
    id: r.id,
    fromUserId: r.from_user_id,
    toUserId: r.to_user_id,
    status: r.status,
    createdAt: r.created_at,
  }),

  friendships: (r) => ({
    id: `${r.user_id}_${r.friend_id}`, // path-based: friendships/{userId}/{friendId}
    userId: r.user_id,
    friendId: r.friend_id,
    createdAt: r.created_at,
  }),

  blockedUsers: (r) => ({
    id: `${r.user_id}_${r.blocked_id}`, // path-based: blockedUsers/{userId}/{blockedId}
    userId: r.user_id,
    blockedId: r.blocked_id,
    createdAt: r.created_at,
  }),

  socialLinks: (r) => ({
    id: r.id,
    userId: r.user_id,
    platform: r.platform,
    url: r.url,
    label: r.label,
    sortOrder: r.sort_order,
  }),

  conversations: (r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    avatar: r.avatar,
    createdBy: r.created_by,
    createdAt: r.created_at,
  }),

  conversationMembers: (r) => ({
    id: `${r.conversation_id}_${r.user_id}`, // composite key
    conversationId: r.conversation_id,
    userId: r.user_id,
    role: r.role,
    lastReadAt: r.last_read_at,
    joinedAt: r.joined_at,
  }),

  messages: (r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    type: r.type,
    content: r.content,
    replyTo: r.reply_to,
    fileUrl: r.file_url,
    fileName: r.file_name,
    fileType: r.file_type,
    edited: r.edited,
    pinned: r.pinned,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }),

  messageReactions: (r) => ({
    id: r.id,
    messageId: r.message_id,
    userId: r.user_id,
    emoji: r.emoji,
    createdAt: r.created_at,
  }),

  fitnessEntries: (r) => ({
    id: r.id,
    userId: r.user_id,
    date: r.date,
    weight: r.weight,
    height: r.height,
    calories: r.calories,
    steps: r.steps,
    distanceKm: r.distance_km,
    activeMinutes: r.active_minutes,
    source: r.source,
    createdAt: r.created_at,
  }),

  cardioEntries: (r) => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    date: r.date,
    durationMin: r.duration_min,
    distanceKm: r.distance_km,
    calories: r.calories,
    avgSpeed: r.avg_speed,
    pace: r.pace,
    heartRate: r.heart_rate,
    notes: r.notes,
    createdAt: r.created_at,
  }),

  workoutRoutines: (r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    description: r.description,
    color: r.color,
    icon: r.icon,
    createdAt: r.created_at,
  }),

  workoutExercises: (r) => ({
    id: r.id,
    routineId: r.routine_id, // nested: workoutRoutines/{id}/exercises/{id}
    name: r.name,
    targetSets: r.target_sets,
    targetReps: r.target_reps,
    restSeconds: r.rest_seconds,
    sortOrder: r.sort_order,
  }),

  workoutSessions: (r) => ({
    id: r.id,
    userId: r.user_id,
    routineId: r.routine_id,
    name: r.name,
    date: r.date,
    durationMin: r.duration_min,
    calories: r.calories,
    notes: r.notes,
    createdAt: r.created_at,
  }),

  workoutSets: (r) => ({
    id: r.id,
    sessionId: r.session_id, // nested: workoutSessions/{id}/sets/{id}
    exerciseName: r.exercise_name,
    setNumber: r.set_number,
    reps: r.reps,
    weightKg: r.weight_kg,
    done: r.done,
    sortOrder: r.sort_order,
  }),

  events: (r) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    type: r.type,
    start: r.start,
    end: r.end,
    allDay: r.all_day,
    location: r.location,
    description: r.description,
    color: r.color,
    linkedTaskId: r.linked_task_id,
    createdAt: r.created_at,
  }),

  reminders: (r) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    datetime: r.datetime,
    repeat: r.repeat,
    completed: r.completed,
    sent: r.sent,
    linkedTaskId: r.linked_task_id,
    createdAt: r.created_at,
  }),

  notifications: (r) => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    title: r.title,
    body: r.body,
    data: r.data,
    read: r.read,
    createdAt: r.created_at,
  }),

  watchRooms: (r) => ({
    id: r.id,
    code: r.code,
    hostId: r.host_id,
    name: r.name,
    mediaUrl: r.media_url,
    mediaProvider: r.media_provider,
    mediaId: r.media_id,
    isPlaying: r.is_playing,
    currentTime: r.current_time,
    privacy: r.privacy,
    active: r.active,
    createdAt: r.created_at,
  }),

  watchRoomMembers: (r) => ({
    id: `${r.room_id}_${r.user_id}`, // composite key
    roomId: r.room_id,
    userId: r.user_id,
    role: r.role,
    joinedAt: r.joined_at,
  }),

  watchMessages: (r) => ({
    id: r.id,
    roomId: r.room_id,
    userId: r.user_id,
    content: r.content,
    createdAt: r.created_at,
  }),

  achievements: (r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    icon: r.icon,
  }),

  userAchievements: (r) => ({
    id: `${r.user_id}_${r.achievement_id}`, // composite key
    userId: r.user_id,
    achievementId: r.achievement_id,
    earnedAt: r.earned_at,
  }),
};

// ---------------------------------------------------------------------------
// Seed achievements (the only populated step for current empty DB)
// ---------------------------------------------------------------------------
const DEFAULT_ACHIEVEMENTS = [
  { id: "ach_first_task", code: "first_task", name: "First Steps", description: "Completed your first task", icon: "✅" },
  { id: "ach_7_streak", code: "7_streak", name: "On Fire!", description: "7-day productivity streak", icon: "🔥" },
  { id: "ach_100_tasks", code: "100_tasks", name: "Century", description: "Completed 100 tasks", icon: "💯" },
  { id: "ach_first_workout", code: "first_workout", name: "Getting Started", description: "Completed your first workout", icon: "💪" },
  { id: "ach_10_workouts", code: "10_workouts", name: "Fitness Fanatic", description: "Completed 10 workouts", icon: "🏋️" },
  { id: "ach_note_master", code: "note_master", name: "Note Master", description: "Created 50 notes", icon: "📒" },
  { id: "ach_30_streak", code: "30_streak", name: "Unstoppable!", description: "30-day productivity streak", icon: "🌟" },
  { id: "ach_social_butterfly", code: "social_butterfly", name: "Social Butterfly", description: "Added 5 friends", icon: "🦋" },
  { id: "ach_first_chat", code: "first_chat", name: "Chatterbox", description: "Sent your first message", icon: "💬" },
  { id: "ach_watch_party", code: "watch_party", name: "Party Time!", description: "Joined a watch party", icon: "🎬" },
  { id: "ach_early_bird", code: "early_bird", name: "Early Bird", description: "Completed a task before 8am", icon: "🐦" },
  { id: "ach_night_owl", code: "night_owl", name: "Night Owl", description: "Completed a task after midnight", icon: "🦉" },
];

async function seedAchievements() {
  console.log("\n📦 Seeding default achievements…");
  let created = 0,
    conflicts = 0;
  for (const a of DEFAULT_ACHIEVEMENTS) {
    const result = await writeIfAbsent("achievements", a.id, {
      code: a.code,
      name: a.name,
      description: a.description,
      icon: a.icon,
    });
    if (result === "created") {
      created++;
      console.log(`  + ${a.id} (${a.name})`);
    } else if (result === "conflict") {
      conflicts++;
      console.warn(`  ⚠️  ${a.id} already exists with different data — left untouched`);
    }
  }
  console.log(`  achievements: ${created} created, ${conflicts} conflicts`);
  // During global seed, note: achievements is a "created" case, no conflict, still mark.
  await setStateDone("achievements");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const STATE_TABLE_DONE = ["achievements"];

async function main() {
  console.log("🌸 KawaiiLife → Firebase migration");
  console.log(`   SQLite DB: ${DB_PATH}`);
  console.log(`   Firebase:  ${databaseUrl}`);
  console.log("   (idempotent — safe to re-run, never overwrites existing data)\n");

  const state = await getState();

  // 1) Tables where existing SQLite data is migrated
  const tables = Object.keys(remap);
  if (hasTable("users")) {
    console.log("── User-scoped tables ──");
    // Order matters: parents first so FK references resolve.
    const ordered = [
      "users",
      "userProfiles",
      "categories",
      "tasks",
      "notes",
      "noteShares",
      "friendRequests",
      "friendships",
      "blockedUsers",
      "socialLinks",
      "conversations",
      "conversationMembers",
      "messages",
      "fitnessEntries",
      "cardioEntries",
      "workoutRoutines",
      "workoutSessions",
      "events",
      "reminders",
      "notifications",
      "watchRooms",
      "watchRoomMembers",
      "watchMessages",
      "userAchievements",
    ];
    for (const t of ordered) {
      if (tables.includes(t)) await migrateTable(t, remap[t]);
    }

    // Nested children — stored under their parent node for real cascades.
    console.log("── Nested child tables ──");
    await migrateNested("subtasks", "tasks", "taskId", remap.subtasks);
    await migrateNested("noteComments", "notes", "noteId", remap.noteComments);
    await migrateNested("messageReactions", "messages", "messageId", remap.messageReactions);
    await migrateNested("workoutExercises", "workoutRoutines", "routineId", remap.workoutExercises);
    await migrateNested("workoutSets", "workoutSessions", "sessionId", remap.workoutSets);
  }

  // 2) Global seed (achievements) — always run, idempotent
  await seedAchievements();

  console.log("\n✅ Migration complete");
  console.log("   Re-run any time — already-migrated rows are skipped.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Migration failed:", err.message);
    process.exit(1);
  });