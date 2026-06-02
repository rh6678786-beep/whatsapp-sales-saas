import { Queue, Worker, Job } from "bullmq";
import { env } from "../lib/env.js";
import { getRedis } from "../lib/redis.js";
import { processAllAdmins } from "../services/proactiveEngine.js";
import { startAiRetryProcessor } from "../services/aiRetryQueue.js";
import { sendDailyReportToAllAdmins } from "../services/emailService.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("queue");

let queuesEnabled = false;
let _proactiveQueue: Queue | null = null;
let _emailQueue: Queue | null = null;
let _retryQueue: Queue | null = null;

export function isQueuesEnabled(): boolean {
  return queuesEnabled;
}

export function getProactiveQueue(): Queue | null {
  return _proactiveQueue;
}
export function getEmailQueue(): Queue | null {
  return _emailQueue;
}
export function getRetryQueue(): Queue | null {
  return _retryQueue;
}

function buildRedisConnection() {
  if (!env.REDIS_URL) {
    return { host: "localhost", port: 6379 };
  }
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: parseInt(url.port || "6379", 10),
    ...(url.password ? { password: url.password } : {}),
  };
}

export async function setupQueues(): Promise<void> {
  const theRedis = getRedis();
  if (!theRedis) {
    log.info("No Redis — using legacy cron jobs instead of BullMQ");
    return;
  }

  const connection = buildRedisConnection();

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

    new Worker(
      "proactive",
      async (job: Job) => {
        try {
          await processAllAdmins();
        } catch (err: any) {
          log.error({ err }, "Proactive worker error");
        }
      },
      { connection },
    );

    new Worker(
      "email",
      async (job: Job) => {
        try {
          if (job.name === "daily-report") {
            await sendDailyReportToAllAdmins();
          }
        } catch (err: any) {
          log.error({ err }, "Email worker error");
        }
      },
      { connection },
    );

    queuesEnabled = true;
    log.info("BullMQ queues and workers initialized");

    await _proactiveQueue.upsertJobScheduler("proactive-every-15-min", {
      pattern: "*/15 * * * *",
    }, { name: "process-proactive" });

    await _emailQueue.upsertJobScheduler("daily-report-8am", {
      pattern: "0 8 * * *",
    }, { name: "daily-report" });

    log.info("Job schedulers registered");
  } catch (err: any) {
    log.warn({ err }, "Queue setup failed — using legacy cron");
  }
}

export { startAiRetryProcessor };
