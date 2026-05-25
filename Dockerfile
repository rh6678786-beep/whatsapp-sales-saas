# ============================================
# Stage 1: Build frontend
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY . .
RUN npm run build

# ============================================
# Stage 2: Production server
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

# Install only production deps
COPY package*.json ./
RUN npm ci --production --ignore-scripts

# Copy built frontend + backend source
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/tsconfig.json ./

# whatsapp-web.js needs Chromium
RUN apk add --no-cache chromium
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

EXPOSE 3000

ENV NODE_ENV=production
CMD ["node_modules/.bin/tsx", "server.ts"]
