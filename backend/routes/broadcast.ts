import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import { sendWhatsAppMessage, isWhatsAppReady } from "../lib/whatsappClient.js";
import { validate } from "../middleware/validate.js";
import { sendBroadcastSchema } from "../schemas/broadcast.js";

const router = Router();

router.post("/broadcast", validate(sendBroadcastSchema), async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    console.log(`[BROADCAST][${adminId}] Starting marketing campaign with message: "${message.slice(0, 50)}..."`);
    const sessions = await dbService.getRecentSessions(adminId, 1000);
    const active = sessions.filter(s => !s.isBlocked);
    console.log(`[BROADCAST][${adminId}] Found ${active.length} active contacts eligible for broadcast.`);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < active.length; i++) {
      const session = active[i];
      console.log(`[BROADCAST][${adminId}] [Progress: ${Math.round((i / active.length) * 100)}%] Attempting to dispatch to ${session.userId}...`);

      try {
        if (isWhatsAppReady(adminId)) {
          await sendWhatsAppMessage(adminId, session.userId, message);
          sent++;
          console.log(`[BROADCAST][${adminId}] ✅ Successfully sent to ${session.userId}.`);
        } else {
          failed++;
          console.error(`[BROADCAST_ERROR][${adminId}] ❌ WhatsApp client is not active/ready for broadcast.`);
        }
      } catch (e: any) {
        failed++;
        console.error(`[BROADCAST_ERROR][${adminId}] ❌ Failed to dispatch to ${session.userId}:`, e.message);
      }

      if (i < active.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    console.log(`[BROADCAST][${adminId}] Campaign finished. Success: ${sent}, Failed: ${failed}.`);
    res.json({ success: true, message: `Broadcast sent to ${sent}/${active.length} customers`, sent, total: active.length });
  } catch (error: any) {
    const safeId = req.headers["x-admin-id"] as string || "unknown";
    console.error(`[BROADCAST_CRITICAL][${safeId}]`, error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
