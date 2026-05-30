# Stack: WhatsApp AI Sales SaaS

**Last updated:** 2026-05-30

## Languages

- **TypeScript** — 100% of codebase (both frontend and backend)
- **CSS** — Tailwind CSS v4 via `index.css`

## Runtime

- **Node.js** 20+ (Alpine in Docker, local dev via `tsx`)
- **Package manager:** npm
- **Module system:** ESM (`"type": "module"` in package.json)

## Frontend

| Technology | Purpose | Version |
|-----------|---------|---------|
| React | UI framework | ^19.0.1 |
| Vite | Build tool / dev server | ^6.2.3 |
| TypeScript | Type safety | ~5.8.2 |
| Tailwind CSS | Utility-first CSS | ^4.1.14 |
| React Router-like | Tab-based SPA (custom routing via state) | — |
| Motion (framer-motion) | Animations | ^12.23.24 |
| Lucide React | Icons | ^0.546.0 |
| Recharts | Charts (dashboard) | ^3.8.1 |
| D3 | Data visualization (dashboard) | ^7.9.0 |
| qrcode.react | QR code display | ^4.2.0 |

## Backend

| Technology | Purpose | Version |
|-----------|---------|---------|
| Express | HTTP server | ^4.21.2 |
| tsx | TypeScript execution (dev & prod) | ^4.21.0 |
| Prisma | ORM / database client | ^7.8.0 |
| PostgreSQL | Database (via Supabase) | — |
| Multer | File upload handling | ^2.1.1 |
| node-cron | Scheduled tasks | ^4.2.1 |
| Nodemailer | Email sending (OTP, reports) | ^8.0.7 |
| bcryptjs | Password hashing | ^3.0.3 |
| jsonwebtoken | JWT auth tokens | ^9.0.3 |
| uuid | Unique ID generation | ^11.1.1 |
| dotenv | Environment config | ^17.2.3 |

## AI Integration

| Technology | Purpose | Version |
|-----------|---------|---------|
| @google/genai | Gemini AI SDK | ^1.29.0 |
| Gemini models | AI sales agent, content generation | gemini-2.0-flash (configurable) |

## External Services

| Service | Purpose | Configuration |
|---------|---------|---------------|
| **Gemini AI** | AI sales agent, content generation, image gen | `GEMINI_API_KEY`, configurable per admin |
| **WhatsApp Web** | WhatsApp messaging via `whatsapp-web.js` | QR auth per admin tenant |
| **PostgreSQL (Supabase)** | Main database | `DATABASE_URL` |
| **Stripe** | Subscription billing (optional, mock mode fallback) | `STRIPE_SECRET_KEY` |
| **Firebase** | Optional Firestore backend | `FIREBASE_*` env vars (opt-in) |
| **SMTP** | Email (OTP, reports) | `SMTP_HOST/PORT/USER/PASS` |
| **Telegram Bot API** | Telegram messaging channel | Per-admin bot token |
| **Facebook Graph API** | Facebook/Instagram publishing | `FACEBOOK_CLIENT_ID/SECRET` |

## Infrastructure

- **Docker** — Multi-stage build (frontend build → production runner)
- **Docker Compose** — Single service deployment with persistent volumes for WhatsApp auth/cache
- **Chromium** — Required by `whatsapp-web.js` (bundled in Docker)

## Configuration

- `.env` — Environment variables (DB, API keys, Stripe, SMTP)
- `settings.json` — Per-instance runtime settings (admin-level config fallback)
- `prisma.config.ts` — Prisma schema reference
- `tsconfig.json` — TypeScript config (ES2022, bundler resolution, React JSX)
