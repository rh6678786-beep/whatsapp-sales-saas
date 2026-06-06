# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-06

### Added

- **WhatsApp Cloud API** — Replaced old whatsapp-web.js (Puppeteer) with Meta's official WhatsApp Business Cloud API. Stateless REST API, no Chrome needed, webhook-based messaging, scalable to 1000+ tenants.
- **Multi-Channel Dashboard** — Social platform connectors for Facebook, Instagram, Telegram, and WhatsApp with status monitoring and OAuth setup flows.
- **AI Sales Agent** — Gemini-powered sales conversation engine with:
  - State machine (NEW → INTERESTED → PRODUCT_SELECTED → NEGOTIATING → PAYMENT → VERIFIED → ORDER_CONFIRMED → DELIVERED)
  - Prompt injection detection and output guards
  - AI memory with pgvector embeddings for long-term context
  - Smart negotiation and dynamic pricing
  - Lead qualification and scoring
- **Proactive Engine** — Automated outbound campaigns for abandoned carts, re-engagement, price drops, and birthday greetings.
- **Broadcast Center** — Bulk WhatsApp messaging with anti-ban protection (3s delays), template system, and live preview.
- **Auto Publisher** — Cross-platform publishing to Facebook, Instagram, Telegram, and WhatsApp with AI content enhancement and scheduling.
- **Payment Integration** — JazzCash, EasyPaisa, and Bank Transfer support with screenshot-based payment verification and AI analysis.
- **Order Tracking** — Courier tracking integration (Postex, TCS, Leopards, CallCourier, M&P) with WhatsApp delivery notifications.
- **Admin Dashboard** — Real-time sales analytics, conversion funnel visualization, activity feed, and purchase reporting.
- **Product Manager** — Full CRUD with media slideshow (images/videos), profit analysis, bulk import, and batch operations.
- **Deal Manager** — Combo deals and discount offers with product bundling and scheduling.
- **Re-Engagement** — AI-powered follow-up messages for inactive customers with configurable triggers.
- **Reporting** — Custom date-range profit reports and purchase history with print support.
- **Settings** — Store configuration, AI training (system instructions, personality, keywords, knowledge base), security (2FA, password change), and email report scheduling.
- **Authentication** — JWT-based auth with access tokens (15m), refresh tokens (7d) with blacklisting, OTP-based registration, team auth with role-based permissions.
- **Billing & Subscriptions** — Stripe integration with tiered plans (Starter, Professional, Enterprise) and usage limits.
- **Audit Logging** — All sensitive operations logged with admin context for compliance.
- **E2E Tests** — Playwright test suite covering critical flows (login, orders, products, WhatsApp).

### Changed

- **Prisma 7 Migration** — Upgraded from Prisma 6 to Prisma 7. Removed `url` from `schema.prisma` datasource block (now in `prisma.config.ts`).
- **Structured Logging** — All backend routes now use Pino structured logger instead of `console.log`/`console.error`, with correlation IDs, sensitive data redaction, and log levels.
- **User-Facing Error Notifications** — Frontend components now surface errors via `react-hot-toast` toasts instead of silent `console.error`.
- **Docker Optimizations** — Reduced image size by ~600MB by removing Chromium/Puppeteer dependencies. Removed stale `wwebjs_auth`/`wwebjs_cache` volumes.
- **Rate Limiting** — Tiered rate limiting (default 60/min, auth 10/min, API 120/min, webhook 30/min) with Redis backend and in-memory fallback.
- **CSRF Protection** — Single-use tokens bound to JWT sessions with Redis store and in-memory fallback.
- **Helmet CSP** — Strict Content Security Policy with HSTS preload.
- **Graceful Shutdown** — SIGTERM/SIGINT handling with 10s timeout for clean connection draining.

### Fixed

- **Prisma client generation** — Fixed `ERR_MODULE_NOT_FOUND` by aligning Prisma CLI version with `@prisma/client`.
- **Test environment configuration** — Fixed `environmentMatchGlobs` in Vitest config (517/517 tests passing).
- **Vitest 4 compatibility** — Fixed constructor mock functions in `aiService.test.ts`.
- **Error handler `getAdminId` crash** — Removed `getAdminId()` call from catch block in `products.ts` to prevent cascading auth errors.

### Security

- Environment validation on startup (missing vars, JWT strength, encryption key strength)
- Prompt injection protection (input sanitization + output guard)
- File upload validation (type, size, MIME, content, sanitization)
- DB connection error auto-recovery without server restart
- Non-root user in Docker container
- Sensitive data redaction in logs (API keys, passwords, tokens)
- TLS enforcement in production with HTTPS redirect

### Infrastructure

- Multi-stage Docker build (node:20-alpine) with production-only dependencies
- Docker Compose with health checks, resource limits, and logging for all services (app, Redis 7, PostgreSQL 16)
- Sentry error tracking with conditional DSN
- BullMQ queues for background jobs (AI retries, email, proactive engine)
- PostgreSQL connection pool with auto-reconnect
- Prisma migrate with graceful fallback to `db push`
