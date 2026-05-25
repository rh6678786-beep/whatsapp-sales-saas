# WhatsApp AI Sales SaaS — Complete Technical Documentation

## 1. Project Overview

**Purpose:** A multi-tenant SaaS platform that lets store owners deploy an AI sales agent inside WhatsApp. The AI handles conversations, shows products, negotiates prices, collects payments, and confirms orders — all automated.

**Tech Stack:**
| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite 6 + TailwindCSS 4 + Motion (Framer Motion) |
| Backend | Express.js (Node.js) + TypeScript |
| Database | PostgreSQL (Supabase) + Prisma ORM |
| AI | Google Gemini API (`@google/genai`) |
| WhatsApp | whatsapp-web.js (puppeteer-based) |
| Payments | Stripe + JazzCash/EasyPaisa (manual) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Email | Nodemailer (SMTP) |
| Scheduling | node-cron |

---

## 2. Project Structure

```
whatsapp-ai-sales-saas/
├── backend/
│   ├── lib/
│   │   ├── seed.ts                     # Database seed script
│   │   └── whatsappClient.ts           # WhatsApp Web.js client wrapper
│   ├── services/
│   │   ├── aiLearningService.ts        # AI learning patterns from past conversations
│   │   ├── aiService.ts                # Google Gemini AI integration — core sales logic
│   │   ├── authService.ts              # JWT generation, password hashing, validation
│   │   ├── dbService.ts                # Database CRUD (admin, products, sessions, orders, OTP)
│   │   ├── dynamicPricingService.ts    # AI-based dynamic pricing suggestions
│   │   ├── emailService.ts             # Daily email reports via SMTP
│   │   ├── facebookService.ts          # Facebook Messenger channel integration
│   │   ├── instagramService.ts         # Instagram channel integration
│   │   ├── leadQualificationService.ts # AI lead scoring and qualification
│   │   ├── messageHandler.ts           # Incoming message routing & AI response logic
│   │   ├── otpService.ts               # OTP generation, email sending, verification
│   │   ├── paymentService.ts           # Payment screenshot analysis (AI) & gateway config
│   │   ├── reEngagementService.ts      # Automated follow-up / re-engagement campaigns
│   │   ├── smartNegotiationService.ts  # AI price negotiation logic
│   │   ├── stateService.ts             # Session state machine (NEW → ORDER_CONFIRMED)
│   │   ├── stripeService.ts            # Stripe subscriptions, trial, plan limits
│   │   └── telegramService.ts          # Telegram channel integration
│   └── scripts/
│       └── migrateBase64Images.ts
├── prisma/
│   └── schema.prisma                   # Database schema (6 models)
├── src/
│   ├── components/                     # 20 React components
│   │   ├── App.tsx                     # Root component, routing, auth state, sidebar
│   │   ├── LandingPage.tsx            # Marketing landing page
│   │   ├── Login.tsx                   # Login/Register with OTP email verification
│   │   ├── Dashboard.tsx              # Main analytics dashboard
│   │   ├── WhatsAppConnector.tsx       # WhatsApp QR code scanner
│   │   ├── LiveChat.tsx               # Real-time chat interface
│   │   ├── ProductManager.tsx         # Product CRUD with media upload
│   │   ├── OrderVerifier.tsx          # Payment screenshot verification
│   │   ├── Billing.tsx                # Subscription plans & usage
│   │   ├── Settings.tsx               # Store settings, password, SMTP config
│   │   ├── BroadcastManager.tsx       # Bulk WhatsApp messaging
│   │   ├── ReEngagement.tsx           # Automated follow-up campaigns
│   │   ├── Channels.tsx               # Multi-channel management
│   │   ├── PaymentSettings.tsx        # Payment gateway configuration
│   │   ├── BotTester.tsx              # AI conversation simulator
│   │   ├── ReportManager.tsx          # Sales reports & analytics
│   │   ├── SuperAdmin.tsx             # Platform-wide admin panel
│   │   ├── OnboardingWizard.tsx       # New user setup wizard
│   │   ├── Help.tsx                   # Help & documentation
│   │   └── channelIcons.tsx           # Channel icon components
│   ├── hooks/
│   │   └── useFeatures.ts             # Feature gating hook (based on subscription)
│   ├── types.ts                        # Shared TypeScript types & enums
│   ├── main.tsx                        # React entry point
│   └── index.css                       # Global styles
├── server.ts                           # Express server + all API routes (40 endpoints)
├── vite.config.ts                      # Vite configuration
├── tsconfig.json                       # TypeScript configuration
├── package.json                        # Dependencies & scripts
├── Dockerfile                          # Docker build
├── docker-compose.yml                  # Docker compose
├── .env                                # Environment variables (live)
├── .env.example                        # Environment template
└── prisma.config.ts                    # Prisma runtime config
```

---

## 3. Database Schema (Prisma — PostgreSQL)

### 3.1 Admin Model
Core table — one row per tenant/store.
- `adminId` (PK) — unique store identifier (e.g., "zia-store")
- `passwordHash` — bcrypt hashed password
- `verifiedEmail` (unique) — email verified via OTP
- `storeName`, `geminiApiKey`, `geminiModel` — AI configuration
- `jazzCashNumber`, `advanceAmount` — payment defaults
- `businessLogo`, `email`, `phone`, `address` — store info
- `onboardingComplete` — wizard completion flag
- `paymentConfig`, `reEngagement`, `subscription` — JSON blobs
- `facebook`, `instagram`, `telegram`, `tiktok` — channel configs
- `notificationEmail`, `smtpHost`, `smtpPort`, `smtpUser`, `smtpPass` — SMTP config
- `emailReportsEnabled` — daily report toggle
- `aiLearningPatterns` — AI learning data

### 3.2 Product Model
- `id` (UUID), `adminId` (FK), `name`, `price`, `costPrice`
- `features` (String[]) — PostgreSQL text array
- `images` (String[]), `videos` (String[]) — media URLs

### 3.3 Session Model
Represents a customer conversation.
- Composite PK: `(adminId, id)` where `id` is the customer phone/ID
- `userId` — raw identifier
- `state` — SalesState enum (NEW → ORDER_CONFIRMED → DELIVERED)
- `selectedProductId` — currently interested product
- `metadata` (Json) — leadScore, leadStatus, buying signals, etc.
- `isBlocked` — customer block flag
- `remindersCount`, `lastReminderAt` — re-engagement tracking

### 3.4 Message Model
Chat message history.
- `id`, `adminId`, `sessionId`
- `role` — "user" or "model"
- `text`, `timestamp`, `imageUrl`, `videoUrl`

### 3.5 Order Model
Confirmed orders with payment tracking.
- Composite PK: `(adminId, id)`
- `status` — PENDING → VERIFIED → SHIPPED → DELIVERED
- `paymentScreenshotUrl`, `shippingAddress`, `customerName`, `customerPhone`
- `amount`, `costPrice`, `trackingId`, `courier`

### 3.6 OtpStore Model
Temporary OTP storage for email verification.
- `email` (PK) — verified email
- `otp`, `adminId`, `password`, `storeName`, `expiresAt`, `createdAt`

---

## 4. API Routes (40 Endpoints)

### 4.1 Auth Routes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/send-otp` | Send OTP to email for registration |
| POST | `/api/auth/verify-otp` | Verify OTP + create account + start trial |
| POST | `/api/auth/register` | Direct registration (legacy) |
| POST | `/api/auth/login` | Login with adminId + password |
| PUT | `/api/auth/change-password` | Change password with old password verification |

### 4.2 Settings Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings` | Get all settings for current admin |
| POST | `/api/settings` | Update settings |
| GET | `/api/settings/profile` | Get profile (public) |
| PUT | `/api/settings/profile` | Update profile |
| POST | `/api/settings/verify-password` | Verify current password |

### 4.3 Product Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | List all products |
| POST | `/api/products` | Create product (with plan limit check) |
| DELETE | `/api/products/:id` | Delete product |

### 4.4 Session Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions` | List all active sessions |
| GET | `/api/sessions/:id/messages` | Get messages for a session |

### 4.5 WhatsApp Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/whatsapp/status` | Get WhatsApp connection status |
| POST | `/api/whatsapp/init` | Initialize WhatsApp client (QR code) |
| POST | `/api/whatsapp/logout` | Disconnect WhatsApp |
| POST | `/api/webhook/whatsapp` | Incoming WhatsApp message webhook |

### 4.6 Order Routes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/orders/:id/tracking` | Update tracking info |

### 4.7 Payment Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/payment/config` | Get payment gateway config |
| POST | `/api/payment/config` | Update payment gateway config |
| POST | `/api/payment/analyze-screenshot` | AI analysis of payment screenshot |

### 4.8 Billing Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/billing/plans` | List subscription plans |
| GET | `/api/billing/subscription` | Get current subscription status |
| GET | `/api/billing/features` | Get feature flags for current plan |

### 4.9 Other Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stats` | Dashboard statistics |
| POST | `/api/seed` | Seed sample data |
| POST | `/api/broadcast` | Broadcast message to customers |
| POST | `/api/upload` | File upload (multer) |
| GET | `/api/re-engagement/customers` | List inactive customers |
| POST | `/api/re-engagement/send-all` | Send re-engagement to all |
| POST | `/api/re-engagement/send-one` | Send re-engagement to one |
| POST | `/api/re-engagement/preview` | Preview re-engagement message |
| POST | `/api/re-engagement/schedule` | Schedule re-engagement cron |
| GET | `/api/stats/report` | Sales report data |
| GET | `/api/super/clients` | Super admin client list |
| POST | `/api/super/migrate-phantom` | Fix phantom admin records |
| GET | `/api/health` | Health check |

---

## 5. Authentication & Security

### 5.1 Flow
1. User registers with email → OTP sent via SMTP
2. OTP verified → account created with bcrypt-hashed password
3. Login → JWT token generated (24h expiry, HS256)
4. All subsequent API calls include `Authorization: Bearer <token>` header
5. Axios interceptor automatically attaches token to all requests
6. 401 responses trigger automatic logout

### 5.2 Password Policy
- Minimum 8 characters
- Requires: uppercase, lowercase, number, special character
- Stored as bcrypt hash (12 rounds)
- Master fallback: `ADMIN_PASSWORD` env var

---

## 6. Subscription & Billing

### 6.1 Plans
| Plan | Price | Sessions/Month | Products | Features |
|------|-------|---------------|----------|----------|
| Free | $0 | 30 | 5 | WhatsApp only |
| Starter | $29 | 500 | 25 | + Email reports |
| Professional | $79 | 1,500 | 100 | + All channels, re-engagement |
| Enterprise | $199 | Unlimited | Unlimited | + Priority support |

### 6.2 Trial System
- 7-day free trial on registration
- During trial → Professional plan features
- After trial → downgraded to Free plan
- Stripe integration for paid subscriptions (live keys configured)

---

## 7. AI Sales Agent (Gemini)

### 7.1 Conversation Flow (State Machine)
```
NEW → INTERESTED → PRODUCT_SELECTED → NEGOTIATING → PAYMENT_AWAITING
  → PAYMENT_SENT → VERIFIED → ORDER_CONFIRMED → DELIVERED
```

### 7.2 AI Capabilities
- Natural language sales conversations
- Product recommendations from catalog
- Price negotiation with smart discounts
- Payment screenshot analysis (AI vision)
- Lead scoring & qualification
- Multi-language support (Urdu, English, etc.)
- Dynamic pricing suggestions
- Buying signal detection
- Automated follow-ups

---

## 8. Multi-Channel Support

| Channel | Status | Implementation |
|---------|--------|----------------|
| WhatsApp | ✅ Live | whatsapp-web.js (QR code) |
| Facebook Messenger | 🔧 Partial | Facebook Graph API |
| Instagram | 🔧 Partial | Instagram Basic Display API |
| Telegram | 🔧 Partial | Telegram Bot API |
| TikTok | ❌ Not built | Schema supports it |

---

## 9. Frontend Architecture

### 9.1 Component Tree
```
App.tsx
├── LandingPage.tsx          (unauthenticated)
├── Login.tsx                (unauthenticated — OTP email verification)
├── OnboardingWizard.tsx     (first-time setup)
└── Authenticated Layout
    ├── Sidebar (navigation, theme toggle)
    ├── Dashboard.tsx
    ├── WhatsAppConnector.tsx + LiveChat.tsx + BroadcastManager.tsx
    ├── ProductManager.tsx
    ├── OrderVerifier.tsx
    ├── Billing.tsx
    ├── PaymentSettings.tsx
    ├── Channels.tsx
    ├── ReportManager.tsx
    ├── ReEngagement.tsx
    ├── BotTester.tsx
    ├── Settings.tsx
    ├── SuperAdmin.tsx
    └── Help.tsx
```

### 9.2 State Management
- React useState/useEffect (no Redux)
- localStorage for auth tokens, adminId, theme preference
- Axios interceptors for token injection & 401 handling

### 9.3 UI Framework
- TailwindCSS 4 with custom dark mode
- Motion (Framer Motion) for animations
- Lucide icons
- Recharts for charts/analytics
- QR Code (qrcode.react) for WhatsApp login

---

## 10. Deployment

### 10.1 Docker
- `Dockerfile` — multi-stage build (Node.js)
- `docker-compose.yml` — full stack setup

### 10.2 Environment Variables (.env)
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection (Supabase) |
| `JWT_SECRET` | Token signing secret |
| `GEMINI_API_KEY` | Google Gemini AI key |
| `STRIPE_SECRET_KEY` | Stripe payment processing |
| `STRIPE_*_PRICE_ID` | Stripe price IDs for plans |
| `SMTP_HOST/USER/PASS` | Email OTP sending |
| `ADMIN_PASSWORD` | Master password fallback |
| `APP_URL` | Public deployment URL |

### 10.3 Scripts
| Script | Command |
|--------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Production | `npm start` |
| Lint | `npm run lint` |
| DB push | `npx prisma db push` |
| DB generate | `npx prisma generate` |

---

## 11. Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| tsx (not ts-node) | Faster execution, ESM support, watch mode |
| Prisma (not raw SQL) | Type-safe queries, migrations, schema management |
| In-memory OTP with DB fallback | OTP survives server restart, uses existing pool |
| whatsapp-web.js | Battle-tested, supports multi-device |
| JWT (not sessions) | Stateless auth, no session store needed |
| Multi-tenant via adminId | Simple tenant isolation without complex multi-database |
| Google Gemini | Cost-effective, supports vision (screenshot analysis) |
