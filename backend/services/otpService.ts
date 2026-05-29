import nodemailer from "nodemailer";
import { dbService } from "./dbService";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || "",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@saascloser.ai",
  };
}

export async function sendOtp(email: string, data: { adminId: string; password: string; storeName?: string; phone?: string }): Promise<{ success: boolean; error?: string }> {
  try {
    const config = getSmtpConfig();
    if (!config.host || !config.user || !config.pass) {
      return { success: false, error: "SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env" };
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 30 * 1000);

    await dbService.saveOtp(email, otp, data.adminId, data.password, data.storeName || null, expiresAt, data.phone || null);

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
    });

    await transporter.sendMail({
      from: `"SaaS Closer AI" <${config.from}>`,
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
            <p style="color:#a1a1aa;font-size:13px;">This OTP is valid for <strong>30 seconds</strong>. If you didn't request this, ignore this email.</p>
          </div>
        </body>
        </html>
      `,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function verifyOtp(email: string, otp: string): Promise<{ valid: boolean; data?: { adminId: string; password: string; storeName?: string; phone?: string }; error?: string }> {
  try {
    const entry = await dbService.getOtp(email);

    if (!entry) {
      return { valid: false, error: "No OTP found. Please request a new one." };
    }

    if (new Date() > entry.expiresAt) {
      await dbService.deleteOtp(email);
      return { valid: false, error: "OTP has expired. Please request a new one." };
    }

    if (entry.otp !== otp) {
      return { valid: false, error: "Invalid OTP. Try again." };
    }

    await dbService.deleteOtp(email);
    return { valid: true, data: { adminId: entry.adminId, password: entry.password, storeName: entry.storeName || undefined, phone: entry.phone || undefined } };
  } catch (error: any) {
    return { valid: false, error: error.message };
  }
}
