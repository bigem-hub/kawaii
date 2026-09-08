/**
 * Vercel serverless entrypoint for the KawaiiLife API.
 *
 * The Express app from src/app.ts is exported directly — Vercel wraps it and
 * handles each request as a function invocation. Firebase is initialized
 * lazily on first DB access (see src/firebase.ts getDB()), so the module
 * loads cleanly even before FIREBASE_SERVICE_ACCOUNT is configured; routes
 * that need the DB will then fail with a clean 500 JSON until it is set.
 *
 * Socket.IO is NOT initialized here (serverless can't hold persistent
 * connections); the REST API (auth, tasks, notes, friends, fitness,
 * calendar, finance, study, schedule) works fully.
 */
import { createApp } from "../src/app.js";

export default createApp();
