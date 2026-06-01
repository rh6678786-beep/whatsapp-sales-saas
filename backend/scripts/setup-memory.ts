import "dotenv/config";
import { pool } from "../services/dbService";

async function setupMemory() {
  console.log("[MEMORY-SETUP] Starting pgvector + memory table setup...");

  try {
    // 1. Enable pgvector extension
    console.log("[MEMORY-SETUP] Enabling pgvector extension...");
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    console.log("[MEMORY-SETUP] pgvector extension enabled ✓");

    // 2. Create message_embeddings table
    console.log("[MEMORY-SETUP] Creating message_embeddings table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS message_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        role TEXT NOT NULL,
        text TEXT NOT NULL,
        embedding vector(768),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_message_embeddings_admin 
      ON message_embeddings(admin_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_message_embeddings_session 
      ON message_embeddings(admin_id, session_id)
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_message_embeddings_hnsw 
      ON message_embeddings USING hnsw (embedding vector_cosine_ops)
    `);
    console.log("[MEMORY-SETUP] message_embeddings table created ✓");

    // 3. Create conversation_summaries table
    console.log("[MEMORY-SETUP] Creating conversation_summaries table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS conversation_summaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        message_count INT NOT NULL DEFAULT 0,
        customer_preferences JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_summaries_admin_session 
      ON conversation_summaries(admin_id, session_id)
    `);
    console.log("[MEMORY-SETUP] conversation_summaries table created ✓");

    console.log("[MEMORY-SETUP] Setup complete! All tables ready.");
  } catch (err: any) {
    console.error("[MEMORY-SETUP] Error during setup:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupMemory();
