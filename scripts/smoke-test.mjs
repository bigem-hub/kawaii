// API smoke test — exercises the full backend surface.
// Run: node scripts/smoke-test.mjs
const BASE = "http://localhost:3001/api";

let TOKEN_A, TOKEN_B, PASS = 0, FAIL = 0;

function check(name, cond, extra = "") {
  if (cond) { PASS++; console.log(`  ✅ ${name}`); }
  else { FAIL++; console.log(`  ❌ ${name} ${extra}`); }
}

async function req(method, path, body, token) {
  const r = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: r.status, json };
}

const randomSuffix = Math.random().toString(36).slice(2, 8);

async function main() {
  console.log("\n== Auth ==");
  let r = await req("POST", "/auth/register", {
    email: `alice_${randomSuffix}@test.com`, username: `alice_${randomSuffix}`,
    displayName: "Alice", password: "password123",
  });
  check("register alice", r.status === 201);
  TOKEN_A = r.json.token;

  r = await req("POST", "/auth/register", {
    email: `bob_${randomSuffix}@test.com`, username: `bob_${randomSuffix}`,
    displayName: "Bob", password: "password123",
  });
  check("register bob", r.status === 201);
  TOKEN_B = r.json.token;

  r = await req("POST", "/auth/login", { email: `alice_${randomSuffix}@test.com`, password: "password123" });
  check("login alice", r.status === 200 && r.json.token);

  r = await req("GET", "/auth/me", null, TOKEN_A);
  check("get me", r.status === 200 && r.json.user.username.startsWith("alice_"));

  r = await req("POST", "/auth/login", { email: `alice_${randomSuffix}@test.com`, password: "wrongpass" });
  check("login wrong password rejected", r.status === 401);

  r = await req("GET", "/tasks", null, "invalid.token.here");
  check("invalid token rejected", r.status === 401);

  r = await req("PATCH", "/auth/profile", { displayName: "Alice Updated", bio: "Hello!" }, TOKEN_A);
  check("update profile", r.status === 200 && r.json.displayName === "Alice Updated");

  console.log("\n== Tasks ==");
  r = await req("POST", "/tasks", { title: "Build the app", priority: "high", categoryId: null }, TOKEN_A);
  check("create task", r.status === 201 || r.status === 200);
  const taskId = r.json.id || r.json.task?.id;

  r = await req("POST", "/tasks", { title: "Second task", dueDate: Date.now() + 86400000 }, TOKEN_A);
  check("create second task", r.status === 201 || r.status === 200);

  r = await req("POST", `/tasks/${taskId}/subtasks`, { title: "Subtask One" }, TOKEN_A);
  check("create subtask", r.status === 201 || r.status === 200);
  const subId = r.json.id;

  r = await req("PATCH", `/tasks/${taskId}`, { completed: true }, TOKEN_A);
  check("complete task", r.status === 200);

  r = await req("GET", "/tasks", null, TOKEN_A);
  check("list tasks", Array.isArray(r.json) && r.json.length >= 1);

  r = await req("GET", "/tasks?status=completed", null, TOKEN_A);
  check("filter completed", r.json.every(t => t.completed === true));

  r = await req("GET", "/tasks/stats", null, TOKEN_A);
  check("task stats", r.json && typeof r.json.completedToday === "number");

  console.log("\n== Notes ==");
  r = await req("POST", "/notes", { title: "My first note", type: "quick" }, TOKEN_A);
  check("create note", r.status === 201 || r.status === 200);
  const noteId = r.json.id;

  r = await req("PATCH", `/notes/${noteId}`, { content: "<p>Hello <b>world</b></p>", contentText: "Hello world" }, TOKEN_A);
  check("update note", r.status === 200);

  r = await req("GET", "/notes?archived=false", null, TOKEN_A);
  check("list notes", Array.isArray(r.json) && r.json.some(n => n.id === noteId));

  console.log("\n== Calendar ==");
  r = await req("POST", "/calendar/events", { title: "Team standup", start: Date.now() + 86400000, end: Date.now() + 86400000 + 3600000 }, TOKEN_A);
  check("create event", r.status === 201 || r.status === 200);

  r = await req("GET", "/calendar/combined", null, TOKEN_A);
  check("combined calendar", r.json && Array.isArray(r.json.events) && Array.isArray(r.json.tasks));

  console.log("\n== Fitness ==");
  r = await req("POST", "/fitness", { weight: 70.5, steps: 8000, calories: 2200 }, TOKEN_A);
  check("log fitness", r.status === 200 || r.status === 201);

  r = await req("GET", "/fitness", null, TOKEN_A);
  check("get fitness", Array.isArray(r.json) && r.json.length > 0);

  r = await req("POST", "/fitness/cardio", { type: "running", distanceKm: 5, durationMin: 30, calories: 350 }, TOKEN_A);
  check("log cardio", r.status === 200 || r.status === 201);

  r = await req("GET", "/fitness/cardio", null, TOKEN_A);
  check("list cardio", Array.isArray(r.json) && r.json.length === 1 && r.json[0].avgSpeed > 0);

  r = await req("GET", "/fitness/stats", null, TOKEN_A);
  check("fitness stats", r.status === 200);

  console.log("\n== Friends ==");
  r = await req("GET", "/users/bob_" + randomSuffix, null, TOKEN_A);
  check("view bob public profile", r.status === 200 && r.json.username === `bob_${randomSuffix}`);

  r = await req("GET", "/friends/search?q=bob", null, TOKEN_A);
  check("search users", Array.isArray(r.json));
  const bobId = r.json[0]?.id;
  const bobUsername = r.json[0]?.username;

  r = await req("POST", "/friends/request", { userId: bobId }, TOKEN_A);
  check("send friend request", r.status === 200 || r.status === 201);

  r = await req("GET", "/friends/requests", null, TOKEN_B);
  check("bob sees request", Array.isArray(r.json) && r.json.length === 1);
  const reqId = r.json[0]?.id;

  r = await req("POST", `/friends/accept/${reqId}`, {}, TOKEN_B);
  check("accept friend request", r.status === 200);

  r = await req("GET", "/friends", null, TOKEN_A);
  check("friends list", Array.isArray(r.json) && r.json.some(f => f.username.startsWith("bob_")));

  console.log("\n== Chat ==");
  r = await req("POST", "/chat/direct", { userId: bobId }, TOKEN_A);
  check("create direct conversation", r.status === 200 || r.status === 201);
  const convId = r.json.id;

  r = await req("POST", `/chat/${convId}/messages`, { content: "Hey Bob!" }, TOKEN_A);
  check("send message", r.status === 200 || r.status === 201);

  r = await req("GET", "/chat/conversations", null, TOKEN_A);
  check("list conversations", Array.isArray(r.json) && r.json.some(c => c.id === convId));

  r = await req("GET", `/chat/${convId}/messages`, null, TOKEN_B);
  check("bob reads messages", Array.isArray(r.json) && r.json.length >= 1);

  console.log("\n== Notifications ==");
  r = await req("GET", "/notifications", null, TOKEN_B);
  check("bob has notification for friend request", r.status === 200);

  r = await req("GET", "/notifications/achievements", null, TOKEN_A);
  check("achievements endpoint", r.status === 200);

  r = await req("GET", "/dashboard", null, TOKEN_A);
  check("dashboard", r.status === 200 && r.json.todayTasks !== undefined);

  console.log("\n== Search ==");
  r = await req("GET", "/search?q=Build", null, TOKEN_A);
  check("global search", r.status === 200 && Array.isArray(r.json.tasks));

  console.log("\n== Watch ==");
  r = await req("POST", "/watch/rooms", { name: "Movie Night", mediaUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", privacy: "public" }, TOKEN_A);
  check("create watch room", r.status === 200 || r.status === 201);
  const roomCode = r.json.code;

  r = await req("GET", "/watch/rooms", null, TOKEN_A);
  check("list public rooms", Array.isArray(r.json));

  r = await req("POST", "/watch/join", { code: roomCode }, TOKEN_B);
  check("join room by code", r.status === 200 && r.json.code === roomCode);
  const roomId = r.json.id;

  r = await req("POST", `/watch/rooms/${roomId}/messages`, { content: "yo!" }, TOKEN_B);
  check("watch room chat", r.status === 200 || r.status === 201);

  console.log(`\n${"=".repeat(40)}\nRESULT: ${PASS} passed, ${FAIL} failed\n${"=".repeat(40)}`);
  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });