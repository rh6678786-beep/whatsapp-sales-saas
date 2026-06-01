import "dotenv/config";
import { pool } from "../services/dbService";

async function setupRecommendations() {
  console.log("[REC-SETUP] Starting product embeddings setup...");

  try {
    console.log("[REC-SETUP] Creating product_embeddings table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_embeddings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        admin_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        text TEXT NOT NULL,
        embedding vector(768),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_product_embeddings_admin
      ON product_embeddings(admin_id)
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_product_embeddings_product
      ON product_embeddings(admin_id, product_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_product_embeddings_hnsw
      ON product_embeddings USING hnsw (embedding vector_cosine_ops)
    `);

    console.log("[REC-SETUP] product_embeddings table created ✓");
    console.log("[REC-SETUP] Setup complete!");
  } catch (err: any) {
    console.error("[REC-SETUP] Error during setup:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupRecommendations();
