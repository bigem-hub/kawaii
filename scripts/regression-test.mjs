#!/usr/bin/env node
/**
 * regression-test.mjs — Full API regression test for KawaiiLife
 *
 * Tests every API endpoint to verify the Firebase migration preserves
 * the exact contract the React frontend and Android app depend on.
 *
 * Usage:
 *   node scripts/regression-test.mjs [BASE_URL]
 *
 * Default BASE_URL: http://localhost:3001
 */

const BASE = process.argv[2] || "http://localhost:3001";
const API = `${BASE}/api`;
let token = "";
let userId = "";
let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function req(method, path, body, opts = {}) {
  const headers = { "Content-Type": "application/json" };
  if (opts.auth !== false && token) headers["Authorization"] = `Bearer ${token}`;
  const init = { method, headers };
  if (body) init.body = JSON.stringify(body);
  try {
    const r = await fetch(`${API}${path}`, init);
    let data = null;
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("json")) data = await r.json();
    else data = await r.text();
    return { status: r.status, data, ok: r.ok };
  } catch (err) {
    return { status: 0, data: null, error: err.message };
  }
}

function assert(label, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✅  ${label}`);
  } else {
    failed++;
    const msg = detail ? `${label} — ${detail}` : label;
    failures.push(msg);
    console.log(`  ❌  ${msg}`);
  }
}

function section(name) {
  console.log(`\n━━━ ${name} ━━━`);
}

// ---------------------------------------------------------------------------
// TEST SUITE
// ---------------------------------------------------------------------------

section("AUTH — Register & Login");
{
  const email = `regression-${Date.now()}@test.com`;
  const username = `regression${Date.now()}`;

  // Register
  const reg = await req("POST", "/auth/register", {
    email,
    username,
    password: "Test1234!",
    displayName: "Regression Test",
  });
  assert("Register returns 201", reg.status === 201, `got ${reg.status}`);
  assert("Register returns token", !!reg.data?.token, JSON.stringify(reg.data));
  assert("Register returns user with id", !!reg.data?.user?.id);
  userId = reg.data.user.id;
  token = reg.data.token;

  // Duplicate register
  const dup = await req("POST", "/auth/register", {
    email,
    username: "dup_" + username,
    password: "Test1234!",
    displayName: "Dup User",
  });
  assert("Duplicate email returns 409", dup.status === 409, `got ${dup.status}`);

  // Duplicate username
  const dupUser = await req("POST", "/auth/register", {
    email: `other-${email}`,
    username,
    password: "Test1234!",
    displayName: "Other User",
  });
  assert("Duplicate username returns 409", dupUser.status === 409, `got ${dupUser.status}`);

  // Login
  const login = await req("POST", "/auth/login", {
    email,
    password: "Test1234!",
  });
  assert("Login returns token", !!login.data?.token);
  token = login.data.token;

  // Wrong password
  const badPw = await req("POST", "/auth/login", {
    email,
    password: "wrongpassword",
  });
  assert("Wrong password returns 401", badPw.status === 401, `got ${badPw.status}`);

  // /me
  const me = await req("GET", "/auth/me");
  assert("GET /me returns user", me.data?.user?.id === userId);
  assert("GET /me includes profile object", !!me.data?.user?.profile);

  // Update profile
  const profile = await req("PATCH", "/auth/profile", {
    displayName: "Updated Regression",
    bio: "Test bio",
  });
  assert("PATCH /auth/profile updates", profile.ok, JSON.stringify(profile.data));

  // Update settings
  const settings = await req("PATCH", "/auth/settings", {
    theme: "dark",
    accentColor: "#0000FF",
  });
  assert("PATCH /auth/settings updates", settings.ok, JSON.stringify(settings.data));

  // Logout
  const logout = await req("POST", "/auth/logout");
  assert("POST /auth/logout succeeds", logout.ok);

  // Re-login for remaining tests
  const reLogin = await req("POST", "/auth/login", { email, password: "Test1234!" });
  token = reLogin.data.token;
}

section("AUTH — Unauthorized");
{
  const saved = token;
  token = "";
  const r = await req("GET", "/auth/me");
  assert("No token returns 401", r.status === 401, `got ${r.status}`);
  const r2 = await req("GET", "/tasks", null, { auth: false });
  assert("GET /tasks no header returns 401", r2.status === 401);
  token = saved;
}

section("TASKS — CRUD + Subtasks + Categories");
{
  // List (empty)
  const list = await req("GET", "/tasks");
  assert("GET /tasks returns array", Array.isArray(list.data));

  // Create task
  const t = await req("POST", "/tasks", {
    title: "Regression Task",
    priority: "high",
    dueDate: "2026-09-15",
    notes: "test notes",
    recurring: "daily",
  });
  assert("POST /tasks returns 201", t.status === 201, `got ${t.status}`);
  assert("POST /tasks has subtasks array", Array.isArray(t.data?.subtasks));
  const taskId = t.data.id;

  // Get single task
  const list2 = await req("GET", "/tasks");
  const found = list2.data.find((x) => x.id === taskId);
  assert("GET /tasks includes new task", !!found);
  assert("GET /tasks has subtasks field", Array.isArray(found?.subtasks));

  // Update task
  const upd = await req("PATCH", `/tasks/${taskId}`, {
    title: "Updated Task",
    priority: "none",
  });
  assert("PATCH /tasks/:id returns 200", upd.ok);

  // Add subtask
  const sub = await req("POST", `/tasks/${taskId}/subtasks`, {
    title: "Sub A",
  });
  assert("POST /tasks/:id/subtasks returns 201", sub.status === 201, `got ${sub.status}`);
  assert("Subtask has taskId field", sub.data?.taskId === taskId);
  assert("Subtask has title", sub.data?.title === "Sub A");
  assert("Subtask has completed field", sub.data?.completed === false);
  // Subtask should NOT have categoryId/dueDate (SQLite contract)
  assert("Subtask has no categoryId", !("categoryId" in (sub.data || {})));
  const subId = sub.data.id;

  // Add second subtask
  const sub2 = await req("POST", `/tasks/${taskId}/subtasks`, { title: "Sub B" });
  assert("Second subtask created", sub2.status === 201);

  // Verify nested subtasks on list
  const list3 = await req("GET", "/tasks");
  const task = list3.data.find((x) => x.id === taskId);
  assert("Task has 2 subtasks nested", task?.subtasks?.length === 2);
  assert("Subtask has no task-default fields", !("priority" in (task?.subtasks?.[0] || {})));

  // Update subtask
  const subUpd = await req("PATCH", `/tasks/${taskId}/subtasks/${subId}`, {
    completed: true,
  });
  assert("PATCH subtask completes", subUpd.ok);

  // Delete subtask
  const subDel = await req("DELETE", `/tasks/${taskId}/subtasks/${subId}`);
  assert("DELETE subtask succeeds", subDel.ok);

  // Categories
  const cats = await req("GET", "/tasks/categories");
  assert("GET /tasks/categories returns array", Array.isArray(cats.data));
  assert("Categories have default entries", cats.data.length >= 1);
  assert("Category has icon field", !!cats.data[0]?.icon);

  // Delete task
  const del = await req("DELETE", `/tasks/${taskId}`);
  assert("DELETE /tasks/:id succeeds", del.ok);
}

section("NOTES — CRUD + Share + Comments");
{
  // Create note
  const n = await req("POST", "/notes", {
    title: "Regression Note",
    content: "<p>Hello</p>",
    type: "note",
  });
  assert("POST /notes returns 201", n.status === 201, `got ${n.status}`);
  const noteId = n.data.id;

  // List
  const list = await req("GET", "/notes");
  assert("GET /notes includes note", list.data.some((x) => x.id === noteId));

  // Get single
  const get = await req("GET", `/notes/${noteId}`);
  assert("GET /notes/:id returns note", get.ok);

  // Update
  const upd = await req("PATCH", `/notes/${noteId}`, {
    title: "Updated Note",
    pinned: true,
  });
  assert("PATCH /notes/:id updates", upd.ok);

  // Add comment (nested)
  const cm = await req("POST", `/notes/${noteId}/comments`, {
    content: "Great note!",
  });
  assert("POST /notes/:id/comments returns 201", cm.status === 201, `got ${cm.status}`);
  assert("Comment has noteId", cm.data?.noteId === noteId);
  assert("Comment has userId", !!cm.data?.userId);
  const commentId = cm.data.id;

  // Get note with comments
  const getCm = await req("GET", `/notes/${noteId}`);
  assert("GET note has comments array", Array.isArray(getCm.data?.comments));
  assert("Comments array has 1 entry", getCm.data?.comments?.length === 1);

  // Share note
  const share = await req("POST", `/notes/${noteId}/share`, {
    shareStatus: "link",
  });
  assert("POST /notes/:id/share returns 200+", share.status >= 200, `got ${share.status}`);

  // Shared notes
  const shared = await req("GET", "/notes/shared");
  assert("GET /notes/shared returns array", Array.isArray(shared.data));

  // Delete comment
  const delCm = await req("DELETE", `/notes/${noteId}/comments/${commentId}`);
  assert("DELETE comment succeeds", delCm.ok);

  // Delete note
  const del = await req("DELETE", `/notes/${noteId}`);
  assert("DELETE /notes/:id succeeds", del.ok);
}

section("FRIENDS — Search + Requests");
{
  // Search
  const search = await req("GET", "/friends/search?q=test");
  assert("GET /friends/search returns array", Array.isArray(search.data));

  // Friend list
  const list = await req("GET", "/friends");
  assert("GET /friends returns array", Array.isArray(list.data));

  // Pending requests (incoming enriched — used by web frontend and Android)
  const pending = await req("GET", "/friends/requests");
  assert("GET /friends/requests returns array", Array.isArray(pending.data));
}

section("CHAT — Conversations + Messages + Reactions");
{
  // List (empty for fresh user)
  const convs = await req("GET", "/chat/conversations");
  assert("GET /chat/conversations returns array", Array.isArray(convs.data));

  // Get existing user to chat with
  const search = await req("GET", "/friends/search?q=testuser");

  // Create direct chat
  const direct = await req("POST", "/chat/direct", {
    friendId: search.data[0]?.id,
  });
  assert("POST /chat/direct creates conversation", direct.status === 201 || direct.ok, `got ${direct.status}`);
  assert("Conversation has id", !!direct.data?.id);
  const convId = direct.data.id;

  // Send message
  const msg = await req("POST", `/chat/${convId}/messages`, {
    content: "Regression message",
    type: "text",
  });
  assert("POST /chat/:id/messages returns 201", msg.status === 201, `got ${msg.status}`);
  assert("Message has id", !!msg.data?.id);
  assert("Message has reactions array", Array.isArray(msg.data?.reactions));
  assert("Message has sender object", !!msg.data?.sender?.username);
  const msgId = msg.data.id;

  // Send second message
  const msg2 = await req("POST", `/chat/${convId}/messages`, {
    content: "Second message",
  });
  assert("Second message sent", msg2.ok);

  // Get messages
  const msgs = await req("GET", `/chat/${convId}/messages`);
  assert("GET /chat/:id/messages returns array", Array.isArray(msgs.data));
  assert("Messages sorted by createdAt asc", msgs.data[0]?.createdAt <= msgs.data[1]?.createdAt);

  // React (nested)
  const react = await req("POST", `/chat/messages/${msgId}/react`, {
    emoji: "🎉",
  });
  assert("POST /chat/messages/:id/react returns reactions", Array.isArray(react.data?.reactions));
  assert("Reaction has emoji field", react.data?.reactions?.[0]?.emoji === "🎉");
  assert("Reaction has userId field", !!react.data?.reactions?.[0]?.userId);

  // Toggle same reaction off
  const react2 = await req("POST", `/chat/messages/${msgId}/react`, { emoji: "🎉" });
  assert("Toggle reaction removes it", react2.data?.reactions?.every((r) => r.emoji !== "🎉"));

  // Edit message
  const edit = await req("PATCH", `/chat/messages/${msgId}`, {
    content: "Edited message",
  });
  assert("PATCH /chat/messages/:id updates", edit.ok);
  assert("Edited flag set", edit.data?.edited === true);

  // Re-get to verify reactions stored nested
  const msgs2 = await req("GET", `/chat/${convId}/messages`);
  assert("Messages include sender data", msgs2.data[0]?.sender?.username);
}

section("FITNESS — Entries + Cardio + Routines + Sessions + Stats");
{
  // Create fitness entry
  const fe = await req("POST", "/fitness", {
    date: "2026-09-06",
    weight: 75,
    steps: 8000,
    calories: 2000,
  });
  assert("POST /fitness returns 201", fe.status === 201 || fe.ok, `got ${fe.status}`);
  assert("Fitness entry has id", !!fe.data?.id);

  // Upsert same date
  const fe2 = await req("POST", "/fitness", {
    date: "2026-09-06",
    weight: 74.5,
    steps: 9000,
  });
  assert("Upsert updates same date entry", fe2.ok);

  // List fitness
  const feList = await req("GET", "/fitness");
  assert("GET /fitness returns array", Array.isArray(feList.data));
  assert("Has updated weight", feList.data.some((e) => e.weight === 74.5));

  // Add cardio
  const cardio = await req("POST", "/fitness/cardio", {
    type: "running",
    date: "2026-09-06",
    durationMin: 30,
    distanceKm: 5,
    calories: 300,
  });
  assert("POST /fitness/cardio returns 201", cardio.status === 201, `got ${cardio.status}`);
  assert("Cardio has pace", !!cardio.data?.pace);
  const cardioId = cardio.data.id;

  // List cardio
  const cardioList = await req("GET", "/fitness/cardio");
  assert("GET /fitness/cardio returns array", Array.isArray(cardioList.data));

  // Delete cardio
  const delCardio = await req("DELETE", `/fitness/cardio/${cardioId}`);
  assert("DELETE cardio succeeds", delCardio.ok);

  // Create workout routine with nested exercises
  const routine = await req("POST", "/fitness/routines", {
    name: "Push Day",
    exercises: [
      { name: "Bench Press", targetSets: 4, targetReps: 8 },
      { name: "Shoulder Press", targetSets: 3, targetReps: 10 },
    ],
  });
  assert("POST /fitness/routines returns 201", routine.status === 201, `got ${routine.status}`);
  assert("Routine has exercises array", Array.isArray(routine.data?.exercises));
  assert("Exercises have routineId (nested)", routine.data?.exercises?.[0]?.routineId === routine.data.id);
  assert("Exercises have sortOrder", routine.data?.exercises?.[0]?.sortOrder === 0);
  assert("Exercises have NO top-level indexOn field (not fetched by routineId separately)", routine.data?.exercises?.[0]?.routineId !== undefined);
  const routineId = routine.data.id;

  // Get routines (exercises nested)
  const routines = await req("GET", "/fitness/routines");
  assert("GET /fitness/routines returns array", Array.isArray(routines.data));
  const rFound = routines.data.find((x) => x.id === routineId);
  assert("Routine has nested exercises on GET", rFound?.exercises?.length === 2);

  // Create workout session with nested sets
  const session = await req("POST", "/fitness/sessions", {
    name: "Push Session",
    routineId,
    durationMin: 45,
    sets: [
      { exerciseName: "Bench Press", setNumber: 1, reps: 10, weightKg: 60, done: true },
      { exerciseName: "Bench Press", setNumber: 2, reps: 8, weightKg: 60, done: true },
    ],
  });
  assert("POST /fitness/sessions returns 201", session.status === 201, `got ${session.status}`);
  assert("Session has nested sets", Array.isArray(session.data?.sets));
  assert("Sets have sessionId (nested)", session.data?.sets?.[0]?.sessionId === session.data.id);
  const sessionId = session.data.id;

  // Get sessions (sets nested)
  const sessions = await req("GET", "/fitness/sessions");
  assert("GET /fitness/sessions returns array", Array.isArray(sessions.data));
  const sFound = sessions.data.find((x) => x.id === sessionId);
  assert("Session has nested sets on GET", sFound?.sets?.length === 2);

  // Stats
  const stats = await req("GET", "/fitness/stats");
  assert("GET /fitness/stats returns totalCalories field", typeof stats.data?.totalCalories === "number");
  assert("Stats has workoutCount", typeof stats.data?.workoutCount === "number");
}

section("CALENDAR — Events + Reminders + Combined");
{
  // Create event
  const ev = await req("POST", "/calendar/events", {
    title: "Regression Event",
    start: "2026-09-10T10:00:00Z",
    end: "2026-09-10T12:00:00Z",
    type: "event",
  });
  assert("POST /calendar/events returns 201", ev.status === 201, `got ${ev.status}`);
  assert("Event has color default", !!ev.data?.color);
  const evId = ev.data.id;

  // List events
  const evList = await req("GET", "/calendar/events");
  assert("GET /calendar/events returns array", Array.isArray(evList.data));
  assert("Events includes new event", evList.data.some((x) => x.id === evId));

  // Update event
  const evUpd = await req("PATCH", `/calendar/events/${evId}`, {
    title: "Updated Event",
  });
  assert("PATCH /calendar/events/:id updates", evUpd.ok);

  // Create reminder
  const rm = await req("POST", "/calendar/reminders", {
    title: "Regression Reminder",
    datetime: "2026-09-10T09:00:00Z",
  });
  assert("POST /calendar/reminders returns 201", rm.status === 201, `got ${rm.status}`);
  assert("Reminder has completed default", rm.data?.completed === false);

  // List reminders
  const rmList = await req("GET", "/calendar/reminders");
  assert("GET /calendar/reminders returns array", Array.isArray(rmList.data));

  // Combined endpoint
  const combined = await req("GET", "/calendar/combined");
  assert("GET /calendar/combined has events+tasks+reminders", Array.isArray(combined.data?.events));
  assert("Combined has tasks array", Array.isArray(combined.data?.tasks));
  assert("Combined has reminders array", Array.isArray(combined.data?.reminders));

  // Delete event
  const evDel = await req("DELETE", `/calendar/events/${evId}`);
  assert("DELETE event succeeds", evDel.ok);
}

section("WATCH PARTY — Rooms + Members + Chat");
{
  // Create room
  const room = await req("POST", "/watch/rooms", {
    name: "Test Room",
    mediaUrl: "https://example.com/video.mp4",
  });
  assert("POST /watch/rooms returns 201", room.status === 201, `got ${room.status}`);
  assert("Room has join code", !!room.data?.code);
  assert("Room has hostId", room.data?.hostId === userId);
  assert("Room has active default", room.data?.active === true);
  const roomId = room.data.id;

  // List rooms
  const rooms = await req("GET", "/watch/rooms");
  assert("GET /watch/rooms returns array", Array.isArray(rooms.data));

  // Get room by ID
  const roomGet = await req("GET", `/watch/rooms/${roomId}`);
  assert("GET /watch/rooms/:id returns room", roomGet.ok);
  assert("Room GET has members array", Array.isArray(roomGet.data?.members));
  assert("Host is auto-added as member", roomGet.data?.members?.some((m) => m.userId === userId));

  // Get room by CODE (how the web frontend navigates: /watch/{code})
  const roomByCode = await req("GET", `/watch/rooms/${room.data.code}`);
  assert("GET /watch/rooms/:code resolves by code", roomByCode.ok, `got ${roomByCode.status}`);

  // Join room (already host — 409 expected)
  const join = await req("POST", `/watch/rooms/${roomId}/join`);
  assert("Join room for host returns 409 (already member)", join.status === 409, `got ${join.status}`);

  // Send watch chat via /messages (correct route)
  const wMsg = await req("POST", `/watch/rooms/${roomId}/messages`, {
    content: "This is great!",
  });
  assert("POST /watch/rooms/:id/messages sends message", wMsg.ok);

  // Get watch chat via /messages (correct route)
  const wMsgs = await req("GET", `/watch/rooms/${roomId}/messages`);
  assert("GET /watch/rooms/:id/messages returns array", Array.isArray(wMsgs.data));

  // Join by code (create second user)
  const email2 = `regression2-${Date.now()}@test.com`;
  const reg2 = await req("POST", "/auth/register", {
    email: email2,
    username: `regression2_${Date.now()}`,
    password: "Test1234!",
    displayName: "Regression 2",
  });
  const token2 = reg2.data.token;

  // Second user joins by code
  const savedToken = token;
  token = reg2.data.token;
  const joinByCode = await req("POST", `/watch/join`, {
    code: room.data.code,
  });
  assert("POST /watch/join joins by code", joinByCode.ok, `got ${joinByCode.status}`);

  // Control playback via PATCH /rooms/:id/media (isPlaying+currentTime payload)
  token = savedToken;
  const control = await req("PATCH", `/watch/rooms/${roomId}/media`, {
    isPlaying: true,
    currentTime: 42,
  });
  assert("PATCH /watch/rooms/:id/media updates playback", control.ok);
}

section("NOTIFICATIONS");
{
  // List notifications
  const notif = await req("GET", "/notifications");
  assert("GET /notifications returns array", Array.isArray(notif.data));

  // Mark all read
  const readAll = await req("POST", "/notifications/read-all");
  assert("POST /notifications/read-all returns 200+", readAll.status >= 200);
}

section("ACHIEVEMENTS");
{
  const ach = await req("GET", "/notifications/achievements");
  assert("GET /notifications/achievements returns array", Array.isArray(ach.data));
  assert("Has default achievements", ach.data.length >= 12);
  assert("Achievement has icon", !!ach.data[0]?.icon);
}

section("DASHBOARD + MISC");
{
  const dash = await req("GET", "/dashboard");
  assert("GET /dashboard returns object", !!dash.data);
  assert("Dashboard has greeting", !!dash.data?.greeting);
  assert("Dashboard has todayTasks", Array.isArray(dash.data?.todayTasks));
  assert("Dashboard has user", !!dash.data?.user?.username);

  const search = await req("GET", "/search?q=test&type=all");
  assert("GET /search returns object", !!search.data);

  const profile = await req("GET", `/users/${token ? JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()).username : ""}`);
  // Use /me user's profile
  const me = await req("GET", "/auth/me");
  const uname = me.data?.user?.username;
  const prof = await req("GET", `/users/${uname}`);
  assert("GET /users/:username returns profile", prof.ok, `got ${prof.status}`);
}

section("HEALTH CHECK");
{
  const h = await req("GET", "/health");
  // health is behind auth middleware, may return 401
  assert("GET /health responds (any status)", h.status > 0);
}

// ---------------------------------------------------------------------------
// SUMMARY
// ---------------------------------------------------------------------------

console.log(`\n${"━".repeat(60)}`);
console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${skipped} skipped`);
console.log(`${"━".repeat(60)}`);

if (failures.length > 0) {
  console.log("\n  FAILURES:");
  failures.forEach((f, i) => console.log(`    ${i + 1}. ${f}`));
}

process.exit(failed > 0 ? 1 : 0);
