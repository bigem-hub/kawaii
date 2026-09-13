# ─── Backend Dockerfile ──────────────────────────────────────────────────────
# Multi-stage build: install workspace deps at root, compile TypeScript,
# then run server as a non-root user.
#
# Build context MUST be the repo root (the workspace lockfile lives there):
#   docker build -f server/Dockerfile .          # from repo root
#   (Compose already uses `context: .` + `dockerfile: server/Dockerfile`)
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: Build
FROM node:22-alpine AS builder

# Build tools for better-sqlite3 native compilation on Alpine
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json

# Install ALL workspace dependencies (dev deps needed for tsc build)
RUN npm ci

# Copy server source and compile
COPY server/tsconfig.json server/tsconfig.json
COPY server/src server/src

WORKDIR /app/server
RUN npm run build

# Trim dev dependencies — production runtime only
WORKDIR /app
RUN npm prune --omit=dev

# Stage 2: Production runtime
FROM node:22-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

WORKDIR /app

# Copy compiled server + pruned production dependencies
COPY --from=builder --chown=nodejs:nodejs /app/server/dist server/dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json package.json
COPY --from=builder --chown=nodejs:nodejs /app/server/package.json server/package.json
COPY --from=builder --chown=nodejs:nodejs /app/node_modules node_modules

# Create upload directory with proper permissions
RUN mkdir -p /app/server/uploads && chown -R nodejs:nodejs /app/server/uploads

# Switch to non-root user
USER nodejs

# Expose backend port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start the backend
CMD ["node", "server/dist/index.js"]