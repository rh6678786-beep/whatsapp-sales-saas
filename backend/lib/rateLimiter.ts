import { Request, Response, NextFunction } from "express";
import { getRedis, isRedisConnected } from "./redis.js";
import { createChildLogger } from "./logger.js";

const log = createChildLogger("rate-limit");

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,
  keyPrefix: "rl",
};

// In-memory fallback when Redis is not available
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of inMemoryStore) {
    if (entry.resetAt < now) inMemoryStore.delete(key);
  }
}, 60 * 1000);

export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const { windowMs, maxRequests, keyPrefix } = { ...DEFAULT_CONFIG, ...config };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = `${keyPrefix}:${req.ip || req.socket.remoteAddress || "unknown"}`;
    const now = Date.now();

    if (isRedisConnected()) {
      const redis = getRedis()!;
      try {
        const windowKey = `ratelimit:${key}:${Math.floor(now / windowMs)}`;
        const count = await redis.incr(windowKey);
        if (count === 1) {
          await redis.pexpire(windowKey, windowMs);
        }
        res.setHeader("X-RateLimit-Limit", maxRequests);
        res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - count));

        if (count > maxRequests) {
          res.status(429).json({ error: "Too many requests. Please try again later." });
          return;
        }
        next();
      } catch (err) {
        log.warn({ err }, "Redis rate limit error — falling back to in-memory");
        next(); // Fail open if Redis errors
      }
    } else {
      // In-memory fallback
      let entry = inMemoryStore.get(key);
      if (!entry || entry.resetAt < now) {
        entry = { count: 1, resetAt: now + windowMs };
        inMemoryStore.set(key, entry);
        next();
        return;
      }

      entry.count++;
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - entry.count));

      if (entry.count > maxRequests) {
        res.status(429).json({ error: "Too many requests. Please try again later." });
        return;
      }
      next();
    }
  };
}

export const defaultRateLimiter = createRateLimiter();
export const authRateLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 10, keyPrefix: "rl-auth" });
export const apiRateLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 120, keyPrefix: "rl-api" });
export const webhookRateLimiter = createRateLimiter({ windowMs: 60 * 1000, maxRequests: 30, keyPrefix: "rl-webhook" });
