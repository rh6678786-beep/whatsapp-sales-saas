# Context — Phase 2: Long-Term Memory & Context (RAG)

## Current State

Agent only sees last 5 messages from current session. No cross-session memory, no vector search, no summarization. When a customer returns after weeks, the agent treats them as a complete stranger.

## Key Decisions (from ROADMAP)

| Decision | Rationale |
|----------|-----------|
| pgvector on existing PostgreSQL | No new infra, Supabase already supports pgvector |
| Gemini embeddings (`text-embedding-004`) | Same provider, no new API key needed |
| Summarization at 20 message threshold | Balances context quality vs cost |
| Embeddings stored per-message for fine-grained search | Enables "find conversations where customer asked about X" |
| Conversation summaries stored in Session metadata | No new tables needed |

## Architecture

```
Message saved (dbService.addMessage)
  → if message count % 5 == 0: generate embedding via Gemini
  → if message count > 20: trigger summarization
  → store embedding + summary

New message received (messageHandler.ts)
  → query similar past conversations via pgvector
  → retrieve relevant context + preferences
  → inject into system prompt alongside last 5 messages
  → generate AI response
```

## Packages to Install

- No new packages needed for embeddings (use existing `@google/genai`)
- pgvector: enabled via SQL on Supabase (raw query via `pg.Pool`)
- Prisma does not natively support vector type — use raw SQL or `@prisma/pgvector` preview feature
