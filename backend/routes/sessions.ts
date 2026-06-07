import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import { logAction } from "../services/auditLogService.js";
import { createChildLogger } from "../lib/logger.js";
import { Order } from "../../src/types";

const log = createChildLogger("route:sessions");
const router = Router();

router.get("/sessions", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const state = req.query.state as string | undefined;
    const search = (req.query.search as string || "").trim().toLowerCase();
    const blockedOnly = req.query.blocked === "true";
    const result = await dbService.getSessionsPaginated(adminId, page, pageSize, state);
    let sessions = result.sessions;
    if (blockedOnly) {
      sessions = sessions.filter(s => s.isBlocked === true);
    }
    if (search) {
      sessions = sessions.filter(s => s.userId.toLowerCase().includes(search));
    }
    res.json({
      data: sessions,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize) || 1,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
});

router.get("/sessions/blocked", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const result = await dbService.getSessionsPaginated(adminId, 1, 200);
    const blocked = result.sessions.filter(s => s.isBlocked === true);
    res.json({
      data: blocked,
      total: blocked.length,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch blocked users" });
  }
});

router.patch("/sessions/:id/unblock", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const sessionId = req.params.id;
    await dbService.updateSession(adminId, sessionId, { isBlocked: false });
    logAction(adminId, "unblock", "session", sessionId, undefined, req.ip)
      .catch((auditErr) => log.warn({ err: auditErr, adminId }, "Audit log write failed"));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/sessions/:id/messages", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const messages = await dbService.getMessages(adminId, req.params.id);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/**
 * REVOKE SESSION — force-logout a specific user session.
 * Blocks the session and clears its auth state.
 */
router.post("/sessions/:id/revoke", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const sessionId = req.params.id;

    // Block the session to prevent further messages
    await dbService.updateSession(adminId, sessionId, {
      isBlocked: true,
      metadata: {
        revokedAt: new Date().toISOString(),
        revokedBy: adminId,
      },
    });

    logAction(adminId, "revoke_session", "session", sessionId, { reason: req.body?.reason || "Manual revocation" }, req.ip)
      .catch((auditErr) => log.warn({ err: auditErr, adminId }, "Audit log write failed"));

    log.info({ adminId, sessionId }, "Session revoked");
    res.json({ success: true, message: "Session revoked successfully" });
  } catch (error: any) {
    log.error({ err: error, adminId: getAdminId(req), sessionId: req.params.id }, "Session revocation failed");
    res.status(500).json({ error: error.message });
  }
});

/**
 * REVOKE ALL SESSIONS — force-logout all sessions for this admin.
 */
router.post("/sessions/revoke-all", async (req, res) => {
  try {
    const adminId = getAdminId(req);

    // Block all active sessions
    const sessions = await dbService.getRecentSessions(adminId, 1000);
    let revokedCount = 0;
    for (const session of sessions) {
      await dbService.updateSession(adminId, session.id, {
        isBlocked: true,
        metadata: {
          ...(session.metadata || {}),
          revokedAt: new Date().toISOString(),
          revokedBy: adminId,
        },
      });
      revokedCount++;
    }

    logAction(adminId, "revoke_all_sessions", "session", "all", { count: revokedCount }, req.ip)
      .catch((auditErr) => log.warn({ err: auditErr, adminId }, "Audit log write failed"));

    log.info({ adminId, revokedCount }, "All sessions revoked");
    res.json({ success: true, revokedCount });
  } catch (error: any) {
    log.error({ err: error, adminId: getAdminId(req) }, "Revoke all sessions failed");
    res.status(500).json({ error: error.message });
  }
});

router.patch("/sessions/:id", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const sessionId = req.params.id;
    await dbService.updateSession(adminId, sessionId, req.body);

    if (req.body.isBlocked !== undefined) {
      logAction(adminId, req.body.isBlocked ? "block" : "unblock", "session", sessionId, undefined, req.ip).catch((auditErr) => log.warn({ err: auditErr, adminId }, "Audit log write failed"));
    }

    if (req.body.state === "ORDER_CONFIRMED" || req.body.state === "DELIVERED") {
      const session = await dbService.getSession(adminId, sessionId);
      if (session) {
        const products = await dbService.getAllProducts(adminId);
        const product = products.find(p => p.id === session.selectedProductId);
        const price = session.metadata?.negotiationState?.currentOfferedPrice ?? product?.price ?? 0;
        const cost = product?.costPrice ?? 0;

        let customerPhone = "";
        const rawUserId = session.userId || "";
        if (rawUserId.includes(":")) {
          customerPhone = rawUserId.split(":").slice(1).join(":");
        } else {
          customerPhone = rawUserId;
        }
        if (/^92\d{9,10}$/.test(customerPhone) && !customerPhone.startsWith("+")) {
          customerPhone = "+" + customerPhone;
        }

        const newOrder: Order = {
          id: sessionId,
          userId: session.userId,
          productId: session.selectedProductId || "",
          status: req.body.state === "DELIVERED" ? "DELIVERED" : "VERIFIED",
          paymentScreenshotUrl: session.metadata?.paymentScreenshot || "",
          shippingAddress: session.metadata?.negotiationState?.shippingAddress || "Not provided",
          customerName: session.metadata?.customerName || "",
          customerPhone: customerPhone,
          amount: price,
          costPrice: cost,
          createdAt: new Date().toISOString()
        };

        await dbService.createOrder(adminId, newOrder);
        log.info({ adminId, sessionId }, "Successfully synchronized and created order");
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    const safeId = req.headers["x-admin-id"] as string || "unknown";
    log.error({ adminId: safeId, err: error }, "Session patch error");
    res.status(500).json({ error: error.message });
  }
});

export default router;
