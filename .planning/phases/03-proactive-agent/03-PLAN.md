# Phase 3: Proactive Agent Engine

## Goal
Automate outbound messages via cron-triggered scheduler with 7 proactive triggers.

## Files to Create
| File | Purpose |
|------|---------|
| `backend/services/proactiveEngine.ts` | Central orchestrator — runs on cron, dispatches all trigger types |
| `backend/services/dripCampaignService.ts` | Multi-step drip campaigns (Day 1/3/7 sequences) |
| `backend/services/birthdayService.ts` | Birthday/occasion auto-greetings |
| `backend/services/priceDropService.ts` | Price drop alerts for interested customers |

## Files to Modify
| File | Changes |
|------|---------|
| `backend/services/reEngagementService.ts` | Add `processReEngagementCron()` that can be called from orchestrator |
| `backend/services/dbService.ts` | Add `proactiveConfig` to SETTINGS_JSON_FIELDS, add `getSessionsByState()`, add `getCustomersWithBirthdays()`, add DripCampaign CRUD |
| `prisma/schema.prisma` | Add DripCampaign model |
| `server.ts` | Register cron jobs, add proactive config API endpoints, add DripCampaign CRUD API |
| `backend/lib/whatsappClient.ts` | (no changes needed) |
| `src/components/Settings.tsx` | Add Proactive triggers UI |
| `src/types.ts` | Add DripCampaign type |

## Tasks

### Task 1: Database & Prisma
- Add `DripCampaign` model to `prisma/schema.prisma`
- Add `proactiveConfig` to `SETTINGS_JSON_FIELDS` in `dbService.ts`
- Add `getSessionsByState()` method
- Add `getCustomersWithBirthdays()` method
- Add DripCampaign CRUD methods to `dbService.ts`

### Task 2: proactiveEngine.ts
- Central orchestrator with `processAll(adminId)`
- Rate limiter: max N proactive messages per customer per day
- Priority queue: process HOT leads first
- Dispatches to:
  - `processAbandonedCarts()`
  - `processReEngagement()`
  - `processPriceDrops()`
  - `processBirthdays()`
  - `processDripCampaigns()`

### Task 3: reEngagementService.ts update
- Add `processReEngagementCron(adminId)` — same logic but callable from engine
- Ensure it respects `proactiveConfig.maxProactivePerDay`

### Task 4: birthdayService.ts
- Check customer metadata for `birthday` field
- Generate personalized greeting with optional offer
- Respect quiet hours (9 PM - 9 AM)

### Task 5: priceDropService.ts
- Track product price history
- Find customers who showed interest in a product
- Alert when price drops

### Task 6: dripCampaignService.ts
- Define campaigns with steps: `{ day: 1 | 3 | 7, message: string, aiGenerated?: boolean }`
- Track campaign progress per session
- Execute due steps on cron

### Task 7: Server & API
- Register cron jobs in `server.ts`
- API: `GET/POST /api/proactive/config`
- API: `GET/POST/PUT/DELETE /api/campaigns`
- API: `GET /api/campaigns/:id/progress`

### Task 8: Admin UI
- Proactive triggers section in Settings.tsx
- DripCampaign manager UI (basic: list + create + toggle)

## Cron Schedule
- Every 15 minutes: abandoned cart, re-engagement, drip campaigns
- Every hour: price drops, birthdays
- Configurable per admin

## Rate Limits
- Max 5 proactive messages per customer per day (configurable)
- 2-second gap between sends
- Quiet hours: 9 PM - 9 AM (no proactive messages)
- Max 50 messages per cron run per admin
