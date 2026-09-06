/**
 * Firebase Admin SDK initialization — server-side only.
 *
 * The service-account JSON must be provided via the FIREBASE_SERVICE_ACCOUNT
 * environment variable (raw JSON string). It is NEVER exposed to the
 * frontend or included in the Android APK.
 *
 * Alternatively, place a file at server/service-account.json (already
 * gitignored by the root .gitignore) and the code will pick it up as a
 * fallback when FIREBASE_SERVICE_ACCOUNT is not set.
 */
import { initializeApp, cert, App } from "firebase-admin/app";
import { getDatabase, Database } from "firebase-admin/database";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let app: App;
let rtdb: Database;

/**
 * Initialize Firebase Admin. Safe to call multiple times — only the first
 * call actually initializes the app.
 */
export function initFirebase(): App {
  if (app) return app;

  const databaseUrl =
    process.env.FIREBASE_DATABASE_URL ||
    "https://kawaiilife-55132-default-rtdb.firebaseio.com/";

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountRaw) {
    // Parse JSON string from env var
    let serviceAccount: object;
    try {
      serviceAccount = JSON.parse(serviceAccountRaw);
    } catch (err) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT is set but contains invalid JSON. " +
          "Ensure it is the raw JSON string, not a file path."
      );
    }

    app = initializeApp({
      credential: cert(serviceAccount as any),
      databaseURL: databaseUrl,
    });
  } else {
    // Fallback: look for a local service-account file at server/service-account.json
    const saPath = path.resolve(__dirname, "../service-account.json");
    if (fs.existsSync(saPath)) {
      const raw = fs.readFileSync(saPath, "utf-8");
      const serviceAccount = JSON.parse(raw);
      app = initializeApp({
        credential: cert(serviceAccount),
        databaseURL: databaseUrl,
      });
    } else {
      throw new Error(
        "No Firebase credentials found.\n" +
          "Set FIREBASE_SERVICE_ACCOUNT env var to the service-account JSON string,\n" +
          "or place a service-account.json file in the server/ directory.\n" +
          "See .env for instructions."
      );
    }
  }

  rtdb = getDatabase(app);
  console.log("✅ Firebase Admin SDK initialized (Realtime Database)");
  return app;
}

/**
 * Get the Realtime Database reference. Calls initFirebase() if needed.
 */
export function getDB(): Database {
  if (!rtdb) initFirebase();
  return rtdb;
}
