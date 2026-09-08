import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { config } from "./config.js";
import { initFirebase } from "./firebase.js";
import { initRealtime } from "./realtime/index.js";

// Routes
import authRouter from "./auth/auth.js";
import tasksRouter from "./routes/tasks.js";
import notesRouter from "./routes/notes.js";
import friendsRouter from "./routes/friends.js";
import chatRouter from "./routes/chat.js";
import fitnessRouter from "./routes/fitness.js";
import calendarRouter from "./routes/calendar.js";
import watchRouter from "./routes/watch.js";
import notificationsRouter from "./routes/notifications.js";
import financeRouter from "./routes/finance.js";
import studyRouter from "./routes/study.js";
import scheduleRouter from "./routes/schedule.js";
import miscRouter from "./routes/misc.js";

// Initialize
const app = express();
const server = createServer(app);
app.set("trust proxy", 1);

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 500,
  message: { error: "Too many requests" },
});
app.use("/api/", limiter);

// Stricter rate limit for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many authentication attempts" },
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/notes", notesRouter);
app.use("/api/friends", friendsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/fitness", fitnessRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/watch", watchRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/finance", financeRouter);
app.use("/api/study", studyRouter);
app.use("/api/schedule", scheduleRouter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.use("/api", miscRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Init Firebase (replaces SQLite init)
initFirebase();

// Realtime
initRealtime(server);

// Start
server.listen(config.port, "0.0.0.0", () => {
  console.log(`🌸 Server running on http://0.0.0.0:${config.port}`);
  console.log(`🌸 Environment: ${config.nodeEnv}`);
});
