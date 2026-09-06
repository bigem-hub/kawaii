#!/usr/bin/env node
/**
 * deploy-rules.mjs
 * Deploy Firebase RTDB security rules using the service account.
 * Uses google-auth-library for token generation and the RTDB REST API.
 *
 * Usage:
 *   node scripts/deploy-rules.mjs
 */
import "dotenv/config";
import { GoogleAuth } from "google-auth-library";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Load service account
const saPath = path.resolve(ROOT, "server/service-account.json");
if (!fs.existsSync(saPath)) {
  console.error("No service account found at", saPath);
  process.exit(1);
}
const sa = JSON.parse(fs.readFileSync(saPath, "utf-8"));

// Load rules
const rulesPath = path.resolve(ROOT, "server/database.rules.json");
const rules = fs.readFileSync(rulesPath, "utf-8");

const DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  "https://kawaiilife-55132-default-rtdb.firebaseio.com/";

// Get access token using google-auth-library
const auth = new GoogleAuth({
  credentials: sa,
  scopes: ["https://www.googleapis.com/auth/firebase.database"],
});

async function deploy() {
  const client = await auth.getIdTokenClient();
  const url = new URL(DATABASE_URL);
  const host = url.hostname;

  // Get the ID token
  const idToken = await client.idTokenClient.fetchIdToken(
    `https://${host}`
  );

  const dbUrl = `https://${host}/.settings/rules.json`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      dbUrl,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(rules),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          console.log(`Status: ${res.statusCode}`);
          if (res.statusCode === 200) {
            console.log("✅ Rules deployed successfully");
          } else {
            console.error(`❌ Deploy failed: ${body.slice(0, 300)}`);
          }
          resolve({ status: res.statusCode, body });
        });
      }
    );
    req.on("error", reject);
    req.write(rules);
    req.end();
  });
}

deploy()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err.message);
    process.exit(1);
  });
