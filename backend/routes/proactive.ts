import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import { processProactiveForAdmin } from "../services/proactiveEngine.js";

const router = Router();

router.get("/proactive/config", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const settings = await dbService.getSettings(adminId);
    res.json(settings.proactiveConfig || { enabled: false });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/proactive/config", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    await dbService.updateSettings(adminId, { proactiveConfig: req.body });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/proactive/run-now", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const result = await processProactiveForAdmin(adminId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
