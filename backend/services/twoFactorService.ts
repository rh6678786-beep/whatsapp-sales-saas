import crypto from "crypto";
import bcrypt from "bcryptjs";
import { pool, dbService } from "./dbService.js";
import nodemailer from "nodemailer";
import { createChildLogger } from "../lib/logger.js";

const log = createChildLogger("2fa");

export interface TwoFactorSession {
  adminId: string;
  otpHash: string;
  email: string;
  expiresAt: Date;
}

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function hashOTP(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

export async function sendOTPEmail(
  email: string,
  otp: string,
  storeName: string,
  adminId: string
): Promise<void> {
  // Use the tenant's own SMTP settings
  const settings = await dbService.getSettings(adminId);
  const smtpHost = settings.smtpHost || process.env.SMTP_HOST || "";
  const smtpPort = settings.smtpPort || parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = settings.smtpUser || process.env.SMTP_USER || "";
  const smtpPass = settings.smtpPass || process.env.SMTP_PASS || "";
  const smtpFrom = process.env.SMTP_FROM || smtpUser || "noreply@saascloser.ai";

  if (!smtpHost || !smtpUser || !smtpPass) {
    log.error({ adminId, email }, "SMTP not configured for 2FA");
    throw new Error("SMTP not configured. Cannot send verification code.");
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: `"${storeName}" <${smtpFrom}>`,
    to: email,
    subject: `Your verification code: ${otp}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#18181b;font-size:20px;">Verification Code</h2>
        <p style="color:#71717a;font-size:14px;">Enter this code to complete your login:</p>
        <div style="background:#f4f4f5;border-radius:12px;padding:20px;text-align:center;margin:16px 0;letter-spacing:8px;font-size:32px;font-weight:800;color:#18181b;">${otp}</div>
        <p style="color:#a1a1aa;font-size:12px;">This code expires in 5 minutes.</p>
      </div>`,
  });

  log.info({ adminId, email }, "2FA code sent");
}

export async function storeOTP(
  adminId: string,
  email: string,
  otpHash: string
): Promise<void> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await pool.query(
    `DELETE FROM "OtpStore" WHERE "adminId" = $1 AND "email" = $2`,
    [adminId, email]
  );
  await pool.query(
    `INSERT INTO "OtpStore" ("email", "otp", "adminId", "password", "expiresAt")
     VALUES ($1, $2, $3, '', $4)`,
    [email, otpHash, adminId, expiresAt]
  );
}

export async function verifyOTP(
  adminId: string,
  otp: string
): Promise<boolean> {
  const result = await pool.query(
    `SELECT "otp", "expiresAt" FROM "OtpStore"
     WHERE "adminId" = $1 AND "password" = ''
     ORDER BY "expiresAt" DESC LIMIT 1`,
    [adminId]
  );

  if (result.rows.length === 0) return false;
  const row = result.rows[0];

  if (new Date(row.expiresAt) < new Date()) return false;

  return bcrypt.compare(otp, row.otp);
}

export async function cleanupOTPs(): Promise<void> {
  await pool.query(`DELETE FROM "OtpStore" WHERE "expiresAt" < NOW()`);
}
