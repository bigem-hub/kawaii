import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";

// ---------- Timestamp helpers (store ms since epoch) ----------
const now = () => sql`(unixepoch() * 1000)`;

// ============================================================
// USERS
// ============================================================
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash"),
    avatar: text("avatar"),
    bio: text("bio").default(""),
    emailVerified: integer("email_verified", { mode: "boolean" }).default(false),
    provider: text("provider").default("email"), // email | google
    online: integer("online", { mode: "boolean" }).default(false),
    lastSeen: integer("last_seen").default(0),
    xp: integer("xp").default(0),
    level: integer("level").default(1),
    streak: integer("streak").default(0),
    longestStreak: integer("longest_streak").default(0),
    lastActivityDate: text("last_activity_date"),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    usernameIdx: uniqueIndex("users_username_idx").on(t.username),
  })
);

export const userProfiles = sqliteTable("user_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  // Appearance / customization
  theme: text("theme").default("light"), // light | dark | system
  accentColor: text("accent_color").default("#FF8FAB"), // pastel pink default
  uiDensity: text("ui_density").default("comfortable"),
  animations: integer("animations", { mode: "boolean" }).default(true),
  // Privacy
  profileVisibility: text("profile_visibility").default("public"), // public | friends | private
  onlineStatusVisible: integer("online_status_visible", { mode: "boolean" }).default(true),
  friendRequestsOpen: integer("friend_requests_open", { mode: "boolean" }).default(true),
  showFitness: integer("show_fitness", { mode: "boolean" }).default(false),
  showNotes: integer("show_notes", { mode: "boolean" }).default(false),
  showStats: integer("show_stats", { mode: "boolean" }).default(true),
  // Notifications preferences
  notifPush: integer("notif_push", { mode: "boolean" }).default(true),
  notifEmail: integer("notif_email", { mode: "boolean" }).default(true),
  notifChat: integer("notif_chat", { mode: "boolean" }).default(true),
  notifReminders: integer("notif_reminders", { mode: "boolean" }).default(true),
  // Dashboard customization (comma-separated widget ids)
  dashboardWidgets: text("dashboard_widgets").default(
    "greeting,todayTasks,progress,reminders,quickNotes,study,fitness,cardio,chat,sharedNotes,events,watch,streak,motivation"
  ),
});

export const userSessions = sqliteTable("user_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  device: text("device").default("Unknown device"),
  ip: text("ip"),
  createdAt: integer("created_at").notNull().default(now()),
  expiresAt: integer("expires_at").notNull(),
});

// ============================================================
// CATEGORIES
// ============================================================
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color").default("#FF8FAB"),
  icon: text("icon").default("📁"),
  isDefault: integer("is_default", { mode: "boolean" }).default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: integer("created_at").notNull().default(now()),
});

// ============================================================
// TASKS
// ============================================================
export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description").default(""),
    notes: text("notes").default(""),
    priority: text("priority").default("none"), // low | medium | high | none
    status: text("status").default("pending"), // pending | in_progress | completed
    completed: integer("completed", { mode: "boolean" }).default(false),
    completedAt: integer("completed_at"),
    dueDate: integer("due_date"),
    startDate: integer("start_date"),
    tags: text("tags").default("[]"), // JSON array of tags
    recurring: text("recurring").default("none"), // none | daily | weekly | monthly
    reminderAt: integer("reminder_at"),
    reminderSent: integer("reminder_sent", { mode: "boolean" }).default(false),
    sortOrder: integer("sort_order").default(0),
    createdAt: integer("created_at").notNull().default(now()),
    updatedAt: integer("updated_at").notNull().default(now()),
  },
  (t) => ({
    userIdx: index("tasks_user_idx").on(t.userId),
    dueIdx: index("tasks_due_idx").on(t.userId, t.dueDate),
    statusIdx: index("tasks_status_idx").on(t.userId, t.status),
  })
);

export const subtasks = sqliteTable("subtasks", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: integer("created_at").notNull().default(now()),
});

// ============================================================
// NOTES
// ============================================================
export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").default("Untitled note"),
    content: text("content").default(""), // JSON structured doc (ProseMirror-ish) or markdown
    contentText: text("content_text").default(""), // plain text for search
    type: text("type").default("note"), // note | quick | document | study
    categoryId: text("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    tags: text("tags").default("[]"),
    pinned: integer("pinned", { mode: "boolean" }).default(false),
    archived: integer("archived", { mode: "boolean" }).default(false),
    favorite: integer("favorite", { mode: "boolean" }).default(false),
    shareStatus: text("share_status").default("private"), // private | shared | collaborative
    studyHours: real("study_hours").default(0),
    createdAt: integer("created_at").notNull().default(now()),
    updatedAt: integer("updated_at").notNull().default(now()),
  },
  (t) => ({
    userIdx: index("notes_user_idx").on(t.userId),
    archiveIdx: index("notes_archive_idx").on(t.userId, t.archived),
  })
);

export const noteShares = sqliteTable(
  "note_shares",
  {
    id: text("id").primaryKey(),
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    sharedBy: text("shared_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }), // specific friend (null = via link)
    shareLink: text("share_link"), // token for link-based sharing
    permission: text("permission").default("view"), // view | comment | edit
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => ({
    noteUserIdx: uniqueIndex("note_share_user_idx").on(t.noteId, t.userId),
  })
);

export const noteComments = sqliteTable("note_comments", {
  id: text("id").primaryKey(),
  noteId: text("note_id")
    .notNull()
    .references(() => notes.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  mentions: text("mentions").default("[]"),
  createdAt: integer("created_at").notNull().default(now()),
});

// ============================================================
// SOCIAL / FRIENDS
// ============================================================
export const friendRequests = sqliteTable("friend_requests", {
  id: text("id").primaryKey(),
  fromUserId: text("from_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  toUserId: text("to_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").default("pending"), // pending | accepted | rejected
  createdAt: integer("created_at").notNull().default(now()),
});

export const friendships = sqliteTable(
  "friendships",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    friendId: text("friend_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.friendId] }),
  })
);

export const blockedUsers = sqliteTable(
  "blocked_users",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockedId: text("blocked_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.blockedId] }),
  })
);

export const socialLinks = sqliteTable("social_links", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // instagram | tiktok | youtube | facebook | x | discord | github | linkedin | custom
  url: text("url").notNull(),
  label: text("label").default(""),
  sortOrder: integer("sort_order").default(0),
});

// ============================================================
// CHAT
// ============================================================
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  type: text("type").default("direct"), // direct | group
  name: text("name"),
  avatar: text("avatar"),
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: integer("created_at").notNull().default(now()),
});

export const conversationMembers = sqliteTable(
  "conversation_members",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").default("member"), // owner | admin | member
    lastReadAt: integer("last_read_at").default(0),
    joinedAt: integer("joined_at").notNull().default(now()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.conversationId, t.userId] }),
  })
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").default("text"), // text | image | file | system
    content: text("content").default(""),
    replyTo: text("reply_to"), // message id
    fileUrl: text("file_url"),
    fileName: text("file_name"),
    fileType: text("file_type"),
    edited: integer("edited", { mode: "boolean" }).default(false),
    pinned: integer("pinned", { mode: "boolean" }).default(false),
    createdAt: integer("created_at").notNull().default(now()),
    updatedAt: integer("updated_at").notNull().default(now()),
  },
  (t) => ({
    convIdx: index("messages_conv_idx").on(t.conversationId, t.createdAt),
  })
);

export const messageReactions = sqliteTable("message_reactions", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  createdAt: integer("created_at").notNull().default(now()),
});

export const messageReads = sqliteTable(
  "message_reads",
  {
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    readAt: integer("read_at").notNull().default(now()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.messageId, t.userId] }),
  })
);

// ============================================================
// FITNESS / CARDIO / WORKOUTS
// ============================================================
export const fitnessEntries = sqliteTable(
  "fitness_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // YYYY-MM-DD
    weight: real("weight"),
    height: real("height"),
    calories: integer("calories"),
    steps: integer("steps"),
    distanceKm: real("distance_km"),
    activeMinutes: integer("active_minutes"),
    source: text("source").default("manual"), // manual | sensor | health
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => ({
    userDateIdx: uniqueIndex("fitness_user_date_idx").on(t.userId, t.date),
  })
);

export const cardioEntries = sqliteTable("cardio_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").default("running"), // running | walking | cycling | swimming | treadmill | other
  date: text("date").notNull(),
  durationMin: integer("duration_min").notNull(),
  distanceKm: real("distance_km").default(0),
  calories: integer("calories").default(0),
  avgSpeed: real("avg_speed"),
  pace: text("pace"),
  heartRate: integer("heart_rate"),
  notes: text("notes").default(""),
  createdAt: integer("created_at").notNull().default(now()),
});

export const workoutRoutines = sqliteTable("workout_routines", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").default(""),
  color: text("color").default("#FF8FAB"),
  icon: text("icon").default("💪"),
  createdAt: integer("created_at").notNull().default(now()),
});

export const workoutExercises = sqliteTable("workout_exercises", {
  id: text("id").primaryKey(),
  routineId: text("routine_id")
    .notNull()
    .references(() => workoutRoutines.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetSets: integer("target_sets").default(3),
  targetReps: integer("target_reps").default(10),
  restSeconds: integer("rest_seconds").default(90),
  sortOrder: integer("sort_order").default(0),
});

export const workoutSessions = sqliteTable("workout_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  routineId: text("routine_id").references(() => workoutRoutines.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  date: text("date").notNull(),
  durationMin: integer("duration_min").default(0),
  calories: integer("calories").default(0),
  notes: text("notes").default(""),
  createdAt: integer("created_at").notNull().default(now()),
});

export const workoutSets = sqliteTable("workout_sets", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => workoutSessions.id, { onDelete: "cascade" }),
  exerciseName: text("exercise_name").notNull(),
  setNumber: integer("set_number").default(1),
  reps: integer("reps").default(0),
  weightKg: real("weight_kg").default(0),
  done: integer("done", { mode: "boolean" }).default(false),
  sortOrder: integer("sort_order").default(0),
});

// ============================================================
// FINANCE
// ============================================================
export const financeTransactions = sqliteTable(
  "finance_transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(),
    title: text("title").notNull(),
    description: text("description").default(""),
    category: text("category").default("other"),
    type: text("type").notNull(), // income | expense
    date: text("date").notNull(), // YYYY-MM-DD
    notes: text("notes").default(""),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => ({
    userIdx: index("finance_user_idx").on(t.userId, t.date),
  })
);

export const financeCategories = sqliteTable("finance_categories", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(), // income | expense
  color: text("color").default("#FF8FAB"),
  icon: text("icon").default("Wallet"), // lucide icon name
  sortOrder: integer("sort_order").default(0),
});

// ============================================================
// CALENDAR / EVENTS / REMINDERS
// ============================================================
export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: text("type").default("event"), // event | study | exam | workout | reminder | personal
    start: integer("start").notNull(),
    end: integer("end"),
    allDay: integer("all_day", { mode: "boolean" }).default(false),
    location: text("location").default(""),
    description: text("description").default(""),
    color: text("color").default("#FF8FAB"),
    linkedTaskId: text("linked_task_id").references(() => tasks.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => ({
    userIdx: index("events_user_idx").on(t.userId, t.start),
  })
);

export const reminders = sqliteTable("reminders", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  datetime: integer("datetime").notNull(),
  repeat: text("repeat").default("none"),
  completed: integer("completed", { mode: "boolean" }).default(false),
  sent: integer("sent", { mode: "boolean" }).default(false),
  linkedTaskId: text("linked_task_id").references(() => tasks.id, {
    onDelete: "set null",
  }),
  createdAt: integer("created_at").notNull().default(now()),
});

// ============================================================
// NOTIFICATIONS
// ============================================================
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // task | message | friend | note | watch | reminder | system
    title: text("title").notNull(),
    body: text("body").default(""),
    data: text("data").default("{}"), // JSON
    read: integer("read", { mode: "boolean" }).default(false),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId, t.read),
  })
);

// ============================================================
// WATCH PARTY
// ============================================================
export const watchRooms = sqliteTable("watch_rooms", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  hostId: text("host_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").default("Watch Party"),
  mediaUrl: text("media_url").default(""),
  mediaProvider: text("media_provider").default(""), // youtube | custom | none
  mediaId: text("media_id").default(""),
  isPlaying: integer("is_playing", { mode: "boolean" }).default(false),
  currentTime: real("current_time").default(0),
  privacy: text("privacy").default("private"), // private | public
  active: integer("active", { mode: "boolean" }).default(true),
  createdAt: integer("created_at").notNull().default(now()),
});

export const watchRoomMembers = sqliteTable("watch_room_members", {
  id: text("id").primaryKey(),
  roomId: text("room_id")
    .notNull()
    .references(() => watchRooms.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").default("member"), // host | member
  joinedAt: integer("joined_at").notNull().default(now()),
});

export const watchMessages = sqliteTable("watch_messages", {
  id: text("id").primaryKey(),
  roomId: text("room_id")
    .notNull()
    .references(() => watchRooms.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull().default(now()),
});

// ============================================================
// SCHEDULE
// ============================================================
export const subjects = sqliteTable(
  "subjects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    shortName: text("short_name"),
    teacher: text("teacher"),
    room: text("room"),
    color: text("color").default("#FF8FAB"),
    icon: text("icon").default("BookOpen"),
    createdAt: integer("created_at").notNull().default(now()),
  },
  (t) => ({
    userIdx: index("subjects_user_idx").on(t.userId),
  })
);

export const scheduleClasses = sqliteTable(
  "schedule_classes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: text("subject_id").references(() => subjects.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    teacher: text("teacher"),
    room: text("room"),
    day: integer("day").notNull(), // 0=Sunday, 1=Monday, ..., 6=Saturday
    startTime: text("start_time").notNull(), // HH:MM format
    endTime: text("end_time").notNull(), // HH:MM format
    notes: text("notes").default(""),
    color: text("color").default("#FF8FAB"),
    isActive: integer("is_active", { mode: "boolean" }).default(true),
    createdAt: integer("created_at").notNull().default(now()),
    updatedAt: integer("updated_at").notNull().default(now()),
  },
  (t) => ({
    userIdx: index("schedule_classes_user_idx").on(t.userId),
    dayIdx: index("schedule_classes_day_idx").on(t.userId, t.day),
  })
);

export const scheduleHomework = sqliteTable(
  "schedule_homework",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: text("subject_id").references(() => subjects.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description").default(""),
    dueDate: text("due_date").notNull(), // YYYY-MM-DD
    dueTime: text("due_time"), // HH:MM format
    priority: text("priority").default("medium"), // low | medium | high | urgent
    status: text("status").default("not_started"), // not_started | in_progress | completed
    completedAt: integer("completed_at"),
    estimatedMinutes: integer("estimated_minutes").default(0),
    notes: text("notes").default(""),
    createdAt: integer("created_at").notNull().default(now()),
    updatedAt: integer("updated_at").notNull().default(now()),
  },
  (t) => ({
    userIdx: index("schedule_homework_user_idx").on(t.userId),
    dueIdx: index("schedule_homework_due_idx").on(t.userId, t.dueDate),
    statusIdx: index("schedule_homework_status_idx").on(t.userId, t.status),
  })
);

export const scheduleStudySessions = sqliteTable(
  "schedule_study_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    subjectId: text("subject_id").references(() => subjects.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    topic: text("topic").default(""),
    date: text("date").notNull(), // YYYY-MM-DD
    startTime: text("start_time").notNull(), // HH:MM format
    endTime: text("end_time").notNull(), // HH:MM format
    durationMinutes: integer("duration_minutes").default(0),
    priority: text("priority").default("medium"), // low | medium | high | urgent
    status: text("status").default("planned"), // planned | in_progress | completed | skipped
    completedAt: integer("completed_at"),
    notes: text("notes").default(""),
    createdAt: integer("created_at").notNull().default(now()),
    updatedAt: integer("updated_at").notNull().default(now()),
  },
  (t) => ({
    userIdx: index("schedule_study_sessions_user_idx").on(t.userId),
    dateIdx: index("schedule_study_sessions_date_idx").on(t.userId, t.date),
    statusIdx: index("schedule_study_sessions_status_idx").on(t.userId, t.status),
  })
);

// ============================================================
// GAMIFICATION
// ============================================================
export const achievements = sqliteTable("achievements", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").default("🏆"),
});

export const userAchievements = sqliteTable(
  "user_achievements",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    achievementId: text("achievement_id")
      .notNull()
      .references(() => achievements.id, { onDelete: "cascade" }),
    earnedAt: integer("earned_at").notNull().default(now()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.achievementId] }),
  })
);

// ============================================================
// TYPES
// ============================================================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type ScheduleClass = typeof scheduleClasses.$inferSelect;
export type ScheduleHomework = typeof scheduleHomework.$inferSelect;
export type ScheduleStudySession = typeof scheduleStudySessions.$inferSelect;
