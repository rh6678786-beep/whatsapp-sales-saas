# Requirements: SalesForce AI

**Defined:** 2026-05-30
**Core Value:** AI autonomously handles sales conversations on WhatsApp so store owners never miss a customer or a sale.

## v1 Requirements

### UI — Sidebar Reorganization ✓

- [x] **UI-01**: Create new "Features" main tab in sidebar navigation
- [x] **UI-02**: Add Broadcast as sub-tab under Features tab
- [x] **UI-03**: Add Re-Engage as sub-tab under Features tab
- [x] **UI-04**: Add AI Publisher as sub-tab under Features tab
- [x] **UI-05**: Add Simulator as sub-tab under Features tab
- [x] **UI-06**: Add Verification (Orders) as sub-tab under Features tab
- [x] **UI-07**: Remove Broadcast sub-tab from WhatsApp tab (keep only Connection and Live Chat)

## v2 Requirements

### Memory & Context

- **MEM-01**: Agent maintains full conversation context across sessions via vector memory (RAG)
- **MEM-02**: Conversation summarization for long threads (auto-summarize after N messages)
- **MEM-03**: Customer preference learning (preferred products, price range, communication style)
- **MEM-04**: Cross-session memory — agent remembers customer from previous conversations

### Proactive Agent

- **PRO-01**: Cron-based scheduler for automated follow-ups at configurable intervals
- **PRO-02**: Abandoned cart detection and auto follow-up (product selected but no payment)
- **PRO-03**: Inactive customer re-engagement with AI-personalized messages
- **PRO-04**: Birthday/special occasion automated greetings with offers
- **PRO-05**: Price drop alerts for customers who showed interest
- **PRO-06**: Priority queue — HOT leads get faster/more frequent follow-ups
- **PRO-07**: Multi-step drip campaigns (e.g., Day 1: reminder, Day 3: discount offer, Day 7: last chance)

### Smart Recommendations

- **REC-01**: Vector-based semantic product search (not just top 10 slice)
- **REC-02**: Customer preference learning — recommend based on past behavior
- **REC-03**: "Customers also bought" cross-sell suggestions
- **REC-04**: Real-time inventory-aware recommendations

### Human Handoff

- **HND-01**: Supervisor dashboard showing real-time AI-customer conversations
- **HND-02**: Human can intervene mid-conversation (supervised mode)
- **HND-03**: Handoff summary generated automatically for human agent
- **HND-04**: Smart escalation — detect frustration, complex queries, enterprise leads
- **HND-05**: Human can reassign conversation back to AI after intervention

### Analytics & Learning

- **ANL-01**: Conversion funnel analytics (NEW → ORDER_CONFIRMED drop-off at each stage)
- **ANL-02**: A/B testing framework for conversation patterns
- **ANL-03**: Weak spot detection — which stage loses most customers
- **ANL-04**: Agent response effectiveness scoring (which replies convert best)

### Technical Debt

- **TEC-01**: Unit test suite for core services (state machine, negotiation, lead scoring)
- **TEC-02**: Integration tests for end-to-end conversation flows
- **TEC-03**: Move secrets from settings.json to environment variables
- **TEC-04**: Modularize monolithic server.ts into controllers/services/routes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile native apps | Web-first |
| WhatsApp Business API migration | Future concern |
| Voice/video calls | whatsapp-web.js and Gemini do not support real-time audio |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| UI-01 | Phase 1 | Complete |
| UI-02 | Phase 1 | Complete |
| UI-03 | Phase 1 | Complete |
| UI-04 | Phase 1 | Complete |
| UI-05 | Phase 1 | Complete |
| UI-06 | Phase 1 | Complete |
| UI-07 | Phase 1 | Complete |
| MEM-01 | Phase 2 | Pending |
| MEM-02 | Phase 2 | Pending |
| MEM-03 | Phase 2 | Pending |
| MEM-04 | Phase 2 | Pending |
| PRO-01 | Phase 3 | Pending |
| PRO-02 | Phase 3 | Pending |
| PRO-03 | Phase 3 | Pending |
| PRO-04 | Phase 3 | Pending |
| PRO-05 | Phase 3 | Pending |
| PRO-06 | Phase 3 | Pending |
| PRO-07 | Phase 3 | Pending |
| REC-01 | Phase 4 | Pending |
| REC-02 | Phase 4 | Pending |
| REC-03 | Phase 4 | Pending |
| REC-04 | Phase 4 | Pending |
| HND-01 | Phase 5 | Pending |
| HND-02 | Phase 5 | Pending |
| HND-03 | Phase 5 | Pending |
| HND-04 | Phase 5 | Pending |
| HND-05 | Phase 5 | Pending |
| ANL-01 | Phase 6 | Pending |
| ANL-02 | Phase 6 | Pending |
| ANL-03 | Phase 6 | Pending |
| ANL-04 | Phase 6 | Pending |
| TEC-01 | Phase 7 | Pending |
| TEC-02 | Phase 7 | Pending |
| TEC-03 | Phase 7 | Pending |
| TEC-04 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 7 total (UI) — 7/7 Complete ✓
- v2 requirements: 29 total (MEM/PRO/REC/HND/ANL/TEC)
- Mapped to phases: 36
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-30*
*Last updated: 2026-05-31 after Phase 1 completion*
