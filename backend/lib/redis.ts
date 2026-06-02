import Redis from "ioredis";
import { env } from "./env.js";
import { createChildLogger } from "./logger.js";

const log = createChildLogger("redis");

let client: Redis | null = null;
let isConnected = false;

export function getRedis(): Redis | null {
  return client;
}

export function isRedisConnected(): boolean {
  return isConnected;
}

export async function connectRedis(): Promise<Redis | null> {
  if (client) return client;

  const url = env.REDIS_URL;
  if (!url) {
    log.warn("REDIS_URL not configured — running without Redis. Some features will be degraded.");
    return null;
  }

  client = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 5) {
        log.error("Redis connection failed after 5 retries — running without Redis");
        client = null;
        isConnected = false;
        return null; // Stop retrying
      }
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
    enableOfflineQueue: false,
  });

  client.on("connect", () => {
    isConnected = true;
    log.info("Redis connected");
  });

  client.on("error", (err) => {
    isConnected = false;
    log.warn({ err }, "Redis connection error");
  });

  client.on("close", () => {
    isConnected = false;
  });

  try {
    await client.connect();
  } catch (err) {
    log.warn({ err }, "Failed to connect to Redis — running without Redis");
    client = null;
    isConnected = false;
    return null;
  }

  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
    isConnected = false;
    log.info("Redis disconnected");
  }
}
