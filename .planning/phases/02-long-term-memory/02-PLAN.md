# Plan: Phase 2 — Long-Term Memory & Context (RAG)

**Phase:** 2
**Mode:** mvp
**Goal:** Give the AI agent persistent memory across sessions using pgvector + Gemini embeddings.

---

## Task 1: Enable pgvector & Add Schema

**Subtasks:**
- [ ] Run `CREATE EXTENSION IF NOT EXISTS vector` on Supabase via raw SQL
- [ ] Verify vector extension is active (`SELECT * FROM pg_extension WHERE extname = 'vector'`)
- [ ] Create `message_embeddings` table with raw SQL:
  ```sql
  CREATE TABLE IF NOT EXISTS message_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_message_embeddings_admin ON message_embeddings(admin_id);
  CREATE INDEX IF NOT EXISTS idx_message_embeddings_session ON message_embeddings(admin_id, session_id);
  ```
- [ ] Create `conversation_summaries` table:
  ```sql
  CREATE TABLE IF NOT EXISTS conversation_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    message_count INT NOT NULL,
    customer_preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_summaries_admin_session ON conversation_summaries(admin_id, session_id);
  ```
- [ ] Add `embedding` column to existing messages table via raw SQL (optional — or use separate table)
- [ ] Run `npx prisma generate` after schema changes

**Verification:** Raw SQL queries return correct results, Prisma still compiles

---

## Task 2: Create Embedding Service

**New file:** `backend/services/embeddingService.ts`

**Subtasks:**
- [ ] Create `generateEmbedding(text: string, adminId: string): Promise<number[]>` function
  - Uses `ai.models.embedContent()` from existing `@google/genai` client
  - Model: `text-embedding-004` (768 dimensions)
  - Rate-limited per admin (reuse existing queue pattern from aiService.ts)
  - Truncate text to 2048 tokens max (Gemini embedding limit)
  - Return float array or null on failure
- [ ] Create `storeEmbedding(adminId, sessionId, messageId, role, text, embedding): Promise<void>`
  - Raw SQL insert into `message_embeddings` table
  - Uses existing `pg.Pool` from dbService.ts
- [ ] Create `searchSimilar(adminId: string, queryEmbedding: number[], limit?: number): Promise<SimilarResult[]>`
  - Raw SQL: `SELECT text, role, session_id, 1 - (embedding <=> $1) AS similarity FROM message_embeddings WHERE admin_id = $2 ORDER BY embedding <=> $1 LIMIT $3`
  - Returns top 5 results by default
  - Filter: similarity > 0.7 (configurable threshold)
- [ ] Create `getSessionEmbeddings(adminId: string, sessionId: string): Promise<EmbeddingRecord[]>`
  - Retrieve all embeddings for a session (for summarization context)

**Verification:** Unit test with known text produces non-null embedding, search returns correct similar results

---

## Task 3: Create Summarization Service

**New file:** `backend/services/summarizationService.ts`

**Subtasks:**
- [ ] Create `generateConversationSummary(adminId: string, sessionId: string): Promise<string>`
  - Fetch ALL messages for session from dbService
  - If count < 20: skip summarization (too short)
  - If count >= 20: send messages to Gemini with summarization prompt
  - Prompt: "Summarize this sales conversation. Include: what customer wants, budget, objections, preferred products, decision stage. Keep under 200 words. Language: match customer's language."
  - Return summary text
- [ ] Create `extractCustomerPreferences(adminId: string, sessionId: string): Promise<object>`
  - Uses Gemini to extract structured preferences from conversation
  - Returns: `{ preferredCategories: string[], priceRange: {min, max}, budget: number|null, interests: string[], communicationStyle: string }`
- [ ] Create `storeSummary(adminId: string, sessionId: string, summary: string, preferences: object): Promise<void>`
  - Upsert into `conversation_summaries` table
- [ ] Create `getLatestSummary(adminId: string, sessionId: string): Promise<Summary | null>`
  - Retrieve latest summary for context injection
- [ ] Create summarization trigger logic: called from messageHandler.ts after each message save
  - Check if messageCount % 20 === 0 (every 20 messages)
  - If yes: fire-and-forget summarization (don't block message response)

**Verification:** Summary generated correctly for test conversations, preferences extracted match conversation content

---

## Task 4: Modify messageHandler.ts — Context Injection

**File:** `backend/services/messageHandler.ts`

**Subtasks:**
- [ ] Import embeddingService and summarizationService
- [ ] After saving user message and before AI response, add:
  ```typescript
  // 1. Check if this session has a summary
  const summary = await summarizationService.getLatestSummary(adminId, userId);
  
  // 2. Generate embedding for this message (fire-and-forget, don't block)
  generateEmbeddingForMessage(adminId, userId, savedMessage, text).catch(() => {});
  
  // 3. Search similar past conversations
  const similarContexts = embedding 
    ? await embeddingService.searchSimilar(adminId, embedding, 3)
    : [];
  
  // 4. Check for cross-session preferences
  const preferences = summary?.customer_preferences || {};
  ```
- [ ] Pass retrieved context to `generateSalesResponse()` — add new parameter for extra context
- [ ] Handle summarization trigger after message save (if messageCount % 20 === 0)

**Verification:** Context is retrieved and passed to AI response generation

---

## Task 5: Modify aiService.ts — Enhanced System Prompt

**File:** `backend/services/aiService.ts`

**Subtasks:**
- [ ] Add `retrievedContext` parameter to `generateSalesResponse()`
- [ ] Modify system prompt to include new sections:

  **Section: Long-Term Memory** (insert after Priority 7):
  ```text
  [LONG-TERM MEMORY — Previous conversations with this customer]
  {if summary}: Past conversation summary: {summary}
  {if preferences}: Known preferences: {preferences}
  {if similarContexts}: Related past interactions:
  {similarContexts.map(c => `- (${c.session_id}): ${c.text.substring(0, 200)}`)}
  ```
  
- [ ] Add instructions for memory usage:
  ```text
  Use long-term memory to:
  - Reference past purchases: "Last time you bought X, how is it?"
  - Show you remember: "You were interested in Y before"
  - Adapt to preferences: match their known communication style
  - Never mention you're using a memory system — just naturally incorporate context
  ```
- [ ] Keep existing `history.slice(-5)` for short-term context
- [ ] Ensure retrieved context doesn't exceed prompt token limits (truncate if needed)

**Verification:** AI response naturally references past conversations when context is available

---

## Task 6: Seed & Migration Script

**Subtasks:**
- [ ] Create `backend/scripts/migrate-memory.ts` — one-time script to:
  - Fetch all existing messages from DB
  - Generate embeddings for messages that don't have them
  - Generate summaries for sessions with >20 messages
  - Store in new tables
- [ ] Add npm script: `"migrate:memory": "tsx backend/scripts/migrate-memory.ts"`
- [ ] Run migration on production data

**Verification:** Existing conversations get embeddings and summaries

---

## Task 7: Edge Cases & Configurability

**Subtasks:**
- [ ] Add admin-configurable settings:
  - `memoryEnabled: boolean` (default: true) — toggle RAG on/off
  - `summarizationThreshold: number` (default: 20) — messages before summarization
  - `embeddingEnabled: boolean` (default: true) — toggle embeddings
- [ ] Handle missing embedding gracefully (fall back to last 5 messages only)
- [ ] Handle Gemini embedding API failure (non-blocking, log and continue)
- [ ] Rate limit embedding generation (don't hit Gemini rate limits)
- [ ] Token budget: ensure retrieved context + history doesn't overflow model context window
- [ ] Add cleanup for old embeddings (TTL or size-based)

**Verification:** Config toggles work, failures don't break message flow, rate limits respected

---

## Rollback

1. Disable memory in admin settings (`memoryEnabled: false`)
2. System falls back to existing `history.slice(-5)` behavior
3. No data loss — embeddings and summaries just stop being generated until re-enabled
