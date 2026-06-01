import "dotenv/config";
import { dbService, pool } from "../services/dbService";
import { generateEmbedding } from "../services/embeddingService";
import { getProductEmbeddingText } from "../services/recommendationService";
import { Product } from "../../src/types";

async function migrateProductEmbeddings() {
  console.log("[MIGRATE-PRODUCT-EMBEDDINGS] Starting backfill...");

  const adminIds = await dbService.getAllAdminIds();
  if (adminIds.length === 0) {
    console.log("[MIGRATE-PRODUCT-EMBEDDINGS] No admins found");
    return;
  }

  let total = 0;
  let embedded = 0;
  let failed = 0;

  for (const adminId of adminIds) {
    const products = await dbService.getAllProducts(adminId);
    total += products.length;

    for (const product of products) {
      try {
        const text = getProductEmbeddingText(product);
        const embedding = await generateEmbedding(text, adminId);
        if (!embedding) {
          failed++;
          continue;
        }

        const embeddingStr = `[${embedding.join(",")}]`;
        await pool.query(
          `INSERT INTO product_embeddings (admin_id, product_id, text, embedding, updated_at)
           VALUES ($1, $2, $3, $4::vector, NOW())
           ON CONFLICT (admin_id, product_id)
           DO UPDATE SET text = $3, embedding = $4::vector, updated_at = NOW()`,
          [adminId, product.id, text, embeddingStr]
        );
        embedded++;

        if (embedded % 5 === 0) {
          console.log(`[MIGRATE-PRODUCT-EMBEDDINGS] Progress: ${embedded}/${total} embedded`);
        }
      } catch (e: any) {
        console.error(`[MIGRATE-PRODUCT-EMBEDDINGS] Failed for ${product.id}:`, e.message);
        failed++;
      }
    }
  }

  console.log(`[MIGRATE-PRODUCT-EMBEDDINGS] Done. Total: ${total}, Embedded: ${embedded}, Failed: ${failed}`);
  await pool.end();
}

migrateProductEmbeddings();
