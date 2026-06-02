import { Router } from "express";
import { dbService, pool } from "../services/dbService.js";
import { getAdminId, requireAuth } from "../middleware/auth.js";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { checkLimit } from "../services/stripeService.js";
import { logAction } from "../services/auditLogService.js";
import { validate } from "../middleware/validate.js";
import { createProductSchema, updateProductSchema } from "../schemas/product.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("route:products");
const router = Router();

router.get("/products", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const search = (req.query.search as string || "").trim().toLowerCase();
    const result = await dbService.getProductsPaginated(adminId, page, pageSize);
    let products = result.products;
    if (search) {
      products = products.filter(p => p.name.toLowerCase().includes(search));
    }
    res.json({
      data: products,
      pagination: {
        page: result.page,
        pageSize: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  } catch (error: any) {
    console.error(`[PRODUCTS_GET_ERROR]`, error?.message || error);
    res.status(500).json({ error: error?.message || "Failed to fetch products" });
  }
});

router.get("/products/search", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const query = (req.query.q as string) || "";
    if (!query) {
      const products = await dbService.getAllProducts(adminId);
      return res.json(products.filter(p => p.stock === undefined || p.stock > 0).slice(0, 20));
    }
    const { searchSimilarProducts } = await import("../services/recommendationService.js");
    const results = await searchSimilarProducts(adminId, query, 20);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/products", validate(createProductSchema), async (req, res) => {
  try {
    console.log(`[PRODUCTS_POST] Request received:`, JSON.stringify(req.body).slice(0, 200));
    const adminId = getAdminId(req);
    console.log(`[PRODUCTS_POST] adminId: ${adminId}`);
    const existingSub = await dbService.getSubscription(adminId);
    console.log(`[PRODUCTS_POST] subscription:`, existingSub);
    const count = await dbService.getProductCount(adminId);
    console.log(`[PRODUCTS_POST] product count: ${count}`);
    const limitCheck = await checkLimit(adminId, "maxProducts", count, existingSub);
    console.log(`[PRODUCTS_POST] limitCheck:`, limitCheck);
    if (!limitCheck.allowed) {
      console.log(`[PRODUCTS_POST] BLOCKED by limit: ${limitCheck.reason}`);
      return res.status(403).json({ error: limitCheck.reason });
    }
    console.log(`[PRODUCTS_POST] Adding product...`);
    const product = await dbService.addProduct(adminId, req.body);
    console.log(`[PRODUCTS_POST] Product added:`, product.id);
    logAction(adminId, "create", "product", product.id, { name: req.body.name, price: req.body.price }, req.ip).catch((auditErr) => log.warn({ err: auditErr, adminId }, "Audit log write failed"));
    import("../services/recommendationService.js").then(async ({ getProductEmbeddingText }) => {
      const { generateEmbedding } = await import("../services/embeddingService.js");
      const { pool } = await import("../services/dbService.js");
      const text = getProductEmbeddingText(product as any);
      const embedding = await generateEmbedding(text, adminId);
      if (embedding) {
        await pool.query(
          `INSERT INTO product_embeddings (admin_id, product_id, text, embedding, updated_at)
           VALUES ($1, $2, $3, $4::vector, NOW())
           ON CONFLICT (admin_id, product_id)
           DO UPDATE SET text = $3, embedding = $4::vector, updated_at = NOW()`,
          [adminId, product.id, text, `[${embedding.join(",")}]`]
        );
      }
    }).catch(e => console.error("[PRODUCT_EMBEDDING] Failed:", e.message));
    res.json(product);
  } catch (error: any) {
    console.error(`[PRODUCTS_POST_ERROR]`, error?.stack || error?.message || error);
    res.status(500).json({ error: error?.message || "Failed to add product" });
  }
});

router.patch("/products/:id", validate(updateProductSchema), async (req, res) => {
  try {
    const adminId = getAdminId(req);
    await dbService.updateProduct(adminId, req.params.id, req.body);
    logAction(adminId, "update", "product", req.params.id, { updates: Object.keys(req.body) }, req.ip).catch((auditErr) => log.warn({ err: auditErr, adminId }, "Audit log write failed"));
    import("../services/recommendationService.js").then(async ({ getProductEmbeddingText }) => {
      const { generateEmbedding } = await import("../services/embeddingService.js");
      const { pool } = await import("../services/dbService.js");
      const products = await dbService.getAllProducts(adminId);
      const product = products.find(p => p.id === req.params.id);
      if (product) {
        const text = getProductEmbeddingText(product as any);
        const embedding = await generateEmbedding(text, adminId);
        if (embedding) {
          await pool.query(
            `INSERT INTO product_embeddings (admin_id, product_id, text, embedding, updated_at)
             VALUES ($1, $2, $3, $4::vector, NOW())
             ON CONFLICT (admin_id, product_id)
             DO UPDATE SET text = $3, embedding = $4::vector, updated_at = NOW()`,
            [adminId, product.id, text, `[${embedding.join(",")}]`]
          );
        }
      }
    }).catch(e => console.error("[PRODUCT_EMBEDDING_UPDATE] Failed:", e.message));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/products/batch", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const adminId = req.adminId!;
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array is required" });
    }
    for (const id of ids) {
      await dbService.permanentDeleteProduct(adminId, id);
      logAction(adminId, "delete", "product", id, undefined, req.ip).catch((auditErr) => log.warn({ err: auditErr, adminId }, "Audit log write failed"));
      pool.query(`DELETE FROM product_embeddings WHERE admin_id = $1 AND product_id = $2`, [adminId, id])
        .catch(e => console.error("[PRODUCT_EMBEDDING_DELETE] Failed:", e.message));
    }
    res.json({ success: true, deleted: ids.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    await dbService.softDeleteProduct(adminId, req.params.id);
    logAction(adminId, "soft-delete", "product", req.params.id, undefined, req.ip).catch((auditErr) => log.warn({ err: auditErr, adminId }, "Audit log write failed"));
    res.json({ success: true, deletedAt: Date.now() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/products/:id/restore", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    await dbService.restoreProduct(adminId, req.params.id);
    logAction(adminId, "restore", "product", req.params.id, undefined, req.ip).catch((auditErr) => log.warn({ err: auditErr, adminId }, "Audit log write failed"));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/products/:id/permanent-delete", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    await dbService.permanentDeleteProduct(adminId, req.params.id);
    import("../services/dbService.js").then(async ({ pool }) => {
      await pool.query(
        `DELETE FROM product_embeddings WHERE admin_id = $1 AND product_id = $2`,
        [adminId, req.params.id]
      );
    }).catch(e => console.error("[PRODUCT_EMBEDDING_DELETE] Failed:", e.message));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
