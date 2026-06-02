import { Router } from "express";
import { requireAdmin, AuthenticatedRequest } from "../middleware/auth.js";
import { dbService } from "../services/dbService.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("route:seed");
const router = Router();

router.post("/seed", requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const adminId = req.adminId!;

    // Check if already seeded — prevent accidental overwrite
    const productCount = await dbService.getProductCount(adminId);
    if (productCount > 0) {
      return res.status(400).json({
        error: "Products already exist. Delete existing products first to re-seed.",
      });
    }

    const { seedDatabase } = await import("../lib/seed.js");
    await seedDatabase(adminId);

    const products = await dbService.getAllProducts(adminId);
    log.info({ adminId, productCount: products.length }, "Database seeded");

    res.json({ success: true, productCount: products.length, products });
  } catch (error: any) {
    log.error({ err: error, adminId: req.adminId }, "Seed failed");
    res.status(500).json({ error: "Failed to seed database" });
  }
});

export default router;
