# Phase 6: Analytics & Conversation Learning

## Key Changes

### Backend
1. **GET /api/analytics/funnel** — state-by-state counts + drop-off rates
2. **GET /api/analytics/weak-spots** — highest drop-off state identification
3. **GET /api/analytics/patterns** — pattern effectiveness scoring (wraps aiLearningService)
4. **GET /api/analytics/ab-tests** — basic A/B test results
5. **Integrate aiLearningService into messageHandler** — analyzeChat + markSaleClosed
6. **Update Dashboard API** — funnel data alongside stats

### Frontend
7. **Update Dashboard.tsx** — replace synthetic chart with real funnel bar chart
8. **Update ReportManager.tsx** — add weak spots section
