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

// OTP brute force protection — separate tracker for OTP verification
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

// ---- OTP Brute Force Protection ----

function checkOtpLockout(email: string): boolean {
  const entry = otpAttempts.get(email);
  if (!entry) return false;
  if (Date.now() > entry.lockedUntil) {
    otpAttempts.delete(email);
    return false;
  }
  return true;
}

function recordFailedOtpAttempt(email: string): void {
  const entry = otpAttempts.get(email) || { count: 0, lockedUntil: 0 };
  entry.count++;
  if (entry.count >= MAX_OTP_ATTEMPTS) {
    entry.lockedUntil = Date.now() + OTP_LOCKOUT_DURATION_MS;
    log.warn({ email }, "OTP verification blocked — too many failed attempts");
  }
  otpAttempts.set(email, entry);
}

function clearOtpLockout(email: string): void {
  otpAttempts.delete(email);
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

    // Check OTP brute force lockout
    if (checkOtpLockout(email)) {
      log.warn({ email }, "OTP verification blocked — account locked due to too many failed attempts");
      return res.status(429).json({ error: "Too many failed attempts. Try again in 30 minutes." });
    }

    const verification = await verifyOtp(email, otp);

    if (!verification.valid) {
      recordFailedOtpAttempt(email);
      return res.status(400).json({ error: verification.error || "Verification failed" });
    }

    // Clear OTP lockout on success
    clearOtpLockout(email);

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

/**
 * LOGIN BY EMAIL — resolves adminId from verified email, then logs in.
 */
router.post("/auth/login-by-email", authRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    // Find admin by email
    const admin = await dbService.findAdminByEmail(email);
    if (!admin) {
      // Constant-time dummy comparison to prevent timing enumeration
      const { comparePassword } = await import("../services/authService.js");
      await (comparePassword as any)(password, "$2b$12$" + "a".repeat(53));
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const adminId = admin.adminId;

    // Check account lockout
    if (checkLockout(adminId)) {
      log.warn({ adminId, email }, "Login blocked — account locked");
      return res.status(429).json({ error: "Account temporarily locked. Try again in 15 minutes." });
    }

    const hash = admin.passwordHash;
    const { comparePassword, generateToken } = await import("../services/authService.js");
    const valid = await comparePassword(password, hash);
    if (!valid) {
      recordFailedAttempt(adminId);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    clearLockout(adminId);

    // Also update last login info
    await dbService.updateSettings(adminId, { lastLoginAt: new Date().toISOString() } as any);

    const token = generateToken(adminId);
    const settings = await dbService.getSettings(adminId);
    log.info({ adminId, email }, "Admin logged in via email");
    res.json({ success: true, token, adminId, storeName: settings.storeName });
  } catch (error: any) {
    log.error({ err: error }, "login-by-email error");
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

/**
 * LOOKUP STORE ID BY EMAIL — returns the adminId for a verified email.
 * Useful for users who forgot their Store ID.
 */
router.post("/auth/lookup-store-id", authRateLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Find admin by email
    const admin = await dbService.findAdminByEmail(email);
    
    // Always respond with same generic message to prevent email enumeration.
    // Since login-by-email endpoint already exists, admin can just login with email + password.
    if (!admin) {
      log.warn({ email }, "Store ID lookup attempted for unknown email");
    }

    // Don't leak whether email exists — same response either way
    res.json({ 
      message: "You can use your email address to login directly instead of a Store ID. Click 'Login with email' on the sign-in page."
    });
  } catch (error: any) {
    log.error({ err: error }, "lookup-store-id error");
    res.status(500).json({ error: "Lookup failed. Please try again." });
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
      // Fallback: check against ADMIN_PASSWORD from .env
      const envPassword = process.env.ADMIN_PASSWORD || '';
      if (envPassword && password === envPassword) {
        // Hash the env password and save it for future logins
        const hashed = await hashPassword(password);
        await dbService.registerAdmin(adminId, hashed);
      } else {
        // Constant-time dummy comparison to prevent timing enumeration
        await comparePassword(password, "$2b$12$" + "a".repeat(53));
        recordFailedAttempt(adminId);
        return res.status(401).json({ error: "Invalid credentials" });
      }
    } else {
      const valid = await comparePassword(password, hash);
      if (!valid) {
        recordFailedAttempt(adminId);
        return res.status(401).json({ error: "Invalid credentials" });
      }
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

/**
 * REQUEST PASSWORD RESET
 * Generates a password reset token and sends it via email
 */
router.post("/auth/forgot-password", authRateLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Find admin by email (don't leak whether email exists)
    const admin = await dbService.findAdminByEmail(email);

    // Always respond with success to prevent email enumeration
    if (!admin) {
      return res.json({ 
        success: true, 
        message: "If an account exists, a password reset link has been sent to your email" 
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    // Store reset token (implement this in your database)
    // For now, we'll store in a simple temporary structure
    // In production, add a PasswordReset table to Prisma schema
    await dbService.storePasswordReset(admin.adminId, resetTokenHash, expiresAt);

    // Send email with reset link
    const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    try {
      // TODO: Implement email service
      log.info({ adminId: admin.adminId, email }, `Password reset link would be sent to: ${resetLink}`);
      // await emailService.send(email, 'Password Reset', resetLink);
    } catch (emailError) {
      log.error({ err: emailError }, "Failed to send password reset email");
    }

    res.json({ 
      success: true, 
      message: "If an account exists, a password reset link has been sent to your email" 
    });
  } catch (error: any) {
    log.error({ err: error }, "forgot-password error");
    res.status(500).json({ error: "Failed to process password reset request" });
  }
});

/**
 * RESET PASSWORD
 * Validates reset token and updates password
 */
router.post("/auth/reset-password", authRateLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password are required" });
    }

    const pwCheck = validatePassword(newPassword);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.error });
    }

    // Hash token to look up in database
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Verify reset token exists and is not expired
    const resetRecord = await dbService.getPasswordReset(resetTokenHash);

    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      log.warn({ token: token.slice(0, 8) }, "Attempt to reset password with invalid/expired token");
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    // Update password
    const passwordHash = await hashPassword(newPassword);
    await dbService.registerAdmin(resetRecord.adminId, passwordHash);

    // Delete used reset token
    await dbService.deletePasswordReset(resetTokenHash);

    log.info({ adminId: resetRecord.adminId }, "Password reset via token");
    res.json({ success: true, message: "Password has been reset. You can now login." });
  } catch (error: any) {
    log.error({ err: error }, "reset-password error");
    res.status(500).json({ error: "Failed to reset password" });
  }
});

export default router;
