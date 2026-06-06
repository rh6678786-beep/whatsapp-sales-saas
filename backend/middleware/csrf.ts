import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createChildLogger } from '../lib/logger.js';
import { getRedis, isRedisConnected } from '../lib/redis.js';
import jwt from 'jsonwebtoken';

const log = createChildLogger('csrf');

/**
 * CSRF Protection Middleware
 * 
 * Generates CSRF tokens on GET requests
 * Validates CSRF tokens on state-changing requests (POST, PUT, PATCH, DELETE)
 * 
 * Token stored in Redis with automatic TTL (1 hour).
 * Falls back to in-memory store when Redis is not available.
 * 
 * Client sends token in: x-csrf-token header
 * 
 * Session ID is derived from the JWT in the Authorization header (if available).
 * This works even when CSRF middleware runs before requireAuth, because
 * we decode the token ourselves to extract the adminId for scoping.
 * If no JWT is present, falls back to IP-based scoping.
 */

const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_TTL = 3600; // 1 hour
const CSRF_REDIS_PREFIX = 'csrf:';
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// In-memory fallback store (when Redis is unavailable)
interface CsrfSessionStore {
  tokens: Set<string>;
  expiresAt: number;
}
const inMemoryStore = new Map<string, CsrfSessionStore>();

// ---- Redis key helpers ----

function tokensKey(sessionId: string): string {
  return `${CSRF_REDIS_PREFIX}${sessionId}:tokens`;
}

// ---- Store implementation ----

async function storeAddToken(sessionId: string, token: string): Promise<void> {
  const now = Date.now();
  const expirySeconds = CSRF_TOKEN_TTL;

  if (isRedisConnected()) {
    const redis = getRedis()!;
    try {
      await redis
        .multi()
        .sadd(tokensKey(sessionId), token)
        .expire(tokensKey(sessionId), expirySeconds)
        .exec();
      return;
    } catch (err) {
      log.warn({ err }, 'Redis CSRF add failed — falling back to in-memory');
    }
  }

  // Fallback: in-memory
  let store = inMemoryStore.get(sessionId);
  if (!store || store.expiresAt < now) {
    store = { tokens: new Set(), expiresAt: now + expirySeconds * 1000 };
    inMemoryStore.set(sessionId, store);
  }
  store.tokens.add(token);
  store.expiresAt = Math.max(store.expiresAt, now + expirySeconds * 1000);
}

async function storeHasToken(sessionId: string, token: string): Promise<boolean> {
  if (isRedisConnected()) {
    const redis = getRedis()!;
    try {
      return !!(await redis.sismember(tokensKey(sessionId), token));
    } catch (err) {
      log.warn({ err }, 'Redis CSRF check failed — falling back to in-memory');
    }
  }

  // Fallback: in-memory
  const store = inMemoryStore.get(sessionId);
  if (!store) return false;
  if (store.expiresAt < Date.now()) {
    inMemoryStore.delete(sessionId);
    return false;
  }
  return store.tokens.has(token);
}

async function storeRemoveToken(sessionId: string, token: string): Promise<void> {
  if (isRedisConnected()) {
    const redis = getRedis()!;
    try {
      await redis.srem(tokensKey(sessionId), token);
      return;
    } catch (err) {
      log.warn({ err }, 'Redis CSRF remove failed — falling back to in-memory');
    }
  }

  // Fallback: in-memory
  const store = inMemoryStore.get(sessionId);
  if (store) {
    store.tokens.delete(token);
    if (store.tokens.size === 0) {
      inMemoryStore.delete(sessionId);
    }
  }
}

/**
 * Extract a stable session identifier from the request
 * Priority: JWT adminId -> IP address -> random fallback
 */
function extractSessionId(req: Request): string {
  // Try to extract adminId from JWT in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const decoded = jwt.decode(token) as { adminId?: string } | null;
        if (decoded?.adminId) {
          return `user:${decoded.adminId}`;
        }
      } catch {
        // Ignore decode errors
      }
    }
  }
  
  // Fallback: use IP address (less secure but prevents cross-session mixing)
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Generate CSRF token for user session
 */
export async function generateCsrfToken(sessionId: string): Promise<string> {
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  await storeAddToken(sessionId, token);
  return token;
}

/**
 * Verify CSRF token
 */
export async function verifyCsrfToken(sessionId: string, token: string): Promise<boolean> {
  return storeHasToken(sessionId, token);
}

/**
 * Remove CSRF token after use (single-use tokens)
 */
export async function consumeCsrfToken(sessionId: string, token: string): Promise<void> {
  await storeRemoveToken(sessionId, token);
}

/**
 * CSRF Protection Middleware
 */
export async function csrfProtection(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = extractSessionId(req);
    
    // For GET, HEAD, OPTIONS — generate and return token
    if (SAFE_METHODS.includes(req.method)) {
      const token = await generateCsrfToken(sessionId);
      res.locals.csrfToken = token;
      
      // Set in response header for SPAs
      res.set('X-CSRF-Token', token);
      
      return next();
    }

    // For POST, PUT, PATCH, DELETE — verify token
    const token = 
      req.headers['x-csrf-token'] as string ||
      req.body?._csrf as string;

    if (!token) {
      log.warn({ sessionId: sessionId.slice(0, 20), method: req.method, path: req.path }, 'CSRF: Missing token');
      return res.status(403).json({ error: 'CSRF token missing' });
    }

    const valid = await verifyCsrfToken(sessionId, token);
    if (!valid) {
      log.warn({ sessionId: sessionId.slice(0, 20), method: req.method, path: req.path }, 'CSRF: Invalid token');
      return res.status(403).json({ error: 'CSRF token invalid or expired' });
    }

    // Consume token (single-use)
    await consumeCsrfToken(sessionId, token);

    // Generate new token for next request
    const newToken = await generateCsrfToken(sessionId);
    res.locals.csrfToken = newToken;
    res.set('X-CSRF-Token', newToken);

    next();
  } catch (err) {
    log.error({ err }, 'CSRF middleware error');
    next(err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * Cleanup expired tokens from in-memory fallback store.
 * Redis handles TTL automatically — no cleanup needed.
 */
export function cleanupExpiredTokens() {
  setInterval(() => {
    const now = Date.now();
    for (const [sessionId, store] of inMemoryStore.entries()) {
      if (store.expiresAt < now) {
        inMemoryStore.delete(sessionId);
      }
    }
    if (inMemoryStore.size > 0) {
      log.debug({ activeSessions: inMemoryStore.size }, 'CSRF in-memory fallback store cleanup');
    }
  }, 15 * 60 * 1000); // Every 15 minutes
}

export default {
  generateCsrfToken,
  verifyCsrfToken,
  consumeCsrfToken,
  csrfProtection,
  cleanupExpiredTokens
};
