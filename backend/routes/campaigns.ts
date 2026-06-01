import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { createCampaignSchema } from "../schemas/campaign.js";

const router = Router();

router.get("/campaigns", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const campaigns = await dbService.getCampaigns(adminId);
    res.json(campaigns);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/campaigns", validate(createCampaignSchema), async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { name, trigger, enabled, steps } = req.body;
    if (!name || !trigger || !steps) {
      return res.status(400).json({ error: "name, trigger, and steps are required" });
    }
    const campaign = await dbService.addCampaign(adminId, { name, trigger, enabled, steps });
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/campaigns/:id", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    await dbService.updateCampaign(adminId, req.params.id, req.body);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/campaigns/:id", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    await dbService.deleteCampaign(adminId, req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
