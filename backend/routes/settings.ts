import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import { hashPassword, comparePassword } from "../services/authService.js";
import { logAction } from "../services/auditLogService.js";
import { validate } from "../middleware/validate.js";
import { updateSettingsSchema } from "../schemas/settings.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("route:settings");
const router = Router();

router.get("/settings", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const settings = await dbService.getSettings(adminId);
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.post("/settings", validate(updateSettingsSchema), async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const body = { ...req.body };

    log.info({ adminId, keys: Object.keys(body) }, "Settings change requested");

    if (body.adminPassword) {
      log.info({ adminId }, "Password change requested — hashing");
      const hashed = await hashPassword(body.adminPassword);
      await dbService.registerAdmin(adminId, hashed);
      delete body.adminPassword;
    }

    const settings = await dbService.updateSettings(adminId, body);
    log.info({ adminId }, "Settings saved successfully");
    logAction(adminId, "update", "settings", undefined, { keys: Object.keys(body) }, req.ip).catch((auditErr) => log.warn({ err: auditErr, adminId }, "Audit log write failed"));
    res.json(settings);
  } catch (error: any) {
    const adminId = getAdminId(req);
    log.error({ err: error, adminId }, "Failed to update settings");
    res.status(500).json({ error: "Failed to update settings" });
  }
});

router.get("/settings/profile", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const settings = await dbService.getSettings(adminId);
    res.json({
      adminId,
      storeName: settings.storeName || '',
      businessLogo: settings.businessLogo || '',
      phone: settings.phone || '',
      address: settings.address || '',
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.put("/settings/profile", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const allowed = ['storeName', 'businessLogo', 'phone', 'address'];
    const updates: any = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    await dbService.updateSettings(adminId, updates);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile" });
  }
});

router.post("/settings/plan", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { plan } = req.body;
    if (!plan) return res.status(400).json({ error: "plan is required" });

    const existing = await dbService.getSubscription(adminId) || {};
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const updated = {
      ...existing,
      planId: plan,
      status: "active",
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: periodEnd.toISOString(),
    };
    await dbService.updateSubscription(adminId, updated);
    log.info({ adminId, plan }, "Plan updated");
    res.json({ success: true, plan });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/settings/verify-password", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { password } = req.body;
    const hash = await dbService.getAdminPasswordHash(adminId);
    if (!hash) {
      const envPassword = process.env.ADMIN_PASSWORD || '';
      if (!envPassword) return res.status(500).json({ error: "No admin configured. Set ADMIN_PASSWORD in .env" });
      return res.json({ success: password === envPassword });
    }
    const valid = await comparePassword(password, hash);
    res.json({ success: valid });
  } catch {
    res.json({ success: false });
  }
});

export default router;
