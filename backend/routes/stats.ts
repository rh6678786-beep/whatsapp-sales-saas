import { Router } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { pool } from "../services/dbService.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("route:stats");
const router = Router();

router.get("/stats", requireAuth, async (req: AuthenticatedRequest, res) => {
  const adminId = req.adminId!;
  try {
    const [ordersRes, pendingRes, sessionsRes, salesRes, todaySalesRes, timeStats] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int as count FROM "Order" WHERE "adminId" = $1`, [adminId]),
      pool.query(`SELECT COUNT(*)::int as count FROM "Session" WHERE "adminId" = $1 AND "state" IN ('PAYMENT_PENDING','PAYMENT_AWAITING')`, [adminId]),
      pool.query(`SELECT COUNT(*)::int as count FROM "Session" WHERE "adminId" = $1 AND "lastMessageAt" >= NOW() - INTERVAL '30 days'`, [adminId]),
      pool.query(`SELECT COALESCE(SUM("amount"), 0)::float as total, COALESCE(SUM("amount" - "costPrice"), 0)::float as profit FROM "Order" WHERE "adminId" = $1`, [adminId]),
      pool.query(`SELECT COALESCE(SUM("amount" - "costPrice"), 0)::float as profit FROM "Order" WHERE "adminId" = $1 AND "createdAt" >= CURRENT_DATE`, [adminId]),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE "createdAt" >= CURRENT_DATE)::int as today_count,
          COALESCE(SUM("amount") FILTER (WHERE "createdAt" >= CURRENT_DATE), 0)::float as today_value,
          COUNT(*) FILTER (WHERE "createdAt" >= DATE_TRUNC('week', CURRENT_DATE))::int as week_count,
          COALESCE(SUM("amount") FILTER (WHERE "createdAt" >= DATE_TRUNC('week', CURRENT_DATE)), 0)::float as week_value,
          COUNT(*) FILTER (WHERE "createdAt" >= DATE_TRUNC('month', CURRENT_DATE))::int as month_count,
          COALESCE(SUM("amount") FILTER (WHERE "createdAt" >= DATE_TRUNC('month', CURRENT_DATE)), 0)::float as month_value,
          COUNT(*) FILTER (WHERE "createdAt" >= DATE_TRUNC('year', CURRENT_DATE))::int as year_count,
          COALESCE(SUM("amount") FILTER (WHERE "createdAt" >= DATE_TRUNC('year', CURRENT_DATE)), 0)::float as year_value
        FROM "Order" WHERE "adminId" = $1
      `, [adminId]),
    ]);

    const totalOrders = ordersRes.rows[0]?.count ?? 0;
    const pendingPayments = pendingRes.rows[0]?.count ?? 0;
    const activeUsers = sessionsRes.rows[0]?.count ?? 0;
    const totalSales = salesRes.rows[0]?.total ?? 0;
    const totalProfit = salesRes.rows[0]?.profit ?? 0;
    const todayProfit = todaySalesRes.rows[0]?.profit ?? 0;
    const ts = timeStats.rows[0] ?? {};

    res.json({
      activeUsers,
      totalOrders,
      pendingPayments,
      totalSales,
      totalProfit,
      todayProfit,
      stats: {
        today: { count: ts.today_count ?? 0, value: ts.today_value ?? 0 },
        week: { count: ts.week_count ?? 0, value: ts.week_value ?? 0 },
        month: { count: ts.month_count ?? 0, value: ts.month_value ?? 0 },
        year: { count: ts.year_count ?? 0, value: ts.year_value ?? 0 },
      },
    });
  } catch (error: any) {
    log.error({ err: error, adminId }, "Failed to fetch stats");
    res.status(500).json({ error: error.message });
  }
});

export default router;
