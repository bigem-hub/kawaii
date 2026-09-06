import { initializeDatabase } from '../src/db/migrate.js';
import Database from 'better-sqlite3';
import path from 'path';

// Ensure tables exist
initializeDatabase();

// Now count tables
const dbPath = path.resolve('./../data.db');
const db = new Database(dbPath);

const tables = [
  'users',
  'user_profiles',
  'user_sessions',
  'categories',
  'tasks',
  'subtasks',
  'notes',
  'note_shares',
  'note_comments',
  'friend_requests',
  'friendships',
  'blocked_users',
  'social_links',
  'conversations',
  'conversation_members',
  'messages',
  'message_reactions',
  'message_reads',
  'fitness_entries',
  'cardio_entries',
  'workout_routines',
  'workout_exercises',
  'workout_sessions',
  'workout_sets',
  'events',
  'reminders',
  'notifications',
  'watch_rooms',
  'watch_room_members',
  'watch_messages',
  'achievements',
  'user_achievements'
];

console.log('=== SQLite Table Counts (after migration) ===');
tables.forEach(t => {
  const count = db.prepare(`SELECT COUNT(*) as cnt FROM ${t}`).get().cnt;
  console.log(`${t}: ${count}`);
});

db.close();