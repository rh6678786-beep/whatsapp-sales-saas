import axios from "axios";
import { dbService } from "./dbService";
import { processIncomingMessage } from "./messageHandler";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("facebook");

const FB_GRAPH_URL = "https://graph.facebook.com/v18.0";

export async function sendFacebookMessage(psid: string, text: string, adminId: string = 'default-admin'): Promise<boolean> {
  try {
    const settings = await dbService.getSettings(adminId);
    const token = settings.facebook?.pageAccessToken;
    if (!token) throw new Error("Facebook page token not configured");

    await axios.post(`${FB_GRAPH_URL}/me/messages`, {
      recipient: { id: psid },
      message: { text }
    }, {
      params: { access_token: token }
    });
    return true;
  } catch (error: any) {
    log.error({ err: error?.response?.data || error?.message }, "Facebook send error");
    return false;
  }
}

export async function handleFacebookIncoming(senderPsid: string, messageText: string, adminId: string = 'default-admin') {
  const userId = `fb:${senderPsid}`;
  try {
    const result = await processIncomingMessage(adminId, userId, messageText || "");
    if (result?.text) {
      await sendFacebookMessage(senderPsid, result.text);
    }
    if (result?.shouldBlockUser) {
      log.info({ psid: senderPsid }, "Facebook block");
    }
  } catch (error: any) {
    log.error({ err: error?.message }, "Facebook handler error");
    await sendFacebookMessage(senderPsid, "Maazrat, momentarily ek issue aa gaya — please apna message wapis bhejein ya 2 minute baad dobara try karein. Shukriya 😊");
  }
}

export async function verifyFacebookWebhook(mode: string, token: string, challenge: string, adminId: string = 'default-admin'): Promise<string | null> {
  const settings = await dbService.getSettings(adminId);
  const expectedToken = settings.facebook?.verifyToken;

  if (mode === "subscribe" && token === expectedToken) {
    log.info({}, "Facebook webhook verified successfully");
    return challenge;
  }
  return null;
}

export async function testFacebookConnection(pageId: string, accessToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await axios.get(`${FB_GRAPH_URL}/${pageId}`, {
      params: { access_token: accessToken, fields: "name,id" }
    });
    if (res.data?.id) {
      log.info({ page: res.data.name }, "Facebook connection test successful");
      return { success: true };
    }
    return { success: false, error: "Invalid response from Facebook" };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error?.message || error?.message };
  }
}
