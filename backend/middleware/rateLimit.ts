import { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { getRedis, cacheGet, cacheSet } from "../config/redis.js";

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  whitelistRoutes?: string[];
  whitelistIPs?: string[];
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || "500", 10),
  message: "Too many requests, please try again later",
  whitelistRoutes: ["/api/health", "/api/billing/webhook"],
  whitelistIPs: (process.env.RATE_LIMIT_WHITELIST || "").split(",").map(s => s.trim()).filter(Boolean),
};

const authConfig: RateLimitConfig = {
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many login attempts, please try again later",
};

const heavyConfig: RateLimitConfig = {
  windowMs: 60 * 1000,
  max: 20,
  message: "Too many requests, please slow down",
};

export function createRateLimiter(config: RateLimitConfig = defaultConfig) {
  const store = new Map<string, { count: number; resetAt: number }>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 60000);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Whitelist check
    if (config.whitelistRoutes?.some(r => req.path.startsWith(r) || req.originalUrl.startsWith(r))) {
      next();
      return;
    }
    const clientIp = req.ip || req.socket.remoteAddress || "";
    if (config.whitelistIPs?.some(ip => clientIp.includes(ip))) {
      next();
      return;
    }

    const adminId = req.headers["x-admin-id"] as string;
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = adminId ? `admin:${adminId}` : `ip:${ip}`;
    const redis = getRedis();

    if (redis) {
      const redisKey = `ratelimit:${key}:${Math.floor(Date.now() / config.windowMs)}`;
      const current = await cacheGet<number>(redisKey) || 0;
      if (current >= config.max) {
        res.status(429).json({ error: config.message });
        return;
      }
      await cacheSet(redisKey, current + 1, config.windowMs / 1000);
      next();
      return;
    }

    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + config.windowMs });
      next();
      return;
    }

    if (entry.count >= config.max) {
      res.status(429).json({ error: config.message });
      return;
    }

    entry.count++;
    next();
  };
}

export const rateLimitDefault = createRateLimiter(defaultConfig);
export const rateLimitAuth = createRateLimiter(authConfig);
export const rateLimitHeavy = createRateLimiter(heavyConfig);
