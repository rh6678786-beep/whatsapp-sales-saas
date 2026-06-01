# SalesForce AI — WhatsApp AI Sales SaaS

## What This Is

A multi-tenant AI-powered WhatsApp sales agent platform for Pakistani e-commerce businesses. Store owners (admins) connect their WhatsApp number, manage a product catalog, and let an AI sales agent handle customer conversations — from lead qualification and product recommendations to price negotiation and order confirmation. Supports multi-channel publishing to WhatsApp, Telegram, Facebook, and Instagram.

## Core Value

AI autonomously handles sales conversations on WhatsApp so store owners never miss a customer or a sale.

## Requirements

### Validated

- ✓ Multi-tenant admin system with JWT auth + OTP email verification — existing
- ✓ WhatsApp Web integration with QR code auth per admin — existing
- ✓ Product catalog management (CRUD with images, features, pricing) — existing
- ✓ AI sales agent (Gemini) for customer conversations in Urdu/English/Arabic/Hindi/Bengali — existing
- ✓ Session state machine (NEW → INTERESTED → PRODUCT_SELECTED → NEGOTIATING → PAYMENT_AWAITING → PAYMENT_SENT → VERIFIED → ORDER_CONFIRMED → DELIVERED) — existing
- ✓ Smart price negotiation engine with discount limits — existing
- ✓ Lead qualification scoring (HOT/WARM/COLD) — existing
- ✓ Multi-channel: Telegram, Facebook, Instagram — existing
- ✓ Omnichannel publishing (create once, publish to multiple channels) — existing
- ✓ Customer re-engagement campaigns for inactive leads — existing
- ✓ Payment screenshot verification workflow — existing
- ✓ Broadcast messaging to customers — existing
- ✓ Subscription billing via Stripe (Free/Basic/Professional/Enterprise) — existing
- ✓ AI content generation for product posts and images — existing
- ✓ Reports and analytics dashboard — existing
- ✓ Dark/light theme toggle — existing
- ✓ WhatsApp bot simulator for testing — existing
- ✓ Features main tab with 5 sub-tabs (Broadcast, Re-Engage, AI Publisher, Simulator, Verification) — Phase 1

### Active

- [ ] **UI-01 to UI-07**: Features tab sidebar reorganization (Phase 1)
- [ ] **MEM-01 to MEM-04**: Long-term memory & context with RAG (Phase 2)
- [ ] **PRO-01 to PRO-07**: Proactive agent engine (Phase 3)
- [ ] **REC-01 to REC-04**: Smart product recommendations (Phase 4)
- [ ] **HND-01 to HND-05**: Human handoff & supervisor mode (Phase 5)
- [ ] **ANL-01 to ANL-04**: Analytics & conversation learning (Phase 6)
- [ ] **TEC-01 to TEC-04**: Technical debt & quality (Phase 7)

### Out of Scope

- Mobile app — web-first, no mobile native apps planned
- Video generation — not yet available (API limitation noted in code)
- Real-time notifications beyond browser Notification API
- WhatsApp Business API migration — future concern
- Voice/video calls — whatsapp-web.js and Gemini do not support real-time audio

## Context

Existing codebase with full WhatsApp sales agent functionality already implemented. The app serves Pakistani e-commerce businesses with multi-language AI conversations (Urdu, English, Arabic, Hindi, Bengali). Built with React + Express + PostgreSQL (Supabase) + Gemini AI + whatsapp-web.js. The codebase has significant technical debt including no test coverage, secrets in settings.json, and a monolithic server.ts. The current AI agent is reactive — it only responds when customers message. The roadmap focuses on making it proactive (automated follow-ups, abandoned cart recovery, drip campaigns), giving it long-term memory (vector RAG), smart recommendations, human supervisor mode, analytics, and paying down technical debt.

## Constraints

- **Tech stack**: React 19 + Express + PostgreSQL (Supabase) + Gemini AI — no framework changes
- **Language**: TypeScript throughout (ESM modules)
- **Codebase**: Monolithic Express server with service-oriented backend
- **Authentication**: JWT-based, OTP email verification, bcrypt password hashing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Feature tabs as sub-tabs under Features main tab | Cleaner sidebar organization, groups related tools | — Pending |
| pgvector for RAG memory | Reuses existing PostgreSQL, no new infrastructure | — Pending |
| node-cron for proactive scheduler | In-process, no external dependency needed | — Pending |
| Polling-based supervisor dashboard | Works with existing Express infra, no WebSocket needed | — Pending |
| Vitest for testing | Matches existing ESM module setup | — Pending |

---

*Last updated: 2026-05-31 after AI agent improvement planning*
