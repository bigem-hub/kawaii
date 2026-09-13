import { createServer } from "http";
import { config } from "./config.js";
import { initFirebase } from "./firebase.js";
import { initRealtime } from "./realtime/index.js";
import { createApp } from "./app.js";

// Initialize Firebase (replaces SQLite init)
initFirebase();

// Build the Express app
const app = createApp();
const server = createServer(app);

// Realtime (Socket.IO) — local / persistent-hosting only
initRealtime(server);

// Start
server.listen(config.port, "0.0.0.0", () => {
  console.log(`🌸 Server running on http://0.0.0.0:${config.port}`);
  console.log(`🌸 Environment: ${config.nodeEnv}`);
});

// Graceful shutdown (Docker/k8s sends SIGTERM on stop)
let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${signal} received — shutting down gracefully…`);

  server.close(() => {
    console.log("🌸 HTTP server closed");
    process.exit(0);
  });

  // Force-exit if connections refuse to close within 10s
  setTimeout(() => {
    console.error("Forced exit after shutdown timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));