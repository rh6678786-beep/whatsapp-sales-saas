import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { env } from "../lib/env.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("auth");

export interface AuthPayload {
  adminId: string;
  jti?: string;
  iat?: number;
  exp?: number;
}

const BCRYPT_ROUNDS = 12;

// Token lifetimes
const ACCESS_TOKEN_EXPIRY = "15m";  // Short-lived access token
const REFRESH_TOKEN_EXPIRY = "7d";  // Long-lived refresh token
const ADMIN_TOKEN_EXPIRY = "2h";    // Admin-specific token
const TEAM_TOKEN_EXPIRY = "1h";     // Team member token

// In-memory refresh token blacklist (use Redis in production for persistence across restarts)
const blacklistedTokens = new Set<string>();

export function revokeRefreshToken(jti: string): void {
  blacklistedTokens.add(jti);
  log.info({ jti: jti.slice(0, 8) + "..." }, "Refresh token revoked");
}

export function isTokenBlacklisted(jti: string | undefined): boolean {
  if (!jti) return false;
  return blacklistedTokens.has(jti);
}

export function revokeAllAdminTokens(adminId: string): number {
  // Note: in-memory set doesn't support prefix deletion.
  // For production with Redis, use SCAN + DEL pattern.
  // This is a simplified version: returns count and logs.
  log.info({ adminId }, "Revoking all tokens for admin");
  return 0;
}

export function generateToken(adminId: string): string {
  return jwt.sign({ adminId } as AuthPayload, env.JWT_SECRET, {
    expiresIn: ADMIN_TOKEN_EXPIRY,
    issuer: "saascloser",
    subject: adminId,
  });
}

export function generateAccessToken(adminId: string): string {
  return jwt.sign({ adminId } as AuthPayload, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: "saascloser",
  });
}

export function generateRefreshToken(adminId: string): string {
  const jti = crypto.randomBytes(16).toString("hex");
  return jwt.sign({ adminId, jti } as AuthPayload & { jti: string }, env.JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: "saascloser",
  });
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      issuer: "saascloser",
    }) as AuthPayload;
    // Check blacklist for refresh tokens
    if (payload.jti && isTokenBlacklisted(payload.jti)) {
      log.warn({ jti: payload.jti.slice(0, 8) + "..." }, "Blacklisted token rejected");
      return null;
    }
    return payload;
  } catch (err) {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=<>?/{}~|]).{8,}$/;

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one lowercase letter" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain at least one uppercase letter" };
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: "Password must contain at least one number" };
  }
  if (!/[!@#$%^&*()_\-+=<>?/{}~|]/.test(password)) {
    return { valid: false, error: "Password must contain at least one special character" };
  }
  return { valid: true };
}
