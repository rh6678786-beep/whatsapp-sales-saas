import { dbService } from "./dbService";
import { generateSalesResponse } from "./aiService";
import { sendWhatsAppMessage } from "../lib/whatsappClient";

interface QueuedItem {
  adminId: string;
  userId: string;
  body: string;
  mediaBase64?: string;
  mimeType?: string;
  retryCount: number;
  queuedAt: number;
}

const queue: Map<string, QueuedItem> = new Map();
const MAX_RETRIES = 6;
const RETRY_INTERVAL_MS = 30000;

export function queueMessage(adminId: string, userId: string, body: string, mediaBase64?: string, mimeType?: string) {
  const key = `${adminId}:${userId}`;
  if (queue.has(key)) {
    console.log(`[AI QUEUE][${adminId}] Message from ${userId} already queued, skipping`);
    return;
  }
  queue.set(key, { adminId, userId, body, mediaBase64, mimeType, retryCount: 0, queuedAt: Date.now() });
  console.log(`[AI QUEUE][${adminId}] Queued message from ${userId}`);
}

export function startAiRetryProcessor() {
  console.log(`[AI QUEUE] Retry processor started (interval: ${RETRY_INTERVAL_MS}ms)`);
  setInterval(async () => {
    if (queue.size === 0) return;
    console.log(`[AI QUEUE] Processing ${queue.size} queued messages...`);
    for (const [key, item] of queue.entries()) {
      try {
        const session = await dbService.getSession(item.adminId, item.userId);
        if (!session) {
          console.log(`[AI QUEUE][${item.adminId}] Session for ${item.userId} not found, removing`);
          queue.delete(key);
          continue;
        }
        const history = await dbService.getMessages(item.adminId, item.userId);
        const products = await dbService.getAllProducts(item.adminId);
        const responseText = await generateSalesResponse(
          item.adminId,
          session.state,
          history,
          item.body,
          products.slice(0, 10),
          item.mediaBase64,
          item.mimeType,
          "Customer",
          undefined
        );
        if (responseText) {
          const cleanResponse = responseText.replace(/\[.*?\]/g, "").trim();
          const now = Date.now();
          const modelMsg = {
            sessionId: item.userId,
            role: 'model' as const,
            text: cleanResponse,
            timestamp: new Date(now).toISOString()
          };
          await dbService.addMessage(item.adminId, item.userId, modelMsg);
          try {
            await sendWhatsAppMessage(item.adminId, item.userId, cleanResponse);
            console.log(`[AI QUEUE][${item.adminId}] Sent queued reply to ${item.userId}`);
          } catch (sendErr: any) {
            console.error(`[AI QUEUE][${item.adminId}] Failed to send queued reply to ${item.userId}: ${sendErr.message}`);
          }
          queue.delete(key);
        } else {
          item.retryCount++;
          if (item.retryCount >= MAX_RETRIES) {
            console.warn(`[AI QUEUE][${item.adminId}] Max retries reached for ${item.userId}, dropping`);
            queue.delete(key);
          } else {
            console.log(`[AI QUEUE][${item.adminId}] Retry ${item.retryCount}/${MAX_RETRIES} for ${item.userId} failed, will retry later`);
          }
        }
      } catch (err: any) {
        console.error(`[AI QUEUE] Error processing ${key}: ${err.message}`);
        item.retryCount++;
        if (item.retryCount >= MAX_RETRIES) {
          queue.delete(key);
        }
      }
    }
  }, RETRY_INTERVAL_MS);
}
