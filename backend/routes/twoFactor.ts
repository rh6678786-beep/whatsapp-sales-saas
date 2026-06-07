import { Router } from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { generateOTP, hashOTP, sendOTPEmail, storeOTP, verifyOTP } from "../services/twoFactorService.js";
import { dbService } from "../services/dbService.js";
import { createChildLogger } from "../lib/logger.js";
import { authRateLimiter } from "../lib/rateLimiter.js";

const log = createChildLogger("route:2fa");
const router = Router();

// OTP brute force protection for 2FA — shared lockout per email across all OTP endpoints
const otpAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_OTP_ATTEMPTS = 3;
const OTP_LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// Periodic cleanup of expired OTP lockout entries (every 30 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of otpAttempts) {
    if (entry.lockedUntil < now) {
      otpAttempts.delete(key);
    }
  }
}, 30 * 60 * 1000);

function checkOtpLockout(key: string): boolean {
  const entry = otpAttempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.lockedUntil) {
    otpAttempts.delete(key);
    return false;
  }
  return true;
}

function recordFailedOtpAttempt(key: string): void {
  const entry = otpAttempts.get(key) || { count: 0, lockedUntil: 0 };
  entry.count++;
  if (entry.count >= MAX_OTP_ATTEMPTS) {
    entry.lockedUntil = Date.now() + OTP_LOCKOUT_DURATION_MS;
    log.warn({ key }, "OTP verification blocked — too many failed attempts");
  }
  otpAttempts.set(key, entry);
}

function clearOtpLockout(key: string): void {
  otpAttempts.delete(key);
}

router.post("/auth/2fa/send", requireAuth, authRateLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const adminId = req.adminId!;
    const settings = await dbService.getSettings(adminId);
    const email = settings.email || settings.verifiedEmail;
    if (!email) {
      return res.status(400).json({ error: "No email configured. Set your email in Settings first." });
    }

    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    await storeOTP(adminId, email, otpHash);
    await sendOTPEmail(email, otp, settings.storeName || "Sales Agent", adminId);

    // NEVER leak OTP in response — even in development mode
    res.json({
      success: true,
      message: "Verification code sent to your email",
    });
  } catch (error: any) {
    log.error({ err: error, adminId: req.adminId }, "2FA send failed");
    res.status(500).json({ error: "Failed to send verification code. Please try again." });
  }
});

router.post("/auth/2fa/verify", requireAuth, authRateLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const adminId = req.adminId!;
    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({ error: "OTP is required" });
    }

    // Get admin email for shared OTP lockout across all OTP endpoints
    const settings = await dbService.getSettings(adminId);
    const email = settings.email || settings.verifiedEmail || adminId;

    // Check OTP brute force lockout — uses email so it's shared with auth.ts
    if (checkOtpLockout(email)) {
      log.warn({ adminId, email }, "2FA verify blocked — too many failed attempts");
      return res.status(429).json({ error: "Too many failed attempts. Try again in 30 minutes." });
    }

    const valid = await verifyOTP(adminId, otp);
    if (!valid) {
      recordFailedOtpAttempt(email);
      return res.status(401).json({ error: "Invalid or expired verification code" });
    }

    clearOtpLockout(email);
    const { generateToken } = await import("../services/authService.js");
    const token = generateToken(adminId);
    res.json({ success: true, token });
  } catch (error: any) {
    log.error({ err: error, adminId: req.adminId }, "2FA verify failed");
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

export default router;
