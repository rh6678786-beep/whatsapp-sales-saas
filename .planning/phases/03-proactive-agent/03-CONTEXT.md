# Context — Phase 3: Proactive Agent Engine

## Current State

- `reEngagementService.ts` exists with full engine — but only manual trigger via API
- `node-cron` imported in `server.ts` but never used
- `sendWhatsAppMessage()` and broadcast flow exist
- Session states, lead scores, and customer metadata are available in DB

## What Exists vs What's Needed

| Feature | Status |
|---------|--------|
| AI message generation with context | ✅ Already done (reEngagementService) |
| Fallback message templates | ✅ Already done |
| Rate limiting | ✅ Already done (2s delay) |
| Session state filtering | ✅ Need to extend getInactiveSessions |
| Cron scheduler | ⬜ node-cron imported, never scheduled |
| Abandoned cart (PRODUCT_SELECTED > 24hr) | ⬜ Need new trigger |
| Price drop alerts | ⬜ Need new feature |
| Birthday greetings | ⬜ Need new feature |
| Priority queue (HOT first) | ⬜ Need sorting by leadScore |
| Drip campaigns (Day 1/3/7) | ⬜ Need new feature |

## Architecture

```
server.ts
  └─ cron.schedule("*/15 * * * *")     →  proactiveEngine.processAll()
       └─ for each admin:
            ├─ processAbandonedCarts()   →  PRODUCT_SELECTED > 24hr
            ├─ processReEngagement()     →  inactive > 7 days (uses existing service)
            ├─ processPriceDrops()       →  interested customers
            ├─ processBirthdays()        →  today = birthday
            └─ processDripCampaigns()    →  multi-step sequences
```
