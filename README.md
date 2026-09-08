# KawaiiLife 🌸

> A cute all-in-one productivity ecosystem — tasks, notes, chat, fitness, finance, study rooms & more.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit%20Site-ff69b4?style=for-the-badge&logo=vercel)](https://web-git-main-bigem.vercel.app)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/bigem/web)

## ✨ Features

- **Dashboard** — at-a-glance overview of your day
- **Tasks** — categorized tasks with subtasks, priorities, recurring rules, and streaks
- **Notes** — rich-text notes with sharing and comments
- **Study** — virtual study rooms, Pomodoro timer, scientific calculator, slash-command editor
- **Finance** — track income, expenses, and budgets
- **Schedule** — study timetable and subject planning
- **Fitness** — daily entries, cardio log, workout routines & sessions with statistics
- **Calendar** — events, reminders, and a combined daily view
- **Chat** — direct conversations with reactions and edits (Socket.IO realtime)
- **Friends** — friend requests, social links, presence
- **Watch Party** — synchronized video rooms with live chat (Socket.IO)
- **Notifications** — app notifications + achievements

## 🏗️ Architecture

| Piece | Stack | Location |
|-------|-------|----------|
| Web app | React 19 + Vite + TanStack Query + Tailwind | `web/` |
| API server | Node + Express 4 + TypeScript | `server/` |
| Database | Firebase Realtime Database | server-side via Admin SDK |

- The Express server compiles to `dist/` via `tsc`.
- The web dev server (`web/`) proxies `/api` → `http://localhost:3001`.
- Firebase rules live at `server/database.rules.json`.
- The Admin SDK uses a service-account JSON at `server/service-account.json` (never committed).

## 🚀 Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Configure the server environment
cp server/.env.example server/.env
#   → set FIREBASE_DATABASE_URL, JWT secret, etc.

# 3. Place your Firebase service account at server/service-account.json

# 4. Start the API server (port 3001)
cd server && npm run dev

# 5. In another terminal, start the web app (port 5173)
cd web && npm run dev
```

## 🧪 Regression Testing

```bash
node scripts/regression-test.mjs               # defaults to http://localhost:3001
node scripts/regression-test.mjs http://localhost:9876   # custom base URL
```

Covers auth, tasks, notes, friends, chat, fitness, calendar, watch party, notifications, achievements, and profiles.

## 🔐 Security

- Server-side Firebase Admin SDK only — credentials are never committed.
- No private credentials or service-account JSONs are compiled into the frontend.

## 📄 License

Private project.
