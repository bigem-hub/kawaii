/**
 * Vercel serverless entrypoint for the KawaiiLife API.
 *
 * The Express app from src/app.ts is exported directly — Vercel wraps it and
 * handles each request as a function invocation. Socket.IO is NOT initialized
 * here (serverless can't hold persistent connections); the REST API
 * (auth, tasks, notes, friends, fitness, calendar, finance, study, schedule)
 * works fully. Realtime features fall back to Firebase polling in the client.
 */
import { initFirebase } from "../src/firebase.js";
import { createApp } from "../src/app.js";

// Ensure Firebase is initialized on cold start
initFirebase();

export default createApp();
