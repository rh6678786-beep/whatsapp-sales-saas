# Concerns: WhatsApp AI Sales SaaS

**Last updated:** 2026-05-30

## Critical Security Issues

### 1. Secrets Exposed in `settings.json`

**Location:** `settings.json`
**Severity:** 🔴 HIGH

The `settings.json` file contains live credentials:
- `geminiApiKey` — Google Gemini API key (plaintext)
- `adminPassword` — Admin login password (plaintext)
- `businessLogo` — Base64-encoded image data (large)

This file is **not git-ignored** and would be committed to version control. It should be added to `.gitignore` immediately and credentials rotated.

### 2. Hardcoded Bot Token

**Location:** `settings.json` line 28
**Severity:** 🔴 HIGH

Telegram bot token `8907152731:AAGrFrO3jh91lNQ3ti7U2D4u2f8fUOfb6po` is hardcoded in settings. This token should be in environment variables only.

### 3. Weak Admin Password

**Location:** `settings.json` line 5
**Severity:** 🟡 MEDIUM

`adminPassword: "pull8322"` — simple, guessable password.

### 4. Insecure JWT Secret

**Location:** `.env.example` line 38
**Severity:** 🟡 MEDIUM

`JWT_SECRET=change-this-to-a-random-secret-in-production` — may not have been changed in production.

## Technical Debt

### 1. Monolithic `server.ts`

**Location:** `server.ts` — ~1800+ lines
**Severity:** 🟡 MEDIUM

All API route definitions are in a single file. This makes the file hard to navigate, increases merge conflicts, and discourages modular routing. Should be split into route modules per domain (auth, products, sessions, billing, publish, etc.).

### 2. No Test Coverage

**Severity:** 🔴 HIGH

Zero test files exist. Complex business logic (AI conversation, negotiation, lead scoring) has no unit or integration tests. See `TESTING.md` for details.

### 3. In-Memory Simulator Store

**Location:** `backend/services/messageHandler.ts` lines 13-23
**Severity:** 🟢 LOW

Simulator uses an in-memory Map with manual cleanup. Not persisted — simulator data lost on restart. Acceptable for a testing tool but worth noting.

### 4. Mixed Concerns in App Component

**Location:** `src/App.tsx` — 561 lines
**Severity:** 🟢 LOW

Root component handles routing, auth, theme, sidebar, notification polling, and layout. Should be split into smaller focused components.

### 5. Publications via File System

**Location:** `server.ts` lines 529-542
**Severity:** 🟡 MEDIUM

Published content history stored in `publications.json` flat file instead of database. Not queryable, no indexing, concurrent write risks.

### 6. No Linting/Formatting

**Severity:** 🟡 MEDIUM

No ESLint, Prettier, or other formatter configured. No consistent code style enforcement.

## Architecture Concerns

### 1. WhatsApp Web Dependency

**Severity:** 🟡 MEDIUM

`whatsapp-web.js` depends on Chromium and WhatsApp Web protocol, which can break without notice. Session stability depends on user's WhatsApp Web staying connected.

### 2. Docker Chromium Size

**Location:** `Dockerfile`
**Severity:** 🟢 LOW

Chromium adds ~300MB to the production Docker image. Consider using a smaller browser or puppeteer-friendly base image.

### 3. No Rate Limiting

**Severity:** 🟡 MEDIUM

No rate limiting on API endpoints. Could be abused for brute force auth attempts or resource exhaustion.

### 4. Composite Keys in Database

**Location:** `prisma/schema.prisma`
**Severity:** 🟢 LOW

Session and Order models use composite primary keys `[adminId, id]`. This works but differs from standard single-ID patterns and may complicate migrations or joins.

## Performance

- **No caching layer** — every API call hits the database directly
- **No pagination limits** enforced on all list endpoints (some use defaults)
- **Large JSON body limit** (50mb) — may impact memory under load
- **No CDN** for uploaded media (served directly from Express `uploads/`)
- **Keep-alive pings** every 60 seconds to prevent Supabase idle disconnect

## Missing Features / Gaps

- No CI/CD pipeline configured
- No monitoring or observability tools
- No error tracking (Sentry, etc.)
- No structured logging
- No database migration strategy (uses `prisma db push` with `--accept-data-loss`)
