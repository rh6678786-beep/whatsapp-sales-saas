import nodemailer from "nodemailer";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { dbService } from "./dbService";
import { env } from "../lib/env.js";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("otp");

const BCRYPT_ROUNDS = 10;

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, BCRYPT_ROUNDS);
}

async function compareOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

const SMTP_CONFIG = {
  host: env.SMTP_HOST || "",
  port: env.SMTP_PORT || 587,
  user: env.SMTP_USER || "",
  pass: env.SMTP_PASS || "",
  from: env.SMTP_FROM || env.SMTP_USER || "noreply@saascloser.ai",
};

export async function sendOtp(
  email: string,
  data: {
    adminId: string;
    password: string;
    storeName?: string;
    phone?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!SMTP_CONFIG.host || !SMTP_CONFIG.user || !SMTP_CONFIG.pass) {
      return {
        success: false,
        error: "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env",
      };
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await dbService.saveOtp(
      email,
      otpHash,
      data.adminId,
      data.password,
      data.storeName || null,
      expiresAt,
      data.phone || null
    );

    const transporter = nodemailer.createTransport({
      host: SMTP_CONFIG.host,
      port: SMTP_CONFIG.port,
      secure: SMTP_CONFIG.port === 465,
      auth: { user: SMTP_CONFIG.user, pass: SMTP_CONFIG.pass },
    });

    await transporter.sendMail({
      from: `"SaaS Closer AI" <${SMTP_CONFIG.from}>`,
      to: email,
      subject: "Your OTP Code for Registration",
      html: `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:20px;">
          <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
            <div style="width:64px;height:64px;background:#18181b;border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
              <span style="color:#fff;font-size:28px;font-weight:800;">AI</span>
            </div>
            <h2 style="color:#18181b;margin:0;">Verify Your Email</h2>
            <p style="color:#71717a;margin-top:8px;">Use the OTP below to complete your registration</p>
            <div style="background:#f4f4f5;border-radius:12px;padding:20px;margin:24px 0;letter-spacing:8px;font-size:36px;font-weight:800;color:#18181b;">${otp}</div>
            <p style="color:#a1a1aa;font-size:13px;">This OTP is valid for <strong>5 minutes</strong>. If you didn't request this, ignore this email.</p>
          </div>
        </body>
        </html>
      `,
    });

    log.info({ email }, "OTP sent successfully");
    return { success: true };
  } catch (error: any) {
    log.error({ err: error, email }, "Failed to send OTP");
    return { success: false, error: "Failed to send OTP. Please try again." };
  }
}

export async function verifyOtp(
  email: string,
  otp: string
): Promise<{
  valid: boolean;
  data?: {
    adminId: string;
    password: string;
    storeName?: string;
    phone?: string;
  };
  error?: string;
}> {
  try {
    const entry = await dbService.getOtp(email);

    if (!entry) {
      return { valid: false, error: "No OTP found. Please request a new one." };
    }

    if (new Date() > entry.expiresAt) {
      await dbService.deleteOtp(email);
      return { valid: false, error: "OTP has expired. Please request a new one." };
    }

    // Constant-time comparison via bcrypt
    const valid = await compareOtp(otp, entry.otp);

    if (!valid) {
      return { valid: false, error: "Invalid OTP. Please try again." };
    }

    await dbService.deleteOtp(email);
    log.info({ email }, "OTP verified successfully");
    return {
      valid: true,
      data: {
        adminId: entry.adminId,
        password: entry.password,
        storeName: entry.storeName || undefined,
        phone: entry.phone || undefined,
      },
    };
  } catch (error: any) {
    log.error({ err: error, email }, "OTP verification error");
    return { valid: false, error: "Verification failed. Please try again." };
  }
}
