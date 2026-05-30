# Roadmap: SalesForce AI

**Phases:** 1 | **Requirements mapped:** 7 | All v1 requirements covered ✓

---

### Phase 1: Features Tab — Sidebar Reorganization

**Goal:** Add a new "Features" main tab to the sidebar with Broadcast, Re-Engage, AI Publisher, Simulator, and Verification as sub-tabs; remove Broadcast from WhatsApp.
**Mode:** mvp

**Requirements:**
- UI-01 — Create "Features" main tab
- UI-02 — Add Broadcast sub-tab
- UI-03 — Add Re-Engage sub-tab
- UI-04 — Add AI Publisher sub-tab
- UI-05 — Add Simulator sub-tab
- UI-06 — Add Verification sub-tab
- UI-07 — Remove Broadcast from WhatsApp

**Success Criteria:**
1. "Features" main tab appears in sidebar with correct icon and label
2. Clicking Features expands to show all 5 sub-tabs (Broadcast, Re-Engage, AI Publisher, Simulator, Verification)
3. Each sub-tab loads the correct component when clicked
4. WhatsApp tab now shows only Connection and Live Chat sub-tabs (Broadcast removed)
5. Active sub-tab highlighting and animations match existing pattern (like WhatsApp/Products sub-tabs)
6. All sub-tab routing works correctly (back/forward navigation, page refresh, localStorage persistence)
7. No broken functionality in existing tabs

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
