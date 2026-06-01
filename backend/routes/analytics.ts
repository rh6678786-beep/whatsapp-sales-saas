import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";

const router = Router();

router.get("/analytics/funnel", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const sessions = await dbService.getRecentSessions(adminId, 10000);
    const allStates = ['NEW', 'INTERESTED', 'PRODUCT_SELECTED', 'NEGOTIATING', 'PAYMENT_AWAITING', 'PAYMENT_PENDING', 'PAYMENT_SENT', 'VERIFIED', 'ORDER_CONFIRMED', 'DELIVERED'];
    const stateCounts: Record<string, number> = {};
    for (const s of allStates) stateCounts[s] = 0;
    for (const s of sessions) {
      if (stateCounts[s.state] !== undefined) stateCounts[s.state]++;
    }
    const funnel = allStates.map((state, i) => {
      const count = stateCounts[state];
      const prevCount = i > 0 ? stateCounts[allStates[i - 1]] : count;
      const dropOff = prevCount > 0 ? Math.round((1 - count / prevCount) * 100) : 0;
      return { state, count, dropOff };
    });
    res.json({ funnel, totalSessions: sessions.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/analytics/weak-spots", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const sessions = await dbService.getRecentSessions(adminId, 10000);
    const allStates = ['NEW', 'INTERESTED', 'PRODUCT_SELECTED', 'NEGOTIATING', 'PAYMENT_AWAITING', 'PAYMENT_PENDING', 'PAYMENT_SENT', 'VERIFIED', 'ORDER_CONFIRMED', 'DELIVERED'];
    const stateCounts: Record<string, number> = {};
    for (const s of allStates) stateCounts[s] = 0;
    for (const s of sessions) {
      if (stateCounts[s.state] !== undefined) stateCounts[s.state]++;
    }
    let worstState = '';
    let worstDropOff = 0;
    for (let i = 1; i < allStates.length; i++) {
      const prev = stateCounts[allStates[i - 1]];
      const curr = stateCounts[allStates[i]];
      const dropOff = prev > 0 ? Math.round((1 - curr / prev) * 100) : 0;
      if (dropOff > worstDropOff) {
        worstDropOff = dropOff;
        worstState = allStates[i - 1];
      }
    }
    res.json({ worstState, worstDropOff, stateCounts, totalSessions: sessions.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/analytics/patterns", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { AILearningService } = await import("../services/aiLearningService.js");
    await AILearningService.initialize(adminId);
    const insights = AILearningService.getLearningInsights(adminId);
    res.json(insights);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
