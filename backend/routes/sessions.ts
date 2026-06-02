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
    const result = await dbService.getSessionsPaginated(adminId, page, pageSize, state);
    let sessions = result.sessions;
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

router.get("/sessions/:id/messages", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const messages = await dbService.getMessages(adminId, req.params.id);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch messages" });
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
