# Structure: WhatsApp AI Sales SaaS

**Last updated:** 2026-05-30

## Directory Layout

```
whatsapp-ai-sales-saas/
├── .env                    # Environment variables (git-ignored)
├── .env.example            # Environment template
├── .gitignore
├── package.json            # All deps (frontend + backend combined)
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Vite config (proxy, build, plugins)
├── server.ts               # Express server + API routes (1800+ lines)
├── index.html              # SPA entry HTML
├── Dockerfile              # Multi-stage production build
├── docker-compose.yml      # Single service + volumes
├── prisma/
│   ├── schema.prisma       # DB schema (7 models)
│   ├── config.ts           # Prisma config
│   └── migrations/         # Auto-generated migrations
├── backend/
│   ├── lib/
│   │   ├── whatsappClient.ts   # WhatsApp Web client manager
│   │   └── seed.ts             # DB seeding
│   ├── scripts/
│   │   └── migrateBase64Images.ts  # Data migration script
│   └── services/
│       ├── authService.ts         # JWT, password hashing
│       ├── dbService.ts           # Prisma data access (737 lines)
│       ├── aiService.ts           # Gemini AI sales responses (502 lines)
│       ├── aiLearningService.ts   # AI learning patterns
│       ├── aiRetryQueue.ts        # Queue for failed AI calls
│       ├── messageHandler.ts      # Incoming message pipeline (227 lines)
│       ├── smartNegotiationService.ts  # Discount negotiation (417 lines)
│       ├── leadQualificationService.ts  # Lead scoring (373 lines)
│       ├── stateService.ts        # Session state transitions
│       ├── stripeService.ts       # Subscriptions & billing (409 lines)
│       ├── otpService.ts          # Email OTP verification
│       ├── emailService.ts        # SMTP email sending
│       ├── paymentService.ts      # Payment screenshot analysis
│       ├── reEngagementService.ts # Customer re-engagement
│       ├── dynamicPricingService.ts  # Dynamic pricing logic
│       ├── telegramService.ts     # Telegram bot integration
│       ├── instagramService.ts    # Instagram API integration
│       └── facebookService.ts     # Facebook API integration
├── src/
│   ├── main.tsx            # React entry point
│   ├── App.tsx             # Root component (sidebar nav, 561 lines)
│   ├── index.css           # Tailwind + global styles
│   ├── types.ts            # Shared TypeScript types
│   ├── empty-shim.ts       # Shim for node-fetch/undici
│   ├── hooks/
│   │   └── useFeatures.ts  # Feature flag hook
│   └── components/
│       ├── Dashboard.tsx       # Main dashboard
│       ├── LandingPage.tsx     # Public landing page
│       ├── Signin.tsx          # Login form
│       ├── Signup.tsx          # Registration form
│       ├── OnboardingWizard.tsx  # First-time setup wizard
│       ├── WhatsAppConnector.tsx  # QR scan + status
│       ├── LiveChat.tsx        # Real-time chat UI
│       ├── ChatWidget.tsx      # Chat bubble widget
│       ├── BotTester.tsx       # WhatsApp simulator
│       ├── ProductManager.tsx  # Product CRUD
│       ├── DealManager.tsx     # Deals/offers CRUD
│       ├── OrderVerifier.tsx   # Payment verification
│       ├── BroadcastManager.tsx  # Bulk messaging
│       ├── ReEngagement.tsx    # Re-engagement campaigns
│       ├── AutoPublisher.tsx   # Multi-channel publishing
│       ├── Channels.tsx        # Channel configuration
│       ├── Billing.tsx         # Subscription management
│       ├── PaymentSettings.tsx  # Payment gateway config
│       ├── ReportManager.tsx   # Sales reports & analytics
│       ├── Settings.tsx        # Admin settings
│       ├── SuperAdmin.tsx      # Super admin panel
│       ├── Help.tsx            # Help/documentation
│       └── channelIcons.tsx    # Channel SVG icons
├── uploads/               # Uploaded media files
├── dist/                  # Vite build output
├── publications.json      # Published content history
├── mock_products.json     # Mock product data
└── docs/                  # Documentation files
```

## Naming Conventions

- **Files:** PascalCase for React components (`WhatsAppConnector.tsx`), camelCase for services (`dbService.ts`), kebab-case for config (`prisma.config.ts`)
- **Variables:** camelCase throughout
- **Interfaces/Types:** PascalCase (`Session`, `Product`, `Order`)
- **Enums:** PascalCase (`SalesState`)
- **API Routes:** kebab-case (`/api/email-report/settings`)
- **Database models:** PascalCase (`Admin`, `Product`, `Session`, `Order`)

## Key Locations

| Concern | Location |
|---------|----------|
| Server entry + all API routes | `server.ts` |
| All database operations | `backend/services/dbService.ts` |
| AI conversation logic | `backend/services/aiService.ts` |
| Message processing pipeline | `backend/services/messageHandler.ts` |
| WhatsApp client management | `backend/lib/whatsappClient.ts` |
| Subscription & billing | `backend/services/stripeService.ts` |
| Frontend root component | `src/App.tsx` |
| All UI components | `src/components/` |
| Prisma schema (DB models) | `prisma/schema.prisma` |
| Shared types | `src/types.ts` |
