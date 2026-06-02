import { dbService } from "./dbService.js";
import { generateSalesResponse } from "./aiService.js";
import { sendWhatsAppMessage } from "../lib/whatsappClient.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("ai:retry-queue");

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

export function queueMessage(
  adminId: string,
  userId: string,
  body: string,
  mediaBase64?: string,
  mimeType?: string,
) {
  const key = `${adminId}:${userId}`;
  if (queue.has(key)) {
    log.warn({ adminId, userId }, "Message already queued, skipping");
    return;
  }
  queue.set(key, {
    adminId,
    userId,
    body,
    mediaBase64,
    mimeType,
    retryCount: 0,
    queuedAt: Date.now(),
  });
  log.info({ adminId, userId }, "Queued message");
}

export function startAiRetryProcessor() {
  log.info({ intervalMs: RETRY_INTERVAL_MS }, "Retry processor started");
  setInterval(async () => {
    if (queue.size === 0) return;
    log.info({ queueSize: queue.size }, "Processing queued messages");
    for (const [key, item] of queue.entries()) {
      try {
        const session = await dbService.getSession(item.adminId, item.userId);
        if (!session) {
          log.warn({ adminId: item.adminId, userId: item.userId }, "Session not found, removing from queue");
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
          undefined,
        );
        if (responseText) {
          const cleanResponse = responseText.replace(/\[.*?\]/g, "").trim();
          const now = Date.now();
          const modelMsg = {
            sessionId: item.userId,
            role: "model" as const,
            text: cleanResponse,
            timestamp: new Date(now).toISOString(),
          };
          await dbService.addMessage(item.adminId, item.userId, modelMsg);
          try {
            await sendWhatsAppMessage(item.adminId, item.userId, cleanResponse);
            log.info({ adminId: item.adminId, userId: item.userId }, "Sent queued reply");
          } catch (sendErr: any) {
            log.error(
              { err: sendErr, adminId: item.adminId, userId: item.userId },
              "Failed to send queued reply",
            );
          }
          queue.delete(key);
        } else {
          item.retryCount++;
          if (item.retryCount >= MAX_RETRIES) {
            log.warn(
              { adminId: item.adminId, userId: item.userId, retries: item.retryCount },
              "Max retries reached, dropping",
            );
            queue.delete(key);
          } else {
            log.info(
              { adminId: item.adminId, userId: item.userId, attempt: item.retryCount, max: MAX_RETRIES },
              "Retry failed, will retry later",
            );
          }
        }
      } catch (err: any) {
        log.error({ err, key }, "Error processing queued message");
        item.retryCount++;
        if (item.retryCount >= MAX_RETRIES) {
          queue.delete(key);
        }
      }
    }
  }, RETRY_INTERVAL_MS);
}
