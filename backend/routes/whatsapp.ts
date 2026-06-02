import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId, requireAuth } from "../middleware/auth.js";
import { initializeWhatsAppClient, getWhatsAppStatus, logoutWhatsApp } from "../lib/whatsappClient.js";

const router = Router();

router.get("/whatsapp/status", requireAuth, (req, res) => {
  try {
    const adminId = getAdminId(req);
    res.json(getWhatsAppStatus(adminId));
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
});

router.post("/whatsapp/init", requireAuth, async (req, res) => {
  try {
    const adminId = getAdminId(req);
    await initializeWhatsAppClient(adminId);
    res.json({ success: true, message: "WhatsApp client initialization started. Check status for QR code or ready state." });
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
});

router.post("/whatsapp/logout", requireAuth, async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const result = await logoutWhatsApp(adminId);
    res.json(result);
  } catch (e: any) {
    res.status(401).json({ error: e.message });
  }
});

export default router;
