import { Router } from "express";
import { getAdminId, requireAuth } from "../middleware/auth.js";
import { getAuditLogs, getAuditLogsByEntity } from "../services/auditLogService.js";

const router = Router();

router.get("/audit", requireAuth, async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = Math.max(0, parseInt(req.query.offset as string) || 0);
    const result = await getAuditLogs(adminId, limit, offset);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/audit/:entity/:entityId", requireAuth, async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const logs = await getAuditLogsByEntity(adminId, req.params.entity, req.params.entityId);
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
