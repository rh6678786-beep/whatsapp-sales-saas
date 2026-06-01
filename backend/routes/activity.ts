import { Router } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { pool } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";

const router = Router();

// GET /activity — recent activity across the system
router.get("/activity", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const adminId = req.adminId!;
    
    // Recent sessions
    const sessionsRes = await pool.query(
      `SELECT id, "userId", state, "lastMessageAt" FROM "Session" WHERE "adminId" = $1 ORDER BY "lastMessageAt" DESC LIMIT 10`,
      [adminId]
    );
    
    // Recent orders
    const ordersRes = await pool.query(
      `SELECT id, "userId", status, amount, "createdAt" FROM "Order" WHERE "adminId" = $1 ORDER BY "createdAt" DESC LIMIT 10`,
      [adminId]
    );

    // Combine and sort by time
    const now = new Date();
    const activities: { type: string; description: string; time: string; icon: string; color: string }[] = [];

    for (const s of sessionsRes.rows) {
      const ago = getTimeAgo(new Date(s.lastMessageAt), now);
      activities.push({
        type: "session",
        description: `Customer ${s.userId.slice(-6)} ${s.state === 'ORDER_CONFIRMED' ? 'placed order' : s.state === 'PAYMENT_SENT' ? 'sent payment' : s.state === 'BLOCKED' ? 'was blocked' : 'sent a message'}`,
        time: ago,
        icon: s.state === 'PAYMENT_SENT' ? '💳' : s.state === 'ORDER_CONFIRMED' ? '📦' : '💬',
        color: s.state === 'PAYMENT_SENT' ? 'amber' : s.state === 'ORDER_CONFIRMED' ? 'emerald' : 'blue',
      });
    }

    for (const o of ordersRes.rows) {
      const ago = getTimeAgo(new Date(o.createdAt), now);
      activities.push({
        type: "order",
        description: `Order ${o.id.slice(-8)} — ${o.status} — PKR ${o.amount.toLocaleString()}`,
        time: ago,
        icon: '📋',
        color: o.status === 'DELIVERED' ? 'emerald' : o.status === 'SHIPPED' ? 'blue' : 'amber',
      });
    }

    // Audit logs
    const auditRes = await pool.query(
      `SELECT action, entity, details, created_at as "createdAt" FROM "audit_logs" WHERE admin_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [adminId]
    );
    for (const a of auditRes.rows) {
      const ago = getTimeAgo(new Date(a.createdAt), now);
      activities.push({
        type: "audit",
        description: `${a.action} ${a.entity}${a.details?.id ? ` #${a.details.id.slice(-6)}` : ''}`,
        time: ago,
        icon: '🔍',
        color: 'violet',
      });
    }

    // Sort by time (most recent first), take top 20
    activities.sort((a, b) => {
      const aNum = parseTimeAgo(a.time);
      const bNum = parseTimeAgo(b.time);
      return aNum - bNum;
    });
    const recent = activities.slice(0, 20);

    // Counts for summary cards
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRes = await pool.query(
      `SELECT COUNT(*) as count FROM "Session" WHERE "adminId" = $1 AND "lastMessageAt" >= $2`,
      [adminId, today]
    );
    const ordersToday = await pool.query(
      `SELECT COUNT(*) as count FROM "Order" WHERE "adminId" = $1 AND "createdAt" >= $2`,
      [adminId, today]
    );

    res.json({
      activities: recent,
      summary: {
        sessionsToday: parseInt(todayRes.rows[0].count),
        ordersToday: parseInt(ordersToday.rows[0].count),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function getTimeAgo(date: Date, now: Date): string {
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function parseTimeAgo(time: string): number {
  if (time === 'Just now') return 0;
  const num = parseInt(time);
  if (time.includes('m')) return num;
  if (time.includes('h')) return num * 60;
  if (time.includes('d')) return num * 1440;
  return 0;
}

export default router;
