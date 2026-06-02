# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY backend ./backend
COPY src ./src
COPY index.html ./
COPY vite.config.ts ./
COPY vitest.config.ts ./

# Build frontend (vite bundles to dist/)
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install chromium + puppeteer dependencies
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  freetype-dev \
  harfbuzz \
  ca-certificates \
  ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

# Copy only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/tsconfig.json ./

EXPOSE 3000

# Use tsx to run the server (compiled backend + vite frontend)
CMD ["npx", "tsx", "server.ts"]
