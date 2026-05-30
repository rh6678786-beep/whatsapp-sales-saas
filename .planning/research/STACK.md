# Research: Stack — WhatsApp AI Sales Agent

**Date:** 2026-05-30

## Standard Stack for WhatsApp AI Sales Agents

The current stack (React 19 + Express + PostgreSQL + Gemini AI + whatsapp-web.js) is aligned with industry patterns for building WhatsApp AI sales agents.

### Key Observations

- **WhatsApp Integration**: Most production systems use WhatsApp Business API via BSPs (Twilio, 360dialog, MessageBird) rather than `whatsapp-web.js`. The current approach using the unofficial web protocol is common for prototyping but has stability risks — Meta can break the web protocol without notice. For production, migrating to the official Business API is recommended.
- **AI Layer**: Gemini is a solid choice for the Pakistani market given its multilingual capabilities (Urdu, English, Arabic, Hindi, Bengali). The current implementation's language-specific prompts are well-structured.
- **Database**: PostgreSQL via Supabase is appropriate for multi-tenant SaaS.
- **Architecture**: The monolithic approach is standard for early-stage products; the service-oriented internal structure makes future extraction to microservices feasible.

### Confidence

- **High**: Core stack choices (React, Express, PostgreSQL, Gemini) are appropriate for this use case
- **Medium**: whatsapp-web.js is acceptable for v1 but has production stability concerns
