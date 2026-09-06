# KawaiiLife 🌸

A cute productivity ecosystem — a React web app, a Node/Express REST API, and an Android app — sharing one Firebase Realtime Database.

## ✨ Features

- **Authentication** — email/password login with JWT
- **Tasks** — categorized tasks with subtasks, priorities, recurring rules, and streaks
- **Notes** — rich-text notes with sharing and comments
- **Friends** — friend requests, social links, presence
- **Chat** — direct conversations with reactions and edits (Socket.IO realtime)
- **Fitness** — daily entries, cardio log, workout routines & sessions with statistics
- **Calendar** — events, reminders, and a combined daily view
- **Notifications** — app notifications + achievements
- **Watch Party** — synchronized video rooms with live chat (Socket.IO)

## 🏗️ Architecture

| Piece | Stack | Location |
|-------|-------|----------|
| Web app | React 19 + Vite + TanStack Query + Socket.IO | `web/` |
| API server | Node + Express 4 + TypeScript | `server/` |
| Android app | Kotlin + Jetpack Compose + Retrofit | `android/` |
| Database | Firebase Realtime Database (migrated from SQLite/Drizzle) | server-side via Admin SDK |

- The Express server compiles to `dist/` via `tsc`.
- The web dev server (`web/`) proxies `/api` → `http://localhost:3001`.
- Firebase rules live at `server/database.rules.json` (deploy via Firebase Console).
- The Admin SDK uses a service-account JSON at `server/service-account.json` (never committed — see `.gitignore`).

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure the server environment
cp server/.env.example server/.env
#   → set FIREBASE_DATABASE_URL, JWT secret, etc.

# 3. (No local DB needed) — point the server at your Firebase project
#    by placing your service-account JSON at server/service-account.json

# 4. Start the API server (port 3001)
cd server && npm run dev

# 5. In another terminal, start the web app (port 5173)
cd web && npm run dev
```

## 🧪 Regression Testing

An API-level regression suite exercises the full contract the web and Android apps depend on:

```bash
node scripts/regression-test.mjs        # defaults to http://localhost:3001
node scripts/regression-test.mjs http://localhost:9876   # custom base URL
```

Covers auth, tasks, notes, friends, chat, fitness, calendar, watch party, notifications, achievements, and profiles.

## 🔐 Security

- Server-side Firebase Admin SDK only — credentials are never committed.
- No private credentials or service-account JSONs are compiled into the frontend or Android APK.

## 📄 License

Private project.