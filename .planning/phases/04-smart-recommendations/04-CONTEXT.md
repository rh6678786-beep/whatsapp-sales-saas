# Context — Phase 4: Smart Product Recommendations

## Current Limitations
- `products.slice(0, 10)` — no relevance to customer query
- Only `name` + `price` in AI prompt — no features/descriptions
- No product embeddings or semantic search
- No cross-sell logic
- No inventory/stock awareness
- No preference-based personalization

## Infrastructure Reuse
- `embeddingService.ts` — `generateEmbedding()`, `searchSimilar()` patterns
- pgvector already enabled, HNSW index pattern known
- `Order` table has `userId` + `productId` for cross-sell
- `session.metadata` stores preferences (Phase 2 RAG)

## Architecture
```
messageHandler.ts
  └─ recommendationService.getRecommendations(adminId, customerQuery, session)
       ├─ searchSimilarProducts(query)       → semantic vector search on product_embeddings
       ├─ getCrossSell(productId)             → co-purchased from order history
       └─ getPersonalizedRecommendations(session) → from past orders + preferences

aiService.ts
  └─ replaces topProducts with relevantProducts (max 10, semantically matched)
       ├─ Includes features in product listing for richer context
       └─ Excludes out-of-stock (stock === 0)
```
