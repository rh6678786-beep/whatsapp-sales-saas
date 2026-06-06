import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import { createChildLogger } from "../lib/logger.js";
import { env } from "../lib/env.js";

const log = createChildLogger("route:monitoring");
const router = Router();

/**
 * GET /api/monitoring/alerts
 * Returns recent AI DLQ entries (errors/warnings) for the current admin.
 */
router.get("/monitoring/alerts", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const alerts = await dbService.getRecentAlerts(adminId, limit);
    res.json({
      data: alerts,
      total: alerts.length,
    });
  } catch (error: any) {
    log.error({ err: error }, "Failed to fetch alerts");
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

/**
 * GET /api/monitoring/health-summary
 * Returns a concise health summary for the admin dashboard.
 */
router.get("/monitoring/health-summary", async (req, res) => {
  try {
    const adminId = getAdminId(req);

    const [alerts, sessions] = await Promise.all([
      dbService.getRecentAlerts(adminId, 5),
      dbService.getRecentSessions(adminId, 10),
    ]);

    // Use the alerts we already fetched — count is approximate but avoids extra query
    const errorCount = alerts.length;

    // Check Stripe status
    const stripeConfigured = !!env.STRIPE_SECRET_KEY;
    const stripeLiveMode = stripeConfigured && env.STRIPE_SECRET_KEY.startsWith("sk_live_");

    // Check WhatsApp config
    const activeSessions = sessions.filter(s => !s.isBlocked);
    const blockedSessions = sessions.filter(s => s.isBlocked);

    res.json({
      timestamp: new Date().toISOString(),
      services: {
        stripe: stripeLiveMode ? "live" : stripeConfigured ? "test" : "not_configured",
        sentry: !!env.SENTRY_DSN ? "configured" : "not_configured",
      },
      errors: {
        recentCount: errorCount,
        recent: alerts,
      },
      sessions: {
        active: activeSessions.length,
        blocked: blockedSessions.length,
        total: sessions.length,
      },
    });
  } catch (error: any) {
    log.error({ err: error }, "Failed to fetch health summary");
    res.status(500).json({ error: "Failed to fetch health summary" });
  }
});

export default router;
