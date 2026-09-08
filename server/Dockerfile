FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all deps (need devDeps for tsc)
RUN npm ci

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build
RUN npm run build

# Prune dev deps
RUN npm prune --production

EXPOSE 3001

CMD ["node", "dist/index.js"]
