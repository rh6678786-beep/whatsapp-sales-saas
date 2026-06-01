import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";

const router = Router();

router.post("/seed", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { seedDatabase } = await import("../lib/seed.js");
    await seedDatabase(adminId);
    const products = await dbService.getAllProducts(adminId);
    res.json({ success: true, productCount: products.length, products });
  } catch (error: any) {
    console.error(`[SEED_ERROR]`, error?.message || error);
    res.status(500).json({ error: error?.message || "Failed to seed database" });
  }
});

export default router;
