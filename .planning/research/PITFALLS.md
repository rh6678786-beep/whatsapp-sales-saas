# Research: Pitfalls — WhatsApp AI Sales Agent

**Date:** 2026-05-30

## Common Pitfalls for WhatsApp AI Sales Projects

### 1. WhatsApp Web Protocol Reliability
**Warning signs:** Frequent disconnections, QR re-auth requests, message send failures
**Prevention:** Plan for eventual migration to WhatsApp Business API
**Phase:** Infrastructure

### 2. AI Hallucination in Sales Conversations
**Warning signs:** AI making up prices, promising unrealistic delivery times, giving wrong product info
**Prevention:** Strict system prompts, product catalog grounding, price validation in negotiation service
**Phase:** AI service

### 3. Multi-Tenant Data Isolation
**Warning signs:** One admin seeing another's data
**Prevention:** Always filter by adminId in every query — current implementation does this correctly
**Phase:** Architecture

### 4. Secrets in Code/Config
**Warning signs:** API keys, passwords, tokens in settings.json or committed files
**Prevention:** Add settings.json to .gitignore, use env vars exclusively
**Phase:** Security

### 5. Sidebar Navigation UX
**Warning signs:** Too many top-level tabs make the sidebar overwhelming
**Prevention:** Group related features under parent tabs (exactly what the user is doing with the Features tab)
**Phase:** UI
