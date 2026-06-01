import Redis from "ioredis";
import { env } from "./env.js";

let redis: Redis | null = null;
let redisAvailable = false;

export function getRedis(): Redis | null {
  if (!redisAvailable) return null;
  return redis;
}

export async function connectRedis(): Promise<boolean> {
  if (!env.REDIS_URL) {
    console.log("[REDIS] No REDIS_URL configured — running without Redis cache");
    return false;
  }
  try {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    await redis.connect();
    redisAvailable = true;
    console.log("[REDIS] Connected successfully");
    return true;
  } catch (err: any) {
    redisAvailable = false;
    console.warn(`[REDIS] Connection failed (${err.message}) — running without cache`);
    return false;
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redisAvailable || !redis) return null;
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: any, ttlSeconds = 60): Promise<void> {
  if (!redisAvailable || !redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {}
}

export async function cacheDel(pattern: string): Promise<void> {
  if (!redisAvailable || !redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch {}
}
