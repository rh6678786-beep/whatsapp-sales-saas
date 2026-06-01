import { Queue, Worker, Job } from "bullmq";
import { env } from "../config/env.js";
import { getRedis } from "../config/redis.js";
import { processAllAdmins } from "../services/proactiveEngine.js";
import { startAiRetryProcessor } from "../services/aiRetryQueue.js";
import { sendDailyReportToAllAdmins } from "../services/emailService.js";

let queuesEnabled = false;
let _proactiveQueue: Queue | null = null;
let _emailQueue: Queue | null = null;
let _retryQueue: Queue | null = null;

export function isQueuesEnabled(): boolean {
  return queuesEnabled;
}

export function getProactiveQueue(): Queue | null { return _proactiveQueue; }
export function getEmailQueue(): Queue | null { return _emailQueue; }
export function getRetryQueue(): Queue | null { return _retryQueue; }

export async function setupQueues(): Promise<void> {
  const theRedis = getRedis();
  if (!theRedis) {
    console.log("[QUEUE] No Redis — using legacy cron jobs instead of BullMQ");
    return;
  }

  const connection = {
    host: env.REDIS_URL ? new URL(env.REDIS_URL).hostname : "localhost",
    port: env.REDIS_URL ? parseInt(new URL(env.REDIS_URL).port || "6379") : 6379,
  };

  try {
    _proactiveQueue = new Queue("proactive", {
      connection,
      defaultJobOptions: { removeOnComplete: true, removeOnFail: 50 },
    });
    _emailQueue = new Queue("email", {
      connection,
      defaultJobOptions: { removeOnComplete: true, removeOnFail: 10 },
    });
    _retryQueue = new Queue("ai-retry", {
      connection,
      defaultJobOptions: { removeOnComplete: true, removeOnFail: 50 },
    });

    new Worker("proactive", async (job: Job) => {
      try {
        await processAllAdmins();
      } catch (err: any) {
        console.error("[QUEUE] Proactive worker error:", err.message);
      }
    }, { connection });

    new Worker("email", async (job: Job) => {
      try {
        if (job.name === "daily-report") {
          await sendDailyReportToAllAdmins();
        }
      } catch (err: any) {
        console.error("[QUEUE] Email worker error:", err.message);
      }
    }, { connection });

    queuesEnabled = true;
    console.log("[QUEUE] BullMQ queues and workers initialized");

    await _proactiveQueue.upsertJobScheduler("proactive-every-15-min", {
      pattern: "*/15 * * * *",
    }, { name: "process-proactive" });

    await _emailQueue.upsertJobScheduler("daily-report-8am", {
      pattern: "0 8 * * *",
    }, { name: "daily-report" });

    console.log("[QUEUE] Job schedulers registered");
  } catch (err: any) {
    console.warn(`[QUEUE] Setup failed (${err.message}) — using legacy cron`);
  }
}

export { startAiRetryProcessor };
