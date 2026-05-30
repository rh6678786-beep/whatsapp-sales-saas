# Architecture: WhatsApp AI Sales SaaS

**Last updated:** 2026-05-30

## System Overview

Single-server monolithic architecture with Express serving both the React SPA frontend and REST API backend. The application is an AI-powered WhatsApp sales agent platform where each admin (store owner) gets their own multi-tenant instance with product catalog, customer conversation management, and multi-channel publishing.

## Architecture Pattern

**Monolith with service-oriented internal structure.** The backend is organized into focused service modules within a single Express process. Frontend and backend are served from the same process in production; Vite proxies `/api` to Express in development.

## Request Flow

```
User (Browser) ──HTTP──→ Vite Dev Server (dev) / Express (prod)
                              │
                              ├── /api/auth/*       → Auth service
                              ├── /api/products/*   → DB service
                              ├── /api/sessions/*   → DB service
                              ├── /api/settings/*   → DB service
                              ├── /api/billing/*    → Stripe service
                              ├── /api/publish/*    → AI service + Channel APIs
                              ├── /api/whatsapp/*   → WhatsApp client
                              ├── /api/webhook/*    → Telegram/WhatsApp webhooks
                              └── /uploads/*        → Static file serve

WhatsApp ──Webhook──→ Message Handler → AI Service → DB Service → WhatsApp Send
Telegram ──Webhook──→ Telegram Service → AI Service → DB Service → Telegram Send
```

## Layers

### 1. Frontend SPA (React + Vite)

- **Routing:** Tab-based client-side routing via React state (no router library)
- **Components:** `src/components/` — 28 lazy-loaded components
- **State:** localStorage for auth + active tab; API calls for all data
- **Auth:** JWT token stored in localStorage, sent as `Authorization: Bearer` header
- **Styling:** Tailwind CSS v4 with dark/light theme toggle
- **Entry:** `src/main.tsx` → `src/App.tsx` (root component with sidebar navigation)

### 2. API Layer (Express)

- **Entry:** `server.ts` — Single file (~1800+ lines) containing all route definitions
- **Middlewares:** JSON body parser (50mb limit), JWT auth via header, file upload (multer)
- **Multi-tenant:** Admin ID extracted from JWT or `x-admin-id` header
- **Routes:** Auth, CRUD (products/sessions/deals/settings), billing, publish, WhatsApp, webhooks

### 3. Service Layer

- **`backend/services/`** — Business logic modules
- **`dbService.ts`** — Prisma-backed data access (all CRUD operations)
- **`aiService.ts`** — Gemini AI integration for sales conversation
- **`messageHandler.ts`** — Incoming message processing pipeline (lead scoring, negotiation, state machine)
- **`stripeService.ts`** — Subscription plans, billing, usage limits
- **`smartNegotiationService.ts`** — Discount negotiation logic
- **`leadQualificationService.ts`** — Lead scoring and classification
- **`stateService.ts`** — Session state machine transitions

### 4. Data Layer

- **PostgreSQL** via Prisma ORM
- **6 models:** Admin, Product, Session, Message, OtpStore, Deal, Order
- **Connection pooling:** `pg.Pool` with max 3 connections
- **Keep-alive:** 60-second ping to prevent Supabase idle termination

## Data Flow

### Sales Conversation Flow

```
1. Customer sends WhatsApp message
2. whatsappClient receives → calls messageHandler.processIncomingMessage()
3. messageHandler:
   a. Loads/creates session from DB
   b. Checks subscription limits
   c. Calls aiService.generateSalesResponse() with conversation history
   d. AI processes: qualifes lead, negotiates price, handles objections, suggests products
   e. Updates session state (state machine)
   f. Sends response back via WhatsApp
4. Message + response saved to DB (Message model)
```

### Publishing Flow

```
1. User creates post content in AutoPublisher UI
2. POST /api/publish with content, media, target platforms
3. Server dispatches to each platform's API:
   - Telegram: bot.sendMessage/sendPhoto
   - Facebook: graph.facebook.com feed/photos/videos
   - Instagram: graph.facebook.com media/media_publish (container-based)
   - WhatsApp: client.sendMessage (status update)
4. Publication recorded in publications.json
```

## Entry Points

| Entry | File | Purpose |
|-------|------|---------|
| Dev server | `server.ts` | `tsx server.ts` — starts Express + Vite dev |
| Production | `server.ts` | `NODE_ENV=production tsx server.ts` |
| Build | `vite build` | Builds frontend to `dist/` |
| Docker | `Dockerfile` | Multi-stage build for production deployment |
