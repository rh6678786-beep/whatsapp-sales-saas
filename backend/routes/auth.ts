import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { generateToken, hashPassword, comparePassword, validatePassword } from "../services/authService.js";
import { sendOtp, verifyOtp } from "../services/otpService.js";
import { startTrial } from "../services/stripeService.js";
import { getAdminId } from "../middleware/auth.js";
import { createChildLogger } from "../lib/logger.js";
import { authRateLimiter } from "../lib/rateLimiter.js";
import crypto from "crypto";

const log = createChildLogger("route:auth");
const router = Router();

// Simple in-memory account lockout tracker
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function checkLockout(adminId: string): boolean {
  const entry = loginAttempts.get(adminId);
  if (!entry) return false;
  if (Date.now() > entry.lockedUntil) {
    loginAttempts.delete(adminId);
    return false;
  }
  return true;
}

function recordFailedAttempt(adminId: string): void {
  const entry = loginAttempts.get(adminId) || { count: 0, lockedUntil: 0 };
  entry.count++;
  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    log.warn({ adminId }, "Account locked due to too many failed login attempts");
  }
  loginAttempts.set(adminId, entry);
}

function clearLockout(adminId: string): void {
  loginAttempts.delete(adminId);
}

router.post("/auth/send-otp", authRateLimiter, async (req, res) => {
  try {
    const { email, adminId, password, storeName, phone } = req.body;

    if (!email || !adminId || !password) {
      return res.status(400).json({ error: "email, adminId, and password are required" });
    }

    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.error });
    }

    const emailExists = await dbService.adminExistsByEmail(email);
    if (emailExists) {
      return res.status(409).json({ error: "This email is already registered." });
    }

    const idExists = await dbService.adminExists(adminId);
    if (idExists) {
      return res.status(409).json({ error: "This Store ID already exists." });
    }

    const result = await sendOtp(email, { adminId, password, storeName, phone });

    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to send OTP" });
    }

    log.info({ email, adminId }, "OTP sent");
    res.json({ success: true, message: "OTP sent to your email" });
  } catch (error: any) {
    log.error({ err: error }, "send-otp error");
    res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
});

router.post("/auth/verify-otp", authRateLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: "email and otp are required" });
    }

    const verification = await verifyOtp(email, otp);

    if (!verification.valid) {
      return res.status(400).json({ error: verification.error || "Verification failed" });
    }

    const { adminId, password, storeName, phone } = verification.data!;

    const emailExists = await dbService.adminExistsByEmail(email);
    if (emailExists) {
      return res.status(409).json({ error: "This email is already registered." });
    }

    const idExists = await dbService.adminExists(adminId);
    if (idExists) {
      return res.status(409).json({ error: "This Store ID already exists." });
    }

    const passwordHash = await hashPassword(password);
    await dbService.registerAdmin(adminId, passwordHash);
    await dbService.updateSettings(adminId, { verifiedEmail: email });

    const trial = startTrial();
    await dbService.updateSubscription(adminId, trial);

    if (storeName) {
      await dbService.updateSettings(adminId, { storeName });
    }
    if (phone) {
      await dbService.updateSettings(adminId, { phone });
    }

    const token = generateToken(adminId);
    log.info({ adminId, email }, "Account created via OTP");
    res.json({ success: true, token, adminId });
  } catch (error: any) {
    log.error({ err: error }, "verify-otp error");
    res.status(500).json({ error: "Verification failed. Please try again." });
  }
});

router.post("/auth/login", authRateLimiter, async (req, res) => {
  try {
    const { adminId, password } = req.body;
    if (!adminId || !password) {
      return res.status(400).json({ error: "adminId and password required" });
    }

    // Check account lockout
    if (checkLockout(adminId)) {
      log.warn({ adminId }, "Login blocked — account locked");
      return res.status(429).json({ error: "Account temporarily locked. Try again in 15 minutes." });
    }

    const hash = await dbService.getAdminPasswordHash(adminId);

    if (!hash) {
      // Constant-time dummy comparison to prevent timing enumeration
      await comparePassword(password, "$2b$12$" + "a".repeat(53));
      recordFailedAttempt(adminId);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await comparePassword(password, hash);

    if (!valid) {
      recordFailedAttempt(adminId);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    clearLockout(adminId);

    const token = generateToken(adminId);
    const settings = await dbService.getSettings(adminId);
    log.info({ adminId }, "Admin logged in");
    res.json({ success: true, token, adminId, storeName: settings.storeName });
  } catch (error: any) {
    log.error({ err: error }, "login error");
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

router.post("/auth/change-password", async (req, res) => {
  try {
    const adminId = getAdminId(req);
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: "oldPassword and newPassword required" });
    }

    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.error });
    }

    const hash = await dbService.getAdminPasswordHash(adminId);
    if (!hash) {
      await comparePassword(oldPassword, "$2b$12$" + "a".repeat(53));
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    const valid = await comparePassword(oldPassword, hash);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    const newHash = await hashPassword(newPassword);
    await dbService.registerAdmin(adminId, newHash);
    log.info({ adminId }, "Password changed");
    res.json({ success: true });
  } catch (error: any) {
    log.error({ err: error }, "change-password error");
    res.status(500).json({ error: "Failed to change password" });
  }
});

export default router;
