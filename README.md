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

## 🐳 Docker Setup

Containerize the whole app (frontend + backend) with Docker Compose. The
database stays Firebase Realtime Database — no extra DB container.

### Requirements

- Docker (Desktop on Windows/Mac)
- Docker Compose (bundled with Docker Desktop)

### Configuration

```bash
cp .env.example .env
#   → set JWT_SECRET, FIREBASE_DATABASE_URL, and FIREBASE_SERVICE_ACCOUNT
#   → optional: VITE_FIREBASE_* for Study Room RTDB signaling
```

The backend **will not start** without `FIREBASE_SERVICE_ACCOUNT` — paste the
raw JSON of your service-account file into `.env` (single line).

### Start

```bash
docker compose up -d --build
```

- Frontend: <http://localhost> (or `http://localhost:8080` if port 80 is taken
  — set `WEB_PORT=8080` in `.env`)
- Backend API: `http://localhost:3001/api/health` (set `BACKEND_PORT=` to change)

### View logs

```bash
docker compose logs -f
# per service:
docker compose logs backend
docker compose logs frontend
```

### Stop

```bash
docker compose down
```

Add `-v` to also delete the uploads volume (`docker compose down -v`).

### Rebuild

```bash
docker compose up -d --build
```

### Check containers

```bash
docker compose ps
```

### Architecture

```
Browser
   │  http://localhost (docker: kawaii-frontend, port 80)
   ▼
Nginx (web/Dockerfile → nginx.conf)
   ├── /           → React app (Vite-built static bundle)
   ├── /api/*      → backend (proxied)
   └── /socket.io/ → backend (proxied, WebSocket upgrade)
                        │  (docker network kawaii-net)
                        ▼
                     Node/Express (server/Dockerfile, port 3001)
                        │
                        ▼
                     Firebase RTDB (external, via Admin SDK)
```

- Services talk over the private `kawaii-net` bridge network using Compose
  service names (`backend`), never hard-coded IPs or localhost.
- Both images are multi-stage: full workspace install + compile in a builder
  stage, then slim runtime (non-root user, Alpine based).
- File uploads persist in the named `uploads_data` volume
  (`/app/server/uploads` in the container).

### Environment variables

| Var | Used by | Required |
|-----|---------|----------|
| `JWT_SECRET` | backend | ✅ |
| `FIREBASE_DATABASE_URL` | backend | ✅ |
| `FIREBASE_SERVICE_ACCOUNT` | backend | ✅ |
| `JWT_EXPIRES_IN`, `MAX_FILE_SIZE`, `UPLOAD_DIR` | backend | optional |
| `VITE_API_URL`, `VITE_WS_URL` | frontend build | optional (defaults are correct for Docker) |
| `VITE_FIREBASE_API_KEY` / `AUTH_DOMAIN` / `PROJECT_ID` / `DATABASE_URL` | frontend build (Study Room realtime) | optional |
| `WEB_PORT`, `BACKEND_PORT` | compose port mapping | optional |

Vite `VITE_*` variables are baked in at image build time — after changing them
you must rebuild the frontend image (`docker compose build frontend`).

### Troubleshooting

- **Backend exits at startup**: `FIREBASE_SERVICE_ACCOUNT` is missing or not
  valid JSON → check `docker compose logs backend`.
- **Port 80 in use**: set `WEB_PORT=8080` in `.env`, then `docker compose up -d`.
- **Frontend shows old API URL**: `VITE_WS_URL`/`VITE_API_URL` are build-time —
  rebuild: `docker compose build frontend && docker compose up -d`.
- **Backend healthy but frontend not starting**: frontend waits for the
  backend health check (`/api/health`); watch `docker compose ps` until the
  `backend` health column is healthy.
- **Logs are noisy**: `docker compose logs --tail=100 backend`.

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
