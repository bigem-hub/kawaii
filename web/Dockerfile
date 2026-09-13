# ─── Frontend Dockerfile ─────────────────────────────────────────────────────
# Multi-stage build: install workspace deps at root, build React+Vite,
# then serve the static bundle with Nginx.
#
# Build context MUST be the repo root (the workspace lockfile lives there):
#   docker build -f web/Dockerfile .              # from repo root
#   (Compose already uses `context: .` + `dockerfile: web/Dockerfile`)
#
# VITE_* values are baked into the bundle at build time (Vite reads them
# from the environment) — pass them as build args.
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: Build
FROM node:22-alpine AS builder

# Build tools for better-sqlite3 (installed workspace-wide via npm ci)
RUN apk add --no-cache python3 make g++

# Vite inlines VITE_* env vars at bundle time
ARG VITE_API_URL=/api
ARG VITE_WS_URL=/
ARG VITE_FIREBASE_API_KEY=
ARG VITE_FIREBASE_AUTH_DOMAIN=
ARG VITE_FIREBASE_PROJECT_ID=
ARG VITE_FIREBASE_DATABASE_URL=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_WS_URL=$VITE_WS_URL \
    VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_DATABASE_URL=$VITE_FIREBASE_DATABASE_URL

WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json

# Install ALL workspace dependencies (vite/typescript are dev dependencies)
RUN npm ci

# Copy web source and build
COPY web/tsconfig.json web/tsconfig.json
COPY web/vite-env.d.ts web/vite-env.d.ts
COPY web/vite.config.ts web/vite.config.ts
COPY web/tailwind.config.js web/tailwind.config.js
COPY web/postcss.config.js web/postcss.config.js
COPY web/index.html web/index.html
COPY web/public web/public
COPY web/src web/src

WORKDIR /app/web
RUN npm run build

# Stage 2: Production runtime with Nginx
FROM nginx:1.27-alpine AS production

# Copy built assets from builder
COPY --from=builder /app/web/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY web/nginx.conf /etc/nginx/nginx.conf

# Expose HTTP port
EXPOSE 80

# Health check (busybox wget ships with nginx:alpine)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]