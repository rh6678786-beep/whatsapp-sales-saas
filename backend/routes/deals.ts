import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createDealSchema } from "../schemas/deal.js";

const router = Router();

router.get("/deals", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const deals = await dbService.getAllDeals(adminId);
    res.json(deals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/deals", validate(createDealSchema), async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const deal = await dbService.addDeal(adminId, req.body);
    res.json(deal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/deals/:id", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    await dbService.updateDeal(adminId, req.params.id, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/deals/:id", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    await dbService.softDeleteDeal(adminId, req.params.id);
    res.json({ success: true, deletedAt: Date.now() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/deals/:id/restore", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    await dbService.restoreDeal(adminId, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/deals/:id/permanent-delete", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    await dbService.permanentDeleteDeal(adminId, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
