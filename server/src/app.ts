import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { initFirebase } from "./firebase.js";

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
import musicRouter from "./routes/music.js";
import miscRouter from "./routes/misc.js";

/**
 * Build the Express app (no HTTP server, no Socket.IO, no listen).
 * Used both by the local entrypoint (index.ts) and by the Vercel
 * serverless function (api/index.ts) so behaviour stays identical.
 */
export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  // Security
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: [
        "http://localhost:5173",
        "https://web-git-main-bigem.vercel.app",
        /\.vercel\.app$/,
      ],
      credentials: true,
    })
  );
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
  app.use("/api/music", musicRouter);

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
    // Malformed JSON body should be a 400, not a 500
    if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
