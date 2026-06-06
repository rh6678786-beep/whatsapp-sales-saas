import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import { sendWhatsAppMessage, isWhatsAppReady } from "../lib/whatsappClient.js";
import { Order } from "../../src/types.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("route:orderTracking");
const router = Router();

router.get("/orders", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const search = (req.query.search as string || "").trim().toLowerCase();
    const result = await dbService.getOrdersPaginated(adminId, page, pageSize);
    let orders = result.orders;
    if (search) {
      orders = orders.filter(o =>
        (o.userId && o.userId.toLowerCase().includes(search)) ||
        (o.customerName && o.customerName.toLowerCase().includes(search))
      );
    }
    res.json({
      data: orders,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize) || 1,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.post("/orders/:id/tracking", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { trackingId, courier, userId } = req.body;
    if (isWhatsAppReady(adminId) && userId) {
      const msg = `🚚 *Tracking Update*\n\nCourier: ${courier}\nTracking ID: ${trackingId}\n\nAapka order dispach ho gaya hai! Delivery 2-4 working days mein ho jaye gi.`;
      await sendWhatsAppMessage(adminId, userId, msg);
    }

    try {
      const session = await dbService.getSession(adminId, req.params.id);
      const products = await dbService.getAllProducts(adminId);
      const product = products.find(p => p.id === session?.selectedProductId);

      const existingOrder: Order = {
        id: req.params.id,
        userId: userId || session?.userId || req.params.id,
        productId: session?.selectedProductId || "",
        status: 'SHIPPED',
        paymentScreenshotUrl: session?.metadata?.paymentScreenshot || "",
        shippingAddress: session?.metadata?.negotiationState?.shippingAddress || "Not provided",
        customerName: session?.metadata?.customerName || "",
        customerPhone: "",
        amount: session?.metadata?.negotiationState?.currentOfferedPrice || product?.price || 0,
        costPrice: product?.costPrice || 0,
        createdAt: new Date().toISOString(),
        trackingId,
        courier
      };

      await dbService.createOrder(adminId, existingOrder);
      log.info({ adminId, orderId: req.params.id }, "Order tracking created/updated");
    } catch (orderErr: any) {
      log.warn({ err: orderErr, adminId, orderId: req.params.id }, "Could not sync order tracking");
    }

    res.json({ success: true });
  } catch (error: any) {
    const adminId = getAdminId(req);
    log.error({ err: error, adminId, orderId: req.params.id }, "Order tracking failed");
    res.status(500).json({ error: error.message });
  }
});

export default router;
