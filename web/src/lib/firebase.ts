import { initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

/**
 * Firebase web SDK — used ONLY for Realtime Database signaling in the
 * Virtual Study Room. The REST API (auth, data) still goes through the
 * backend; this is purely the WebRTC signaling relay so the study room
 * works on Vercel serverless (the DB is shared state, not server memory).
 *
 * Requires VITE_FIREBASE_DATABASE_URL (+ apiKey/projectId) to be set at
 * build time. If missing, the study room degrades to a warning log and the
 * rest of the app keeps working.
 */

let app: FirebaseApp | null = null;
let db: Database | null = null;

export function getRTDB(): Database | null {
  const databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL as string | undefined;
  if (!databaseURL) {
    if (typeof console !== "undefined") {
      console.warn(
        "[firebase] VITE_FIREBASE_DATABASE_URL is not set — Virtual Study Room realtime is disabled."
      );
    }
    return null;
  }

  if (!db) {
    app = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      databaseURL,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    });
    db = getDatabase(app);
  }
  return db;
}
