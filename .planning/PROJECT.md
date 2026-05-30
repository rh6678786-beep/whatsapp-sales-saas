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

### Active

- [ ] **FEAT-01**: Create new "Features" main tab in sidebar
- [ ] **FEAT-02**: Add Broadcast as sub-tab under Features (remove from WhatsApp)
- [ ] **FEAT-03**: Add Re-Engage as sub-tab under Features
- [ ] **FEAT-04**: Add AI Publisher as sub-tab under Features
- [ ] **FEAT-05**: Add Simulator as sub-tab under Features
- [ ] **FEAT-06**: Add Verification (Orders) as sub-tab under Features

### Out of Scope

- Mobile app — web-first, no mobile native apps planned
- Video generation — not yet available (API limitation noted in code)
- Real-time notifications beyond browser Notification API
- Full test suite — not in current scope

## Context

Existing codebase with full WhatsApp sales agent functionality already implemented. The app serves Pakistani e-commerce businesses with multi-language AI conversations (Urdu, English, Arabic, Hindi, Bengali). Built with React + Express + PostgreSQL + Gemini AI + whatsapp-web.js. The codebase has significant technical debt including no test coverage, secrets in settings.json, and a monolithic server.ts.

## Constraints

- **Tech stack**: React 19 + Express + PostgreSQL (Supabase) + Gemini AI — no framework changes
- **Language**: TypeScript throughout (ESM modules)
- **Codebase**: Monolithic Express server with service-oriented backend
- **Authentication**: JWT-based, OTP email verification, bcrypt password hashing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Feature tabs as sub-tabs under Features main tab | Cleaner sidebar organization, groups related tools | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-30 after initialization*
