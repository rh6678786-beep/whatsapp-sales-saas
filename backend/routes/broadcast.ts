import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import { sendWhatsAppMessage, isWhatsAppReady } from "../lib/whatsappClient.js";
import { validate } from "../middleware/validate.js";
import { sendBroadcastSchema } from "../schemas/broadcast.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("route:broadcast");
const router = Router();

const BATCH_DELAY_MS = 1500;

router.post("/broadcast", validate(sendBroadcastSchema), async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    log.info({ adminId, msgLen: message.length }, "Starting marketing campaign");
    const sessions = await dbService.getRecentSessions(adminId, 1000);
    const active = sessions.filter(s => !s.isBlocked);
    log.info({ adminId, total: sessions.length, active: active.length }, "Broadcast contacts found");

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < active.length; i++) {
      const session = active[i];
      const progress = Math.round((i / active.length) * 100);
      log.debug({ adminId, progress, userId: session.userId }, "Broadcast progress");

      try {
        if (isWhatsAppReady(adminId)) {
          await sendWhatsAppMessage(adminId, session.userId, message);
          sent++;
          log.debug({ adminId, userId: session.userId }, "Broadcast sent");
        } else {
          failed++;
          log.warn({ adminId }, "WhatsApp client not ready for broadcast");
        }
      } catch (e: any) {
        failed++;
        log.warn({ adminId, userId: session.userId, err: e.message }, "Broadcast send failed");
      }

      if (i < active.length - 1) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    log.info({ adminId, sent, failed, total: active.length }, "Campaign finished");
    res.json({ success: true, message: `Broadcast sent to ${sent}/${active.length} customers`, sent, total: active.length });
  } catch (error: any) {
    log.error({ err: error, adminId: req.headers.authorization?.slice(0, 20) }, "Broadcast critical error");
    res.status(500).json({ error: error.message });
  }
});

export default router;
