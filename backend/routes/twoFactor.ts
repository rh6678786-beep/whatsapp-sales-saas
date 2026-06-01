import { Router } from "express";
import { AuthenticatedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { generateOTP, hashOTP, sendOTPEmail, storeOTP, verifyOTP } from "../services/twoFactorService.js";
import { dbService } from "../services/dbService.js";

const router = Router();

router.post("/auth/2fa/send", requireAuth, async (req: AuthenticatedRequest, res) => {
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
    await sendOTPEmail(email, otp, settings.storeName || "Sales Agent");

    res.json({
      success: true,
      message: "Verification code sent to your email",
      ...(process.env.NODE_ENV !== "production" ? { devOtp: otp } : {}),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/auth/2fa/verify", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const adminId = req.adminId!;
    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({ error: "OTP is required" });
    }
    const valid = await verifyOTP(adminId, otp);
    if (!valid) {
      return res.status(401).json({ error: "Invalid or expired verification code" });
    }
    const { generateToken } = await import("../services/authService.js");
    const token = generateToken(adminId);
    res.json({ success: true, token });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
