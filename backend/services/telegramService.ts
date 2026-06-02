import axios from "axios";
import { dbService } from "./dbService";
import { processIncomingMessage } from "./messageHandler";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("telegram");

const TG_API = "https://api.telegram.org/bot";

async function getBotToken(adminId: string = 'default-admin'): Promise<string> {
  const settings = await dbService.getSettings(adminId);
  return settings.telegram?.botToken || "";
}

export async function setTelegramWebhook(webhookUrl: string, adminId: string = 'default-admin'): Promise<boolean> {
  const token = await getBotToken(adminId);
  if (!token) return false;
  try {
    await axios.post(`${TG_API}${token}/setWebhook`, {
      url: webhookUrl,
      allowed_updates: ["message"]
    });
    log.info({ webhookUrl }, "Telegram webhook set");
    return true;
  } catch (error: any) {
    log.error({ err: error?.response?.data || error?.message }, "Telegram webhook error");
    return false;
  }
}

export async function deleteTelegramWebhook(adminId: string = 'default-admin'): Promise<boolean> {
  const token = await getBotToken(adminId);
  if (!token) return false;
  try {
    await axios.post(`${TG_API}${token}/deleteWebhook`);
    return true;
  } catch (e) {
    return false;
  }
}

export async function sendTelegramMessage(chatId: string, text: string, adminId: string = 'default-admin'): Promise<boolean> {
  const token = await getBotToken(adminId);
  if (!token) return false;
  try {
    await axios.post(`${TG_API}${token}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML"
    });
    return true;
  } catch (error: any) {
    log.error({ err: error?.response?.data || error?.message }, "Telegram send error");
    return false;
  }
}

export async function handleTelegramIncoming(chatId: number, messageText: string, adminId: string = 'default-admin') {
  const userId = `tg:${chatId}`;
  try {
    const result = await processIncomingMessage(adminId, userId, messageText || "");
    if (result?.text) {
      await sendTelegramMessage(String(chatId), result.text);
    }
  } catch (error: any) {
    log.error({ err: error?.message }, "Telegram handler error");
    await sendTelegramMessage(String(chatId), "Maazrat, momentarily ek issue aa gaya hai — aap apna message 1-2 minute mein dobara bhejein, pakka kaam kar jaye ga. 😊");
  }
}

export async function testTelegramConnection(botToken: string): Promise<{ success: boolean; botName?: string; error?: string }> {
  try {
    const res = await axios.get(`${TG_API}${botToken}/getMe`);
    if (res.data?.ok && res.data?.result) {
      const bot = res.data.result;
      log.info({ bot: `@${bot.username}` }, "Telegram connection test successful");
      return { success: true, botName: `@${bot.username}` };
    }
    return { success: false, error: "Invalid bot token" };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.description || error?.message };
  }
}
