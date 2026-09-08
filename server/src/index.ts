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
