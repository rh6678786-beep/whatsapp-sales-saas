import { Router } from "express";
import { z } from "zod";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { processReEngagement, previewReEngagement, findInactiveCustomers } from "../services/reEngagementService.js";
import { sendWhatsAppMessage, isWhatsAppReady } from "../lib/whatsappClient.js";

const router = Router();

router.get("/re-engagement/customers", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const customers = await findInactiveCustomers(adminId);
    res.json({ customers, total: customers.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/re-engagement/send-all", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const result = await processReEngagement(adminId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/re-engagement/send-one", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { userId } = req.body;
    const { generateReEngagementMessage } = await import("../services/reEngagementService.js");
    const msg = await generateReEngagementMessage(adminId, userId);
    if (msg && isWhatsAppReady(adminId)) {
      await sendWhatsAppMessage(adminId, userId, msg);
    }
    res.json({ success: true, message: msg });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/re-engagement/preview", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { userId } = req.body;
    const result = await previewReEngagement(adminId, userId);
    res.json(result || { message: "No preview available" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/re-engagement/schedule", validate(z.object({
  enabled: z.boolean().optional(),
  message: z.string().max(1000).optional(),
  interval: z.number().int().min(1).max(90).optional(),
}).strict()), async (req, res) => {
  try {
    const adminId = getAdminId(req);
    await dbService.updateSettings(adminId, { reEngagement: req.body });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
