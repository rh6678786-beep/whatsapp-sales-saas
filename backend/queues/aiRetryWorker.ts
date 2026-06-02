import { Queue, Worker, Job } from "bullmq";
import { env } from "../lib/env.js";
import { getRedis } from "../lib/redis.js";
import { dbService } from "../services/dbService.js";
import { generateSalesResponse } from "../services/aiService.js";
import { sendWhatsAppMessage } from "../lib/whatsappClient.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("queue:ai-retry");

interface RetryJobData {
  adminId: string;
  userId: string;
  message: string;
}

const BACKOFFS = [1000, 5000, 30000];
const MAX_RETRIES = 3;

let queue: Queue<RetryJobData> | null = null;
let worker: Worker<RetryJobData> | null = null;

const memQueue: Map<
  string,
  { data: RetryJobData; attempt: number; timer: NodeJS.Timeout }
> = new Map();

async function processRetry(data: RetryJobData): Promise<void> {
  const { adminId, userId, message } = data;

  const session = await dbService.getSession(adminId, userId);
  if (!session) {
    log.warn({ adminId, userId }, "Session not found, dropping");
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
    undefined,
  );

  if (responseText) {
    const cleanResponse = responseText.replace(/\[.*?\]/g, "").trim();
    const now = Date.now();
    const modelMsg = {
      sessionId: userId,
      role: "model" as const,
      text: cleanResponse,
      timestamp: new Date(now).toISOString(),
    };
    await dbService.addMessage(adminId, userId, modelMsg);
    await sendWhatsAppMessage(adminId, userId, cleanResponse);
    log.info({ adminId, userId }, "Sent queued reply");
  } else {
    throw new Error("generateSalesResponse returned empty");
  }
}

export function addToRetryQueue(
  adminId: string,
  userId: string,
  message: string,
): void {
  const data: RetryJobData = { adminId, userId, message };

  if (queue) {
    queue
      .add("retry", data, {
        attempts: MAX_RETRIES,
        backoff: { type: "fixed", delay: 1000 },
      })
      .catch((err) =>
        log.error({ err }, "Failed to add BullMQ job"),
      );
  } else {
    const key = `${adminId}:${userId}`;
    if (memQueue.has(key)) return;

    log.info({ adminId, userId }, "[MEM] Queued message");
    scheduleMemRetry(key, data, 0);
  }
}

function scheduleMemRetry(
  key: string,
  data: RetryJobData,
  attempt: number,
): void {
  if (attempt >= MAX_RETRIES) {
    log.warn({ key }, "[MEM] Max retries reached, dropping");
    memQueue.delete(key);
    return;
  }

  const delay = BACKOFFS[attempt] || 30000;
  const timer = setTimeout(async () => {
    try {
      await processRetry(data);
      memQueue.delete(key);
    } catch (err: any) {
      log.error(
        { err, key, attempt: attempt + 1, max: MAX_RETRIES },
        "[MEM] Retry failed",
      );
      scheduleMemRetry(key, data, attempt + 1);
    }
  }, delay);

  memQueue.set(key, { data, attempt, timer });
}

export function startRetryWorker(): void {
  const redis = getRedis();
  if (!redis) {
    log.info("No Redis — using in-memory retry");
    return;
  }

  const connection = {
    host: env.REDIS_URL
      ? new URL(env.REDIS_URL).hostname
      : "localhost",
    port: env.REDIS_URL
      ? parseInt(new URL(env.REDIS_URL).port || "6379", 10)
      : 6379,
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

  worker = new Worker<RetryJobData>(
    "ai-retry",
    async (job: Job<RetryJobData>) => {
      const { adminId, userId } = job.data;
      log.info(
        { jobId: job.id, adminId, userId, attempt: job.attemptsMade + 1 },
        "Processing retry job",
      );
      await processRetry(job.data);
    },
    { connection },
  );

  worker.on("failed", (job: Job<RetryJobData> | undefined, err: Error) => {
    if (job) {
      log.error(
        { jobId: job.id, adminId: job.data.adminId, attempts: job.attemptsMade },
        `Job failed: ${err.message}`,
      );
    }
  });

  log.info("BullMQ retry worker started");
}

export function stopRetryWorker(): void {
  if (worker) {
    worker.close();
    worker = null;
  }
  queue = null;
  for (const [, entry] of memQueue) {
    clearTimeout(entry.timer);
  }
  memQueue.clear();
  log.info("Retry worker stopped");
}
