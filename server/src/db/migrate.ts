import { sqlite } from "./index.js";
import { config } from "../config.js";

/**
 * Run raw SQL to create all tables (for fresh setup without drizzle-kit).
 * In production you'd use drizzle-kit push/migrate instead.
 */
export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL,
      password_hash TEXT,
      avatar TEXT,
      bio TEXT DEFAULT '',
      email_verified INTEGER DEFAULT 0,
      provider TEXT DEFAULT 'email',
      online INTEGER DEFAULT 0,
      last_seen INTEGER DEFAULT 0,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_activity_date TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username);

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      theme TEXT DEFAULT 'light',
      accent_color TEXT DEFAULT '#FF8FAB',
      ui_density TEXT DEFAULT 'comfortable',
      animations INTEGER DEFAULT 1,
      profile_visibility TEXT DEFAULT 'public',
      online_status_visible INTEGER DEFAULT 1,
      friend_requests_open INTEGER DEFAULT 1,
      show_fitness INTEGER DEFAULT 0,
      show_notes INTEGER DEFAULT 0,
      show_stats INTEGER DEFAULT 1,
      notif_push INTEGER DEFAULT 1,
      notif_email INTEGER DEFAULT 1,
      notif_chat INTEGER DEFAULT 1,
      notif_reminders INTEGER DEFAULT 1,
      dashboard_widgets TEXT DEFAULT 'greeting,todayTasks,progress,reminders,quickNotes,study,fitness,cardio,chat,sharedNotes,events,watch,streak,motivation'
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      device TEXT DEFAULT 'Unknown device',
      ip TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#FF8FAB',
      icon TEXT DEFAULT '📁',
      is_default INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      priority TEXT DEFAULT 'none',
      status TEXT DEFAULT 'pending',
      completed INTEGER DEFAULT 0,
      completed_at INTEGER,
      due_date INTEGER,
      start_date INTEGER,
      tags TEXT DEFAULT '[]',
      recurring TEXT DEFAULT 'none',
      reminder_at INTEGER,
      reminder_sent INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS tasks_user_idx ON tasks(user_id);
    CREATE INDEX IF NOT EXISTS tasks_due_idx ON tasks(user_id, due_date);
    CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(user_id, status);

    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT DEFAULT 'Untitled note',
      content TEXT DEFAULT '',
      content_text TEXT DEFAULT '',
      type TEXT DEFAULT 'note',
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      tags TEXT DEFAULT '[]',
      pinned INTEGER DEFAULT 0,
      archived INTEGER DEFAULT 0,
      favorite INTEGER DEFAULT 0,
      share_status TEXT DEFAULT 'private',
      study_hours REAL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS notes_user_idx ON notes(user_id);

    CREATE TABLE IF NOT EXISTS note_shares (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      shared_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      share_link TEXT,
      permission TEXT DEFAULT 'view',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS note_comments (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      mentions TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS friendships (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      PRIMARY KEY(user_id, friend_id)
    );

    CREATE TABLE IF NOT EXISTS blocked_users (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      PRIMARY KEY(user_id, blocked_id)
    );

    CREATE TABLE IF NOT EXISTS social_links (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      label TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT DEFAULT 'direct',
      name TEXT,
      avatar TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS conversation_members (
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member',
      last_read_at INTEGER DEFAULT 0,
      joined_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      PRIMARY KEY(conversation_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT DEFAULT 'text',
      content TEXT DEFAULT '',
      reply_to TEXT,
      file_url TEXT,
      file_name TEXT,
      file_type TEXT,
      edited INTEGER DEFAULT 0,
      pinned INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS messages_conv_idx ON messages(conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS message_reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS message_reads (
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      PRIMARY KEY(message_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS fitness_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      weight REAL,
      height REAL,
      calories INTEGER,
      steps INTEGER,
      distance_km REAL,
      active_minutes INTEGER,
      source TEXT DEFAULT 'manual',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS fitness_user_date_idx ON fitness_entries(user_id, date);

    CREATE TABLE IF NOT EXISTS cardio_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT DEFAULT 'running',
      date TEXT NOT NULL,
      duration_min INTEGER NOT NULL,
      distance_km REAL DEFAULT 0,
      calories INTEGER DEFAULT 0,
      avg_speed REAL,
      pace TEXT,
      heart_rate INTEGER,
      notes TEXT DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS workout_routines (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      color TEXT DEFAULT '#FF8FAB',
      icon TEXT DEFAULT '💪',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS workout_exercises (
      id TEXT PRIMARY KEY,
      routine_id TEXT NOT NULL REFERENCES workout_routines(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      target_sets INTEGER DEFAULT 3,
      target_reps INTEGER DEFAULT 10,
      rest_seconds INTEGER DEFAULT 90,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      routine_id TEXT REFERENCES workout_routines(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      date TEXT NOT NULL,
      duration_min INTEGER DEFAULT 0,
      calories INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS workout_sets (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
      exercise_name TEXT NOT NULL,
      set_number INTEGER DEFAULT 1,
      reps INTEGER DEFAULT 0,
      weight_kg REAL DEFAULT 0,
      done INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      type TEXT DEFAULT 'event',
      start INTEGER NOT NULL,
      end INTEGER,
      all_day INTEGER DEFAULT 0,
      location TEXT DEFAULT '',
      description TEXT DEFAULT '',
      color TEXT DEFAULT '#FF8FAB',
      linked_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS events_user_idx ON events(user_id, start);

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      datetime INTEGER NOT NULL,
      repeat TEXT DEFAULT 'none',
      completed INTEGER DEFAULT 0,
      sent INTEGER DEFAULT 0,
      linked_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      data TEXT DEFAULT '{}',
      read INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, read);

    CREATE TABLE IF NOT EXISTS watch_rooms (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      host_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT DEFAULT 'Watch Party',
      media_url TEXT DEFAULT '',
      media_provider TEXT DEFAULT '',
      media_id TEXT DEFAULT '',
      is_playing INTEGER DEFAULT 0,
      current_time REAL DEFAULT 0,
      privacy TEXT DEFAULT 'private',
      active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS watch_room_members (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES watch_rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member',
      joined_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS watch_messages (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES watch_rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT DEFAULT '🏆'
    );

    CREATE TABLE IF NOT EXISTS user_achievements (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
      earned_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      PRIMARY KEY(user_id, achievement_id)
    );
  `);

  // Seed default achievements
  const achCount = sqlite.prepare("SELECT COUNT(*) as cnt FROM achievements").get() as { cnt: number };
  if (achCount.cnt === 0) {
    const insert = sqlite.prepare("INSERT INTO achievements (id, code, name, description, icon) VALUES (?, ?, ?, ?, ?)");
    const seed = sqlite.transaction(() => {
      insert.run("ach_first_task", "first_task", "First Steps", "Completed your first task", "✅");
      insert.run("ach_7_streak", "7_streak", "On Fire!", "7-day productivity streak", "🔥");
      insert.run("ach_100_tasks", "100_tasks", "Century", "Completed 100 tasks", "💯");
      insert.run("ach_first_workout", "first_workout", "Getting Started", "Completed your first workout", "💪");
      insert.run("ach_10_workouts", "10_workouts", "Fitness Fanatic", "Completed 10 workouts", "🏋️");
      insert.run("ach_note_master", "note_master", "Note Master", "Created 50 notes", "📒");
      insert.run("ach_30_streak", "30_streak", "Unstoppable!", "30-day productivity streak", "🌟");
      insert.run("ach_social_butterfly", "social_butterfly", "Social Butterfly", "Added 5 friends", "🦋");
      insert.run("ach_first_chat", "first_chat", "Chatterbox", "Sent your first message", "💬");
      insert.run("ach_watch_party", "watch_party", "Party Time!", "Joined a watch party", "🎬");
      insert.run("ach_early_bird", "early_bird", "Early Bird", "Completed a task before 8am", "🐦");
      insert.run("ach_night_owl", "night_owl", "Night Owl", "Completed a task after midnight", "🦉");
    });
    seed();
    console.log("✅ Seeded default achievements");
  }

  console.log("✅ Database initialized");
}
