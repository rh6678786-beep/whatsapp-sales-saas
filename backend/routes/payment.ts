import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import { analyzePaymentScreenshot } from "../services/paymentService.js";

const router = Router();

router.get("/payment/config", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const settings = await dbService.getSettings(adminId);
    res.json(settings.paymentConfig || {
      jazzCash: { merchantId: '', merchantPassword: '', isActive: false },
      easyPaisa: { merchantId: '', merchantPassword: '', isActive: false },
      bankTransfer: { accountTitle: '', accountNumber: '', bankName: '', branchCode: '', isActive: false }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/payment/config", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    await dbService.updateSettings(adminId, { paymentConfig: req.body });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/payment/analyze-screenshot", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { imageBase64 } = req.body;
    const result = await analyzePaymentScreenshot(imageBase64, undefined, adminId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
