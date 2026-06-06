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
    log.error({ err: error?.message || error }, "Failed to fetch products");
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
    const adminId = getAdminId(req);
    const existingSub = await dbService.getSubscription(adminId);
    const count = await dbService.getProductCount(adminId);
    const limitCheck = await checkLimit(adminId, "maxProducts", count, existingSub);
    if (!limitCheck.allowed) {
      log.warn({ adminId, reason: limitCheck.reason }, "Product creation blocked by limit");
      return res.status(403).json({ error: limitCheck.reason });
    }
    const product = await dbService.addProduct(adminId, req.body);
    log.info({ adminId, productId: product.id, name: req.body.name }, "Product created");
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
    }).catch(e => log.warn({ err: e.message }, "Product embedding generation failed (non-blocking)"));
    res.json(product);
  } catch (error: any) {
    log.error({ err: error, adminId: getAdminId(req) }, "Failed to create product");
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
    }).catch(e => log.warn({ err: e.message }, "Product embedding update failed (non-blocking)"));
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
        .catch(e => log.warn({ err: e.message, adminId }, "Product embedding delete failed (non-blocking)"));
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

// POST /api/products/bulk-save — Save multiple products at once (used by visual Bulk Import UI)
router.post("/products/bulk-save", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const adminId = req.adminId!;
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: "products array is required" });
    }

    if (products.length > 500) {
      return res.status(400).json({ error: "Maximum 500 products at a time" });
    }

    // Validate each product
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.name || typeof p.name !== "string" || !p.name.trim()) {
        return res.status(400).json({ error: `Product at index ${i} is missing a valid name` });
      }
      if (typeof p.price !== "number" || p.price <= 0) {
        return res.status(400).json({ error: `Product "${p.name}" has invalid price` });
      }
    }

    const result = await dbService.bulkSaveProducts(adminId, products);
    log.info({ adminId, created: result.created, errors: result.errors.length }, "Bulk save completed");
    res.json(result);
  } catch (error: any) {
    log.error({ err: error, adminId: req.adminId }, "Bulk save failed");
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
    }).catch(e => log.warn({ err: e.message, adminId }, "Product embedding delete failed (non-blocking)"));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
