# Research: Architecture — WhatsApp AI Sales Agent

**Date:** 2026-05-30

## Typical Architecture Patterns

### Common Architecture for WhatsApp AI Sales Agents

```
WhatsApp ←→ Webhook Handler → Message Processor → AI Service → Response
                              ↓
                         Database (sessions, history)
```

### Multi-Tenant Considerations

- Each admin gets an isolated view of their data (filtered by adminId)
- WhatsApp instances are per-admin (separate QR auth per tenant)
- Subscription plans enforce per-tenant limits

### Current Architecture Assessment

The current monolithic Express server with service-oriented backend is appropriate for the current scale. The key architectural decisions are sound:

1. **Prisma ORM** with PostgreSQL — standard, well-supported
2. **Service layer separation** — clear boundaries between concerns
3. **Lazy-loaded React components** — good for initial load performance
4. **JWT auth** — standard for SPA authentication

### Build Order Recommendation

For the UI reorganization task, the dependency order is:
1. Define the new Features tab component structure
2. Create the Features main tab with expandable sub-tab navigation
3. Move Broadcast from WhatsApp sub-tabs to Features sub-tabs
4. Add other sub-tabs (Re-Engage, AI Publisher, Simulator, Verification)
5. Update routing logic to handle new tab structure
