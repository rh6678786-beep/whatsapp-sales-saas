# Plan: Phase 1 — Features Tab (Verification)

**Phase:** 1
**Mode:** mvp
**Goal:** Verify Features tab sidebar reorganization is correctly implemented and working.

## Context

The Features tab and 5 sub-tabs were previously implemented in `src/App.tsx`. This phase verifies correctness, tests edge cases, and fixes any remaining issues.

## Tasks

### Task 1: Audit Existing Implementation

Read `src/App.tsx` and verify:
- [ ] Features main tab exists in tab array with `Zap` icon and `text-rose-500` color
- [ ] All 5 sub-tabs defined under featuresSubTabs
- [ ] `handleMainTabClick` handles Features tab correctly (activate/expand/toggle)
- [ ] `getActiveTab()` resolves Features sub-tabs correctly
- [ ] Content rendering maps each sub-tab to correct component
- [ ] WhatsApp tab shows only Connection + Live Chat (no Broadcast)
- [ ] localStorage persistence works for Features expand and sub-tab state

**Verification:** Manual test all tab interactions

### Task 2: Fix Edge Cases

- [ ] Verify no console errors when switching between all Features sub-tabs
- [ ] Verify browser back/forward doesn't break tab state
- [ ] Verify page refresh restores correct sub-tab
- [ ] Verify mobile responsive behavior (sidebar overlay)
- [ ] Verify keyboard navigation works

### Task 3: Component Verification

Verify each Features sub-tab component loads and works:
- [ ] `<BroadcastManager />` — loads without errors
- [ ] `<ReEngagement />` — loads without errors
- [ ] `<AutoPublisher />` — loads without errors
- [ ] `<BotTester />` — loads without errors
- [ ] `<OrderVerifier />` — loads without errors
- [ ] No duplicate functionality between WhatsApp and Features tabs

### Task 4: Finalize

- [ ] All tests pass
- [ ] No regressions in existing tabs
- [ ] Mark Phase 1 complete
- [ ] Proceed to Phase 2

## Rollback

If the audit reveals significant issues, restore `src/App.tsx` from git and document the gap.
