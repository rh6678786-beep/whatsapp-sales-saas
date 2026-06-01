# Phase 5: Human Handoff & Supervisor Mode

## Architecture

```
whatsappClient.ts (message event)
  └─ processIncomingMessage()
       ├─ Check: is handoff active? → skip AI, save user msg, return null
       ├─ Lead qualification → check escalation triggers
       ├─ AI generates response → check for [HANDOFF_TO_HUMAN:reason]
       ├─ If handoff triggered: save handoff data, generate summary
       └─ Return response (or null if handoff paused)

Supervisor sends message:
  POST /api/supervisor/send → saves as role "human" → sends via WhatsApp
  POST /api/supervisor/resume-ai → clears handoff, resumes AI

Frontend LiveChat:
  - Polls sessions, shows "Handoff Needed" badge on handoff sessions
  - Selected session shows message input bar when handoff is active
```

## Files to Create
- `backend/services/escalationService.ts` — detect triggers, generate handoff summaries

## Files to Modify
- `src/types.ts` — add "human" to Message role
- `backend/services/messageHandler.ts` — handoff check + escalation trigger
- `backend/lib/whatsappClient.ts` — skip auto-response when handoff active
- `backend/services/aiService.ts` — add [HANDOFF_TO_HUMAN] trigger in system prompt
- `backend/services/dbService.ts` — no changes (role is String, already works)
- `server.ts` — add supervisor API endpoints
- `src/components/LiveChat.tsx` — add message input for supervisors
