import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { ForbiddenError } from "../lib/errors.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("route:superadmin");
const router = Router();

// Super admin IDs from environment (comma-separated list)
// e.g. SUPER_ADMIN_IDS=default-admin,admin2,super@example.com
const SUPER_ADMIN_IDS: string[] = (process.env.SUPER_ADMIN_IDS || "default-admin")
  .split(",")
  .map(id => id.trim())
  .filter(id => id.length > 0);

// Super admin check middleware
function requireSuperAdmin(req: AuthenticatedRequest, _res: any, next: any) {
  requireAuth(req, _res, () => {
    if (!SUPER_ADMIN_IDS.includes(req.adminId || "")) {
      next(new ForbiddenError("Platform admin access required"));
      return;
    }
    next();
  });
}

router.get("/super/clients", requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const adminIds = await dbService.getAllAdminIds();
    const clients = await Promise.all(
      adminIds.map(async (id) => {
        const settings = await dbService.getSettings(id);
        const stats = await dbService.getStats(id);
        return {
          id,
          storeName: settings.storeName || "Unnamed Store",
          verifiedEmail: settings.verifiedEmail || settings.email || "",
          phone: settings.phone || "",
          language: settings.language || "ur",
          businessLogo: settings.businessLogo || "",
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
          },
        };
      })
    );
    res.json(clients);
  } catch (error: any) {
    log.error({ err: error }, "Super admin list failed");
    res.status(500).json({ error: "Failed to load clients" });
  }
});

router.post("/super/migrate-phantom", requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const fixed = await dbService.fixPhantomAdmins();
    res.json({ success: true, fixed });
  } catch (error: any) {
    log.error({ err: error }, "Phantom migration failed");
    res.status(500).json({ error: "Migration failed" });
  }
});

export default router;
