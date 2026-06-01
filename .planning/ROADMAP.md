# Roadmap: SalesForce AI

**Phases:** 7 | **Requirements mapped:** 36 | All requirements covered ✓

---

### Phase 1: Features Tab — Sidebar Reorganization ✓ COMPLETE

**Goal:** Add a new "Features" main tab to the sidebar with Broadcast, Re-Engage, AI Publisher, Simulator, and Verification as sub-tabs; remove Broadcast from WhatsApp.
**Mode:** mvp
**Status:** Already implemented in codebase. Verified: TypeScript 0 errors, Vite build successful, all sub-tab components load correctly.

**Requirements:**
- ✅ UI-01 — Create "Features" main tab
- ✅ UI-02 — Add Broadcast sub-tab
- ✅ UI-03 — Add Re-Engage sub-tab
- ✅ UI-04 — Add AI Publisher sub-tab
- ✅ UI-05 — Add Simulator sub-tab
- ✅ UI-06 — Add Verification sub-tab
- ✅ UI-07 — Remove Broadcast from WhatsApp

**Success Criteria:**
1. ✅ "Features" main tab appears in sidebar with correct icon and label
2. ✅ Clicking Features expands to show all 5 sub-tabs (Broadcast, Re-Engage, AI Publisher, Simulator, Verification)
3. ✅ Each sub-tab loads the correct component when clicked
4. ✅ WhatsApp tab now shows only Connection and Live Chat sub-tabs (Broadcast removed)
5. ✅ Active sub-tab highlighting and animations match existing pattern (like WhatsApp/Products sub-tabs)
6. ✅ All sub-tab routing works correctly (back/forward navigation, page refresh, localStorage persistence)
7. ✅ No broken functionality in existing tabs

---

### Phase 2: Long-Term Memory & Context (RAG)

**Goal:** Give the AI agent persistent memory across sessions using vector storage so it remembers customer preferences, past conversations, and buying history.
**Mode:** mvp

**Requirements:**
- MEM-01 — Vector memory (RAG) for full conversation context
- MEM-02 — Auto-summarization for long threads (>20 messages)
- MEM-03 — Customer preference learning from conversation history
- MEM-04 — Cross-session memory (customer returns after weeks, agent remembers)

**Key Decisions:**
- Use pgvector on existing PostgreSQL (no new infra)
- Gemini embeddings for vector generation
- Summarization triggered at configurable message count threshold

**Success Criteria:**
1. Agent references past conversations accurately (e.g., "Last time you were interested in X")
2. Auto-summary generated and stored after every 20 messages
3. Customer preferences (budget, category, brand) extracted and persist across sessions
4. Cold start: new customers get default behavior until 3+ conversations

---

### Phase 3: Proactive Agent Engine

**Goal:** Transform agent from reactive (reply-only) to proactive — automated follow-ups, abandoned cart recovery, drip campaigns, and smart prioritization.
**Mode:** mvp

**Requirements:**
- PRO-01 — Cron-based scheduler for automated messages
- PRO-02 — Abandoned cart detection + follow-up
- PRO-03 — Inactive customer re-engagement with AI-personalized messages
- PRO-04 — Birthday/special occasion auto-greetings with offers
- PRO-05 — Price drop alerts for interested customers
- PRO-06 — Priority queue (HOT leads get faster follow-ups)
- PRO-07 — Multi-step drip campaigns (Day 1/3/7 sequences)

**Key Decisions:**
- In-process cron using node-cron (no external scheduler needed)
- Configurable per-admin: intervals, message templates, enable/disable per trigger type
- Rate limits: max N proactive messages per customer per day

**Success Criteria:**
1. Abandoned cart follow-up sent within 24hr of inactivity at PRODUCT_SELECTED/NEGOTIATING state
2. Inactive >7 days customers receive AI-personalized re-engagement message
3. HOT leads receive follow-up before COLD leads
4. Drip campaign sends Day 1/3/7 messages on schedule
5. All proactive messages respect opt-out and daily limits
6. Admin can enable/disable each trigger type from settings

---

### Phase 4: Smart Product Recommendations

**Goal:** Replace top-10 product slice with semantic vector search and preference-based recommendations — relevant products, cross-sells, and inventory-aware suggestions.
**Mode:** mvp

**Requirements:**
- REC-01 — Vector-based semantic product search
- REC-02 — Preference-based recommendations from customer history
- REC-03 — "Customers also bought" cross-sell
- REC-04 — Real-time inventory-aware suggestions

**Key Decisions:**
- Product descriptions + features embedded into pgvector at product create/update
- Cross-sell derived from order history patterns
- Out-of-stock products auto-excluded from recommendations

**Success Criteria:**
1. Agent recommends products semantically related to customer query (not just top 10)
2. Returning customer gets recommendations aligned with past purchases
3. Cross-sell suggestions shown when customer adds item to cart
4. Out-of-stock products never recommended
5. Recommendation relevance rated positively in >70% of conversations

---

### Phase 5: Human Handoff & Supervisor Mode

**Goal:** Allow store owners to monitor AI-customer conversations in real-time, intervene when needed, and receive smart handoff summaries.
**Mode:** mvp

**Requirements:**
- HND-01 — Real-time supervisor dashboard with live AI-customer chats
- HND-02 — Human can send messages mid-conversation (supervised mode)
- HND-03 — Auto-generated handoff summary for human agent
- HND-04 — Smart escalation (frustration, complex queries, enterprise leads)
- HND-05 — Human can reassign conversation back to AI

**Key Decisions:**
- Polling-based live updates (WebSocket would be ideal but polling works with existing infra)
- Handoff summary includes: customer profile, conversation history, state, why escalated
- Escalation triggers: 3+ negative signals, explicit "speak to human", high-value lead detection

**Success Criteria:**
1. Admin sees all active AI-customer conversations with live message streaming
2. Admin can click into any conversation and send manual reply
3. After sending manual reply, AI pauses; admin can click "Resume AI" to return control
4. Escalation triggers fire correctly for frustration/keyword/high-value detection
5. Handoff summary contains enough context for human to continue without reading full history

---

### Phase 6: Analytics & Conversation Learning

**Goal:** Give store owners actionable funnel analytics and auto-improve the agent through A/B testing and weak-spot detection.
**Mode:** mvp

**Requirements:**
- ANL-01 — Conversion funnel analytics (drop-off at each state transition)
- ANL-02 — A/B testing framework for conversation patterns
- ANL-03 — Weak spot detection (which stage loses most customers)
- ANL-04 — Agent response effectiveness scoring

**Key Decisions:**
- Funnel built from existing session state transitions in DB
- A/B tests run on message templates (greeting, negotiation, closing)
- Effectiveness scored by conversion rate per pattern variant

**Success Criteria:**
1. Funnel visualization shows customer count at each state and drop-off rate between states
2. Admin can create A/B test with two message variants and see winner after N conversations
3. System auto-identifies the state with highest drop-off and flags it
4. Response effectiveness score shown per pattern type

---

### Phase 7: Technical Debt & Quality

**Goal:** Make the codebase maintainable, testable, and secure — test coverage, modular architecture, secrets management.
**Mode:** mvp

**Requirements:**
- TEC-01 — Unit tests for state machine, negotiation, lead scoring, payment verification
- TEC-02 — Integration tests for end-to-end conversation flows
- TEC-03 — Move secrets from settings.json to environment variables
- TEC-04 — Modularize monolithic server.ts into controllers/services/routes

**Key Decisions:**
- Vitest for testing (matches existing ESM setup)
- Test DB: separate test database or in-memory SQLite
- Modularization follows existing service pattern (no DI framework)
- .env.example committed, actual .env in .gitignore

**Success Criteria:**
1. Core services have >80% line coverage
2. 5+ integration tests covering full sale flow (NEW → ORDER_CONFIRMED)
3. Zero secrets in codebase (all in environment variables)
4. server.ts split into separate route/controller/service files
5. All existing functionality works after refactor

---

### Phase Details

**Phase 1: Features Tab — Sidebar Reorganization**
Goal: Add a new "Features" main tab with 5 sub-tabs; reorganize sidebar
Requirements: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07
Success criteria:
1. Features tab appears with correct icon
2. 5 sub-tabs render under Features
3. Each sub-tab loads correct component
4. WhatsApp has only Connection + Live Chat
5. Sub-tab animations match existing patterns
6. Routing works correctly with persistence
7. Existing tabs unaffected

**Phase 2: Long-Term Memory & Context (RAG)**
Goal: Persistent memory with vector storage — agent remembers customer across sessions
Requirements: MEM-01, MEM-02, MEM-03, MEM-04
Success criteria:
1. Agent references past conversations accurately
2. Auto-summarization after 20 messages
3. Preferences persist across sessions
4. New customers get default behavior

**Phase 3: Proactive Agent Engine**
Goal: Automated follow-ups, abandoned cart recovery, drip campaigns, priority queuing
Requirements: PRO-01, PRO-02, PRO-03, PRO-04, PRO-05, PRO-06, PRO-07
Success criteria:
1. Abandoned cart follow-up within 24hr
2. Inactive >7d re-engagement with AI message
3. HOT leads prioritized over COLD
4. Drip campaigns on schedule
5. Opt-out and rate limits respected
6. Admin-toggleable triggers

**Phase 4: Smart Product Recommendations**
Goal: Semantic vector search + preference-based cross-sells instead of top-10 slice
Requirements: REC-01, REC-02, REC-03, REC-04
Success criteria:
1. Semantic product matching (not just top 10)
2. History-aligned recommendations for returning customers
3. Cross-sell on cart add
4. Out-of-stock excluded
5. >70% relevance rating

**Phase 5: Human Handoff & Supervisor Mode**
Goal: Real-time monitoring, mid-conversation human intervention, smart escalation
Requirements: HND-01, HND-02, HND-03, HND-04, HND-05
Success criteria:
1. Live conversation list with streaming
2. Admin can send manual replies mid-conversation
3. AI pauses on human intervention, resumes on command
4. Escalation triggers fire correctly
5. Handoff summary sufficient for context handover

**Phase 6: Analytics & Conversation Learning**
Goal: Funnel analytics, A/B testing, weak-spot detection, response scoring
Requirements: ANL-01, ANL-02, ANL-03, ANL-04
Success criteria:
1. Funnel visualization with drop-off rates
2. A/B test creation with winner detection
3. Auto-flagged high-drop-off states
4. Response effectiveness scoring

**Phase 7: Technical Debt & Quality**
Goal: Tests, modular architecture, secrets management
Requirements: TEC-01, TEC-02, TEC-03, TEC-04
Success criteria:
1. >80% line coverage on core services
2. 5+ integration tests for full sale flow
3. Zero secrets in codebase
4. server.ts modularized
5. Existing functionality preserved
