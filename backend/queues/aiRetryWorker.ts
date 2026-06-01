import { Queue, Worker, Job } from "bullmq";
import { env } from "../config/env.js";
import { getRedis } from "../config/redis.js";
import { dbService } from "../services/dbService.js";
import { generateSalesResponse } from "../services/aiService.js";
import { sendWhatsAppMessage } from "../lib/whatsappClient.js";

interface RetryJobData {
  adminId: string;
  userId: string;
  message: string;
}

const BACKOFFS = [1000, 5000, 30000];
const MAX_RETRIES = 3;

let queue: Queue<RetryJobData> | null = null;
let worker: Worker<RetryJobData> | null = null;

// In-memory fallback
const memQueue: Map<string, { data: RetryJobData; attempt: number; timer: NodeJS.Timeout }> = new Map();

let memWorkerTimer: NodeJS.Timeout | null = null;

async function processRetry(data: RetryJobData): Promise<void> {
  const { adminId, userId, message } = data;

  const session = await dbService.getSession(adminId, userId);
  if (!session) {
    console.log(`[AI RETRY][${adminId}] Session for ${userId} not found, dropping`);
    return;
  }

  const history = await dbService.getMessages(adminId, userId);
  const products = await dbService.getAllProducts(adminId);
  const responseText = await generateSalesResponse(
    adminId,
    session.state,
    history,
    message,
    products.slice(0, 10),
    undefined,
    undefined,
    "Customer",
    undefined
  );

  if (responseText) {
    const cleanResponse = responseText.replace(/\[.*?\]/g, "").trim();
    const now = Date.now();
    const modelMsg = {
      sessionId: userId,
      role: 'model' as const,
      text: cleanResponse,
      timestamp: new Date(now).toISOString(),
    };
    await dbService.addMessage(adminId, userId, modelMsg);
    await sendWhatsAppMessage(adminId, userId, cleanResponse);
    console.log(`[AI RETRY][${adminId}] Sent queued reply to ${userId}`);
  } else {
    throw new Error("generateSalesResponse returned empty");
  }
}

export function addToRetryQueue(adminId: string, userId: string, message: string): void {
  const data: RetryJobData = { adminId, userId, message };

  if (queue) {
    queue.add("retry", data, {
      attempts: MAX_RETRIES,
      backoff: { type: "fixed", delay: 1000 },
    }).catch(err => console.error("[AI RETRY] Failed to add BullMQ job:", err.message));
  } else {
    const key = `${adminId}:${userId}`;
    if (memQueue.has(key)) return;

    console.log(`[AI RETRY][MEM] Queued message from ${userId}`);
    scheduleMemRetry(key, data, 0);
  }
}

function scheduleMemRetry(key: string, data: RetryJobData, attempt: number): void {
  if (attempt >= MAX_RETRIES) {
    console.warn(`[AI RETRY][MEM] Max retries reached for ${key}, dropping`);
    memQueue.delete(key);
    return;
  }

  const delay = BACKOFFS[attempt] || 30000;
  const timer = setTimeout(async () => {
    try {
      await processRetry(data);
      memQueue.delete(key);
    } catch (err: any) {
      console.error(`[AI RETRY][MEM] Attempt ${attempt + 1}/${MAX_RETRIES} failed for ${key}: ${err.message}`);
      scheduleMemRetry(key, data, attempt + 1);
    }
  }, delay);

  memQueue.set(key, { data, attempt, timer });
}

export function startRetryWorker(): void {
  const redis = getRedis();
  if (!redis) {
    console.log("[AI RETRY] No Redis — using in-memory retry");
    return;
  }

  const connection = {
    host: env.REDIS_URL ? new URL(env.REDIS_URL).hostname : "localhost",
    port: env.REDIS_URL ? parseInt(new URL(env.REDIS_URL).port || "6379") : 6379,
  };

  queue = new Queue<RetryJobData>("ai-retry", {
    connection,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: 50,
      attempts: MAX_RETRIES,
      backoff: { type: "exponential", delay: 1000 },
    },
  });

  worker = new Worker<RetryJobData>("ai-retry", async (job: Job<RetryJobData>) => {
    const { adminId, userId } = job.data;
    console.log(`[AI RETRY] Processing job ${job.id} for ${adminId}:${userId} (attempt ${job.attemptsMade + 1})`);
    await processRetry(job.data);
  }, { connection });

  worker.on("failed", (job: Job<RetryJobData> | undefined, err: Error) => {
    if (job) {
      console.error(`[AI RETRY] Job ${job.id} failed after ${job.attemptsMade} attempts: ${err.message}`);
    }
  });

  console.log("[AI RETRY] BullMQ worker started");
}

export function stopRetryWorker(): void {
  if (worker) {
    worker.close();
    worker = null;
  }
  if (queue) {
    queue = null;
  }
  for (const [key, entry] of memQueue) {
    clearTimeout(entry.timer);
  }
  memQueue.clear();
  if (memWorkerTimer) {
    clearInterval(memWorkerTimer);
    memWorkerTimer = null;
  }
  console.log("[AI RETRY] Worker stopped");
}
