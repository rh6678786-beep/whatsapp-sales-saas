# Research Summary: WhatsApp AI Sales Agent

**Date:** 2026-05-30

## Key Findings

- The current stack (React + Express + PostgreSQL + Gemini + whatsapp-web.js) is industry-standard for WhatsApp AI sales agents
- All table-stakes features and most differentiators are already implemented
- The UI reorganization (Features tab) is straightforward — follows existing sub-tab patterns already used by WhatsApp and Products tabs
- Major risk: whatsapp-web.js uses the unofficial web protocol which Meta can break; migration to Business API should be on the roadmap

## Files

- `.planning/research/STACK.md`
- `.planning/research/FEATURES.md`
- `.planning/research/ARCHITECTURE.md`
- `.planning/research/PITFALLS.md`
