# Project Analysis – WhatsApp AI Sales SaaS

## Overview
The **WhatsApp AI Sales SaaS** is a multi‑tenant platform that enables businesses to automate sales conversations on WhatsApp using a custom AI "sales‑closer" persona.  It bundles:
- a **frontend** built with Vite/React (TypeScript/TSX) for admin dashboards, product management, live chat monitoring, and order verification;
- a **backend** (Node/TypeScript) exposing REST‑style services for Stripe billing, message handling, and integration with third‑party APIs (Postex, WhatsApp Business API);
- **AI pipelines** powered by Gemini/ChatGPT that generate product‑specific responses, handle objection handling, and close deals.
- **Multi‑tenant architecture** that isolates each client’s data using an `adminId`/tenant identifier.

The system is designed to be deployed on a cloud VM or containerized environment and to scale horizontally as the number of tenants grows.

---

## Core Features (High‑Level)
| Category | Feature | Description |
|---|---|---|
| **User Management** | Multi‑tenant onboarding | Admins sign‑up, receive a unique `adminId`, and can invite team members. |
| | Role‑based access | Owner, Manager, Support roles with scoped permissions. |
| **Product Catalog** | ProductManager component | CRUD UI for products (title, description, price, images, AI prompts). |
| | Dynamic pricing | Integration with Stripe for subscription plans per tenant. |
| **Chat Interface** | LiveChat component | Real‑time WhatsApp chat view, admin can send manual messages, flag abusive users. |
| | AI‑driven responses | Gemini‑based bot that reads product data, generates persuasive replies, handles objections. |
| | Mirror behaviour | Bot mirrors the style of the selected persona (e.g., Friendly, Direct). |
| **Order Flow** | OrderVerifier component | Validates incoming orders, cross‑checks with Stripe payment status, sends confirmations. |
| **Billing & Payments** | StripeService | Handles subscription creation, plan upgrades/downgrades, webhook verification. |
| **Analytics Dashboard** | Admin dashboard (future) | Displays sales funnel, conversion rates, revenue per tenant, message volume. |
| **Integrations** | Postex API | Automatic order tracking and shipment status updates. |
| | WhatsApp Business API | Sends/receives messages, supports media (images, PDFs). |
| **Security & Compliance** | Tenant data isolation | All DB queries scoped by `adminId`. |
| | Rate limiting & abuse detection | Detects spammy patterns, auto‑blocks abusive numbers. |
| | GDPR / data export | Export conversation logs per tenant. |
| **Optional Add‑ons** | Bulk broadcast | Scheduler to send marketing broadcasts to segmented contacts. |
| | Sentiment analysis | Tag messages as positive/negative for reporting. |

---

## Working Flow (Sequence)
1. **Tenant onboarding** – Admin creates account → receives `adminId`.
2. **Product setup** – Uses `ProductManager` UI to define catalog; each product stores an AI prompt template.
3. **Customer initiates WhatsApp chat** – Message arrives via WhatsApp Business API → `messageHandler` service.
4. **Message routing** – Service looks up tenant by phone number → loads product context → invokes Gemini model.
5. **AI response** – Generates reply, optionally enriched with product images/links, and sends back via WhatsApp API.
6. **Order intent** – Bot detects purchase intent → creates a Stripe Checkout Session via `stripeService`.  Customer pays → webhook confirms payment.
7. **Order verification** – `OrderVerifier` validates payment, updates DB, sends confirmation message.
8. **Analytics** – All interactions logged; admin dashboard visualises conversion funnel.

---

## Technical Requirements
### Runtime & Environment
- **Node.js** >= 18 (LTS) – backend services.
- **npm** or **yarn** – package management.
- **Vite** – dev server for React frontend.
- **TypeScript** – strict typing (`tsconfig.json` set to `strict:true`).
- **Docker** (recommended) – containerise backend & frontend for easier scaling.
- **Database** – PostgreSQL (or MySQL) with schemas:
  - `tenants` (adminId, name, StripeCustomerId, ...)
  - `products` (tenantId, details, aiPrompt)
  - `conversations` (tenantId, phone, messages, timestamps)
  - `orders` (tenantId, productId, stripeSessionId, status)
- **Environment variables** (via `.env`):
  - `STRIPE_SECRET_KEY`
  - `WHATSAPP_API_TOKEN`
  - `POSTEX_API_KEY`
  - `GEMINI_API_KEY`
  - `DATABASE_URL`
  - `PORT` (default 3000)

### Build & Deploy
1. `npm install` – install dependencies.
2. `npm run build` – creates production bundles (frontend in `dist/`).
3. `npm start` – runs backend (`node dist/server.js`).
4. Dockerfile provided – `docker build -t whatsapp-ai-saas .` and `docker run -p 80:80 ...`.

### Security
- All external API keys accessed only server‑side.
- HTTPS enforced (TLS termination at reverse proxy like Nginx).
- Input validation on incoming WhatsApp payloads.
- Rate‑limit per phone number (5 msgs/minute default).

---

## Specification Document (For Client Delivery)
### 1. Project Scope
- Multi‑tenant SaaS platform for WhatsApp sales automation.
- Includes UI components, backend services, AI integration, billing, and analytics.
- Deployable on any cloud provider (AWS, Azure, GCP) or on‑premise.

### 2. Deliverables
| Item | Description | Format |
|---|---|---|
| Source Code | Full repo with frontend, backend, Dockerfile, CI scripts. | Git repository (ZIP or remote link). |
| Documentation | README, installation guide, API spec (OpenAPI), UI component docs. | Markdown files in `docs/`. |
| Architecture Diagrams | High‑level component diagram, data flow diagram, tenant isolation diagram. | PDF/PNG (generated via Mermaid). |
| Test Suite | Unit tests (Jest), integration tests (Supertest), end‑to‑end tests (Cypress). | Scripts in `tests/`. |
| Deployment Scripts | Docker Compose, Helm chart (optional). | YAML files. |
| License | MIT License (or custom). | `LICENSE` file. |
| Post‑Delivery Support | 2‑week bug‑fix window, optional SLA. | Text agreement. |

### 3. Functional Specification (selected excerpts)
- **Tenant Registration API** – `POST /api/tenants` creates a new tenant, returns `adminId` and Stripe customer ID.
- **Product CRUD API** – `GET/POST/PUT/DELETE /api/tenants/:adminId/products` scoped by tenant.
- **Message Inbound Endpoint** – `POST /webhooks/whatsapp` validates signature, stores inbound message, triggers AI response.
- **Stripe Webhook** – `POST /webhooks/stripe` handles `checkout.session.completed` and updates order status.
- **Analytics Endpoint** – `GET /api/tenants/:adminId/analytics` returns conversion metrics.

### 4. Non‑Functional Requirements
- **Scalability** – Horizontal scaling via stateless backend; Redis cache optional for session data.
- **Performance** – AI response latency < 2 seconds (excluding external API waiting).
- **Reliability** – 99.9 % uptime SLA; automated retry for failed message sends.
- **Maintainability** – Clean architecture (services, repositories, controllers); extensive TypeScript typings.
- **Usability** – Responsive UI, dark mode, tooltip help texts.

---

## Small / Minor Features (Ideas & Quick Wins)
- **Theme toggle** – Light/Dark switch persisted in localStorage.
- **Copy‑to‑clipboard** button on generated AI replies.
- **Export conversation** – CSV/JSON download per tenant.
- **Custom branding** – Admin can upload logo & colour palette for their dashboard.
- **Notification bell** – Real‑time toast alerts for new inbound messages.
- **Keyboard shortcuts** – `Ctrl+Enter` to send a manual admin message.
- **Auto‑translation** – Detect language of incoming WhatsApp msg, translate to English for AI, reply in original language.
- **Message templates** – Pre‑defined quick‑reply snippets for FAQs.
- **Rate‑limit dashboard** – Visual monitor of messages per second per tenant.
- **Unit test scaffolding** – Auto‑generated Jest test skeleton for each new service.

---

## Client‑Facing Information Package
1. **Executive Summary** – One‑page business value proposition.
2. **Feature List** – Bullet list of all core and minor features.
3. **Technical Stack** – Table of languages, frameworks, databases, cloud services.
4. **System Architecture** – Mermaid diagrams (deployment, component, data‑flow).  *(Will be provided as PNGs in `docs/diagrams/`)*
5. **Roadmap** – Phase 1 (MVP), Phase 2 (Analytics & Bulk‑Broadcast), Phase 3 (AI model fine‑tuning). 
6. **Pricing Model** – Suggested SaaS subscription tiers (Starter, Professional, Enterprise) with pricing examples.
7. **Support & SLA** – 24 h response, bug‑fix window, optional premium support.
8. **Installation Guide** – Step‑by‑step local dev setup, Docker deployment, cloud CI/CD pipeline.

---

## Next Steps for the Project
- Finalise **tenant isolation** in all DB queries (audit existing services).
- Complete **AI prompt library** per product (store in DB, expose via admin UI).
- Implement **admin dashboard** for analytics (charts with Chart.js or Recharts).
- Write **unit & integration tests** covering Stripe webhook, message handler, and product CRUD.
- Produce **Mermaid diagrams** and embed in `docs/architecture.md`.
- Prepare **client deliverables** (PDF package, code archive) once MVP is stable.

---

*Prepared on 2026‑05‑21 by Antigravity – Comprehensive project analysis for WhatsApp AI Sales SaaS.*
