import crypto from "crypto";
import bcrypt from "bcryptjs";
import { pool } from "./dbService.js";
import nodemailer from "nodemailer";
import { dbService } from "./dbService.js";

export interface TwoFactorSession {
  adminId: string;
  otpHash: string;
  email: string;
  expiresAt: Date;
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function hashOTP(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

export async function sendOTPEmail(email: string, otp: string, storeName: string): Promise<void> {
  const superSettings = await dbService.getSettings("default-admin");
  const smtpHost = superSettings.smtpHost;
  const smtpPort = superSettings.smtpPort || 587;
  const smtpUser = superSettings.smtpUser;
  const smtpPass = superSettings.smtpPass;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn("[2FA] SMTP not configured, using dev fallback OTP:", otp);
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  await transporter.sendMail({
    from: `"${storeName}" <${smtpUser}>`,
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
}

export async function storeOTP(adminId: string, email: string, otpHash: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await pool.query(`DELETE FROM "OtpStore" WHERE "adminId" = $1 AND "email" = $2`, [adminId, email]);
  await pool.query(
    `INSERT INTO "OtpStore" ("email", "otp", "adminId", "password", "expiresAt") VALUES ($1, $2, $3, '', $4)`,
    [email, otpHash, adminId, expiresAt]
  );
}

export async function verifyOTP(adminId: string, otp: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT "otp", "expiresAt" FROM "OtpStore" WHERE "adminId" = $1 AND "password" = '' ORDER BY "expiresAt" DESC LIMIT 1`,
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
