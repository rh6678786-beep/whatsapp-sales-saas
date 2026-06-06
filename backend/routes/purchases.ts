import { Router } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { dbService } from "../services/dbService.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("route:purchases");
const router = Router();

// POST /api/purchases - Add a purchase record
router.post("/purchases", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const adminId = req.adminId!;
    const { productName, productId, quantity, pricePerUnit, supplier, note } = req.body;

    if (!productName || !quantity || !pricePerUnit) {
      return res.status(400).json({ error: "productName, quantity, and pricePerUnit are required" });
    }
    if (quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be greater than 0" });
    }
    if (pricePerUnit <= 0) {
      return res.status(400).json({ error: "Price per unit must be greater than 0" });
    }

    const purchase = await dbService.addPurchase(adminId, {
      productName,
      productId: productId || undefined,
      quantity,
      pricePerUnit,
      supplier,
      note,
    });

    log.info({ adminId, purchaseId: purchase.id, productName }, "Purchase recorded");
    res.json(purchase);
  } catch (error: any) {
    log.error({ err: error, adminId: req.adminId }, "Failed to record purchase");
    res.status(500).json({ error: error.message });
  }
});

// GET /api/purchases - Get purchases (with optional date filtering)
router.get("/purchases", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const adminId = req.adminId!;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;

    const purchases = await dbService.getPurchases(adminId, from, to);
    res.json(purchases);
  } catch (error: any) {
    log.error({ err: error, adminId: req.adminId }, "Failed to fetch purchases");
    res.status(500).json({ error: error.message });
  }
});

// GET /api/purchases/stats - Get purchase statistics
router.get("/purchases/stats", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const adminId = req.adminId!;
    const stats = await dbService.getPurchaseStats(adminId);
    res.json(stats);
  } catch (error: any) {
    log.error({ err: error, adminId: req.adminId }, "Failed to fetch purchase stats");
    res.status(500).json({ error: error.message });
  }
});

// GET /api/purchases/report - Purchase report by date range
router.get("/purchases/report", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const adminId = req.adminId!;
    const from = req.query.from as string;
    const to = req.query.to as string;

    if (!from || !to) {
      return res.status(400).json({ error: "from and to query parameters are required" });
    }
    const fromDate = new Date(from).getTime();
    const toDate = new Date(to).getTime();
    if (isNaN(fromDate) || isNaN(toDate)) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const purchases = await dbService.getPurchases(adminId, from, to);
    const totalCost = purchases.reduce((sum: number, p: any) => sum + p.totalCost, 0);
    const totalItems = purchases.reduce((sum: number, p: any) => sum + p.quantity, 0);

    res.json({
      purchases,
      totalCost,
      totalItems,
      count: purchases.length,
      from,
      to,
    });
  } catch (error: any) {
    log.error({ err: error, adminId: req.adminId }, "Failed to generate purchase report");
    res.status(500).json({ error: error.message });
  }
});

export default router;
