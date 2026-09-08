/**
 * Vercel serverless entrypoint — runs inside the `web` project.
 *
 * When the web project's Root Directory is set to the repo root, Vercel
 * compiles this file as a Function and routes /api/* requests to it.
 * Express handles all API routing internally.
 *
 * Firebase initializes lazily via getDB() so the module loads cleanly
 * even before env vars are set; routes that need the DB will then fail
 * with a clean 500 until FIREBASE_SERVICE_ACCOUNT is configured.
 *
 * Socket.IO is NOT available here (serverless can't hold persistent
 * connections); the REST API works fully.
 */
import { createApp } from "../server/src/app.js";

export default createApp();
