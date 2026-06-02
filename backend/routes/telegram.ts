import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import { testTelegramConnection, setTelegramWebhook, deleteTelegramWebhook, handleTelegramIncoming } from "../services/telegramService.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("route:telegram");
const router = Router();

router.post("/telegram/test", async (req, res) => {
  try {
    const { botToken } = req.body;
    const result = await testTelegramConnection(botToken);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/telegram/config", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const settings = await dbService.getSettings(adminId);
    const telegram = { ...(settings.telegram || {}), ...req.body };
    await dbService.updateSettings(adminId, { telegram });

    if (telegram.isActive && telegram.botToken) {
      const appUrl = process.env.APP_URL || "";
      if (appUrl) {
        const webhookUrl = `${appUrl.replace(/\/$/, "")}/api/webhook/telegram/${adminId}`;
        log.info({ adminId, webhookUrl }, "[TG CONFIG] Registering webhook");
        const success = await setTelegramWebhook(webhookUrl, adminId);
        if (!success) {
          log.warn({ adminId }, "Failed to set Telegram webhook.");
        }
      } else {
        log.warn({ adminId }, "APP_URL not defined. Webhook not set.");
      }
    } else {
      log.info({ adminId }, "Deleting Telegram webhook.");
      await deleteTelegramWebhook(adminId);
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/webhook/telegram/:adminId", async (req, res) => {
  try {
    const { adminId } = req.params;

    // Validate webhook secret if configured
    const settings = await dbService.getSettings(adminId);
    const telegramSecret = settings?.telegram?.webhookSecret;
    const requestSecret = req.query.secret as string;

    if (telegramSecret && requestSecret !== telegramSecret) {
      log.warn({ adminId }, "Telegram webhook called with invalid secret");
      return res.status(403).json({ ok: false, error: "invalid secret" });
    }

    const { message } = req.body;
    if (message && message.chat && message.chat.id) {
      const chatId = message.chat.id;
      const text = message.text || "";
      log.info({ adminId, chatId, text: text.substring(0, 100) }, "[TG WEBHOOK] Received message");
      handleTelegramIncoming(chatId, text, adminId).catch(err => {
        log.error({ err, adminId }, "[TG WEBHOOK] Processing error");
      });
    }
    res.json({ ok: true });
  } catch (error: any) {
    log.error({ err: error }, "[TG WEBHOOK] Error");
    res.status(500).json({ error: error.message });
  }
});

export default router;
