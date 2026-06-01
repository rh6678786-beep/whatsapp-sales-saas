import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { getAdminId } from "../middleware/auth.js";
import { testTelegramConnection, setTelegramWebhook, deleteTelegramWebhook, handleTelegramIncoming } from "../services/telegramService.js";

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
        console.log(`[TG CONFIG][${adminId}] Registering webhook: ${webhookUrl}`);
        const success = await setTelegramWebhook(webhookUrl, adminId);
        if (!success) {
          console.warn(`[TG CONFIG][${adminId}] Failed to set Telegram webhook.`);
        }
      } else {
        console.warn(`[TG CONFIG][${adminId}] APP_URL not defined in environment. Webhook not set.`);
      }
    } else {
      console.log(`[TG CONFIG][${adminId}] Deleting Telegram webhook.`);
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
    const { message } = req.body;
    if (message && message.chat && message.chat.id) {
      const chatId = message.chat.id;
      const text = message.text || "";
      console.log(`[TG WEBHOOK][${adminId}] Received message from chat ${chatId}: "${text}"`);
      handleTelegramIncoming(chatId, text, adminId).catch(err => {
        console.error(`[TG WEBHOOK PROCESS ERROR][${adminId}]`, err.message);
      });
    }
    res.json({ ok: true });
  } catch (error: any) {
    console.error("[TG WEBHOOK ERROR]", error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
