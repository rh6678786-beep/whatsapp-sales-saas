import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";

const router = Router();

router.get("/super/clients", async (req, res) => {
  try {
    const adminIds = await dbService.getAllAdminIds();
    const clients = await Promise.all(adminIds.map(async (id) => {
      const settings = await dbService.getSettings(id);
      const stats = await dbService.getStats(id);
      return {
        id,
        storeName: settings.storeName || 'Unnamed Store',
        verifiedEmail: settings.verifiedEmail || settings.email || '',
        phone: settings.phone || '',
        address: settings.address || '',
        language: settings.language || 'ur',
        businessLogo: settings.businessLogo || '',
        advanceAmount: settings.advanceAmount || 300,
        jazzCashNumber: settings.jazzCashNumber || '',
        onboardingComplete: settings.onboardingComplete ?? true,
        channels: {
          facebook: settings.facebook?.isActive || false,
          instagram: settings.instagram?.isActive || false,
          telegram: settings.telegram?.isActive || false,

        },
        subscription: settings.subscription || null,
        stats: {
          products: stats.productCount || 0,
          sessions: stats.activeUsers + (stats.totalOrders || 0) + (stats.pendingPayments || 0),
          orders: stats.totalOrders,
          totalSales: stats.totalSales,
          totalProfit: stats.totalProfit || 0,
          pendingPayments: stats.pendingPayments || 0,
        }
      };
    }));
    res.json(clients);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/super/migrate-phantom", async (req, res) => {
  try {
    const fixed = await dbService.fixPhantomAdmins();
    res.json({ success: true, fixed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
