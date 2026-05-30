# Integrations: WhatsApp AI Sales SaaS

**Last updated:** 2026-05-30

## WhatsApp (Primary Channel)

- **Library:** `whatsapp-web.js` v1.34.7
- **Auth:** QR code authentication via `LocalAuth` (session persisted to `.wwebjs_auth/`)
- **Multi-tenant:** Per-admin WhatsApp instances managed via `Map<string, WhatsAppInstance>`
- **Features:** Send/receive messages, media, contact blocking, status updates
- **Limitations:** Requires Chromium; depends on WhatsApp Web session stability; single device per admin

**Files:**
- `backend/lib/whatsappClient.ts` — Client management (init, QR, send, reconnect)
- `backend/services/messageHandler.ts` — Incoming message processing pipeline

## Gemini AI

- **Library:** `@google/genai` v1.29.0
- **Models used:**
  - `gemini-2.0-flash` — AI sales agent conversation
  - `gemini-2.0-flash-exp` — Image generation
  - Configurable via `geminiModel` per-admin setting
- **API key:** Per-admin setting (stored in DB, fallback to `GEMINI_API_KEY` env)
- **Usage:** Sales conversation, content generation, product post creation, image generation

**Files:**
- `backend/services/aiService.ts` — Sales response generation (502 lines)
- `backend/services/aiLearningService.ts` — Learning from sales patterns
- `server.ts` (lines 1080-1273) — Product post & media generation endpoints

## Stripe (Billing)

- **Library:** `stripe` v22.1.1
- **Mode:** Mock mode when `STRIPE_SECRET_KEY` not set (instant upgrades)
- **Plans:** Free Trial (30 convos), Basic (300, Rs.1500), Professional (unlimited, Rs.3500), Enterprise (custom)
- **Features:** Checkout sessions, billing portal, webhook handling, usage limits
- **Currency:** PKR

**Files:**
- `backend/services/stripeService.ts` — Plans, checkout, billing, limits (409 lines)

## PostgreSQL (Database)

- **Provider:** Prisma ORM with `@prisma/adapter-pg`
- **Connection:** Pooled via `pg` with max 3 connections, 60s keep-alive
- **Host:** Supabase (port 6543 for transaction mode to avoid PgBouncer limits)
- **SSL:** Enabled with `rejectUnauthorized: false`

**Files:**
- `prisma/schema.prisma` — 6 models: Admin, Product, Session, Message, OtpStore, Deal, Order
- `backend/services/dbService.ts` — Data access layer (737 lines)

## Telegram

- **API:** Telegram Bot API (HTTP)
- **Multi-tenant:** Per-admin bot tokens stored in DB settings
- **Features:** Send/receive messages, webhook registration, image/video posts
- **Webhook URL format:** `/api/webhook/telegram/{adminId}`

**Files:**
- `backend/services/telegramService.ts`

## Facebook / Instagram

- **API:** Facebook Graph API v18.0
- **Features:** Page posting, Instagram media publishing (images, reels/videos)
- **Auth:** OAuth flow with Facebook login, page access tokens
- **Instagram:** Requires Instagram Business Account linked to Facebook Page

**Files:**
- `backend/services/facebookService.ts`
- `backend/services/instagramService.ts`
- `server.ts` (lines 306-410) — OAuth callback handling

## SMTP / Email

- **Provider:** Configurable (defaults to Gmail SMTP)
- **Features:** OTP verification email, daily sales reports, test emails
- **Scheduling:** Daily reports via `node-cron` at configurable hour

**Files:**
- `backend/services/emailService.ts`
- `backend/services/otpService.ts`

## Firebase (Optional)

- **Status:** Optional — uses in-memory mock when not configured
- **Service:** Firestore for admin settings storage
- **Configuration:** 14 env vars required (`FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, etc.)
