import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import { Message } from "../../src/types.js";

const router = Router();

router.get("/supervisor/sessions", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const sessions = await dbService.getRecentSessions(adminId, 100);
    const enriched = await Promise.all(sessions.map(async (s: any) => {
      const lastMsg = await dbService.getMessages(adminId, s.id);
      return {
        ...s,
        lastMessage: lastMsg[lastMsg.length - 1]?.text || "",
        messages: lastMsg.slice(-5),
      };
    }));
    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/supervisor/handoffs", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const sessions = await dbService.getRecentSessions(adminId, 200);
    // Filter to only sessions with active handoff (handoffTriggered=true, not yet resumed)
    const handoffSessions = sessions.filter((s: any) => {
      const meta = s.metadata || {};
      return meta.handoffTriggered === true && !meta.aiResumed;
    });
    const enriched = await Promise.all(handoffSessions.map(async (s: any) => {
      const msgs = await dbService.getMessages(adminId, s.id);
      const lastMsg = msgs[msgs.length - 1];
      return {
        id: s.id,
        userId: s.userId,
        state: s.state,
        lastMessageAt: s.lastMessageAt,
        lastMessage: lastMsg?.text || "",
        messages: msgs.slice(-5),
        handoffReason: s.metadata?.handoffReason || "",
        handoffSummary: s.metadata?.handoffSummary || null,
        handoffTriggeredAt: s.metadata?.handoffTriggeredAt || s.lastMessageAt,
      };
    }));
    res.json({
      handoffs: enriched,
      total: enriched.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/supervisor/send", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { userId, message } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ error: "userId and message are required" });
    }

    const humanMsg: Message = {
      sessionId: userId,
      role: "human",
      text: message,
      timestamp: new Date().toISOString(),
    };
    await dbService.addMessage(adminId, userId, humanMsg);

    const { sendWhatsAppMessage, isWhatsAppReady } = await import("../lib/whatsappClient.js");
    if (isWhatsAppReady(adminId)) {
      await sendWhatsAppMessage(adminId, userId, message);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/supervisor/resume-ai", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const session = await dbService.getSession(adminId, userId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const metadata = { ...(session.metadata || {}) };
    delete metadata.handoffTriggered;
    delete metadata.handoffReason;
    delete metadata.handoffSummary;
    delete metadata.aiPaused;
    metadata.aiResumed = true;
    metadata.lastResumedAt = new Date().toISOString();

    await dbService.updateSession(adminId, userId, { metadata } as any);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
