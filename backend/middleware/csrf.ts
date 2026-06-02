import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createChildLogger } from '../lib/logger.js';
import jwt from 'jsonwebtoken';

const log = createChildLogger('csrf');

/**
 * CSRF Protection Middleware
 * 
 * Generates CSRF tokens on GET requests
 * Validates CSRF tokens on state-changing requests (POST, PUT, PATCH, DELETE)
 * 
 * Token stored in memory with short TTL (1 hour)
 * Client sends token in: x-csrf-token header
 * 
 * Session ID is derived from the JWT in the Authorization header (if available).
 * This works even when CSRF middleware runs before requireAuth, because
 * we decode the token ourselves to extract the adminId for scoping.
 * If no JWT is present, falls back to IP-based scoping.
 */

const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_TTL = 3600; // 1 hour
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

interface CsrfSessionStore {
  tokens: Set<string>;
  expiresAt: number;
}

// In-memory store (for development/small deployments)
// For production, use Redis
const tokenStore = new Map<string, CsrfSessionStore>();

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
export function generateCsrfToken(sessionId: string): string {
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
  const now = Date.now();
  const expiresAt = now + (CSRF_TOKEN_TTL * 1000);

  let store = tokenStore.get(sessionId);
  if (!store || store.expiresAt < now) {
    store = { tokens: new Set(), expiresAt };
    tokenStore.set(sessionId, store);
  }

  store.tokens.add(token);
  // Update expiry when adding tokens
  store.expiresAt = Math.max(store.expiresAt, expiresAt);
  return token;
}

/**
 * Verify CSRF token
 */
export function verifyCsrfToken(sessionId: string, token: string): boolean {
  const store = tokenStore.get(sessionId);
  if (!store) {
    return false;
  }

  const now = Date.now();
  if (store.expiresAt < now) {
    tokenStore.delete(sessionId);
    return false;
  }

  return store.tokens.has(token);
}

/**
 * Remove CSRF token after use (single-use tokens)
 */
export function consumeCsrfToken(sessionId: string, token: string): void {
  const store = tokenStore.get(sessionId);
  if (store) {
    store.tokens.delete(token);
    // Clean up empty stores
    if (store.tokens.size === 0) {
      tokenStore.delete(sessionId);
    }
  }
}

/**
 * CSRF Protection Middleware
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  const sessionId = extractSessionId(req);
  
  // For GET, HEAD, OPTIONS — generate and return token
  if (SAFE_METHODS.includes(req.method)) {
    const token = generateCsrfToken(sessionId);
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

  if (!verifyCsrfToken(sessionId, token)) {
    log.warn({ sessionId: sessionId.slice(0, 20), method: req.method, path: req.path }, 'CSRF: Invalid token');
    return res.status(403).json({ error: 'CSRF token invalid or expired' });
  }

  // Consume token (single-use)
  consumeCsrfToken(sessionId, token);

  // Generate new token for next request
  const newToken = generateCsrfToken(sessionId);
  res.locals.csrfToken = newToken;
  res.set('X-CSRF-Token', newToken);

  next();
}

/**
 * Cleanup expired tokens and orphaned sessions periodically
 */
export function cleanupExpiredTokens() {
  setInterval(() => {
    const now = Date.now();
    for (const [sessionId, store] of tokenStore.entries()) {
      if (store.expiresAt < now) {
        tokenStore.delete(sessionId);
      }
    }
    // Log cleanup stats occasionally
    if (tokenStore.size > 0) {
      log.debug({ activeSessions: tokenStore.size }, 'CSRF token store cleanup');
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
