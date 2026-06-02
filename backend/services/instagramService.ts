import axios from "axios";
import { dbService } from "./dbService";
import { processIncomingMessage } from "./messageHandler";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("instagram");

const FB_GRAPH_URL = "https://graph.facebook.com/v18.0";

export async function sendInstagramMessage(igUserId: string, text: string, adminId: string = 'default-admin'): Promise<boolean> {
  try {
    const settings = await dbService.getSettings(adminId);
    const token = settings.instagram?.pageAccessToken;
    if (!token) throw new Error("Instagram token not configured");

    await axios.post(`${FB_GRAPH_URL}/${igUserId}/messages`, {
      recipient: { id: igUserId },
      message: { text }
    }, {
      params: { access_token: token }
    });
    return true;
  } catch (error: any) {
    log.error({ err: error?.response?.data || error?.message }, "Instagram send error");
    return false;
  }
}

export async function handleInstagramIncoming(senderIgId: string, messageText: string, adminId: string = 'default-admin') {
  const userId = `ig:${senderIgId}`;
  try {
    const result = await processIncomingMessage(adminId, userId, messageText || "");
    if (result?.text) {
      await sendInstagramMessage(senderIgId, result.text);
    }
    if (result?.shouldBlockUser) {
      log.info({ igId: senderIgId }, "Instagram block");
    }
  } catch (error: any) {
    log.error({ err: error?.message }, "Instagram handler error");
    await sendInstagramMessage(senderIgId, "Maazrat, ek chota sa technical glitch aaya — aap apna message wapis bhejein, main turant reply kar deta hoon. 😊");
  }
}

export async function verifyInstagramWebhook(mode: string, token: string, challenge: string, adminId: string = 'default-admin'): Promise<string | null> {
  const settings = await dbService.getSettings(adminId);
  const expectedToken = settings.instagram?.verifyToken;

  if (mode === "subscribe" && token === expectedToken) {
    log.info({}, "Instagram webhook verified successfully");
    return challenge;
  }
  return null;
}

export async function testInstagramConnection(igBusinessId: string, accessToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await axios.get(`${FB_GRAPH_URL}/${igBusinessId}`, {
      params: { access_token: accessToken, fields: "name,id,username" }
    });
    if (res.data?.id) {
      log.info({ user: res.data.username || res.data.name }, "Instagram connection test successful");
      return { success: true };
    }
    return { success: false, error: "Invalid response from Instagram API" };
  } catch (error: any) {
    return { success: false, error: error?.response?.data?.error?.message || error?.message };
  }
}

export async function getInstagramConversations(accessToken: string, adminId: string = 'default-admin'): Promise<{ id: string; name: string }[]> {
  try {
    const settings = await dbService.getSettings(adminId);
    const igId = settings.instagram?.igBusinessId;
    if (!igId) throw new Error("Instagram Business ID not configured");

    const res = await axios.get(`${FB_GRAPH_URL}/${igId}/conversations`, {
      params: {
        access_token: accessToken,
        fields: "participants{username,id},messages{message,from{username,id},to{username,id}}"
      }
    });
    return res.data?.data?.map((c: any) => ({
      id: c.id,
      name: c.participants?.find((p: any) => p.id !== igId)?.username || "Unknown"
    })) || [];
  } catch (error: any) {
    log.error({ err: error?.response?.data || error?.message }, "Instagram conversations error");
    return [];
  }
}
