import { Router } from "express";
import { dbService } from "../services/dbService.js";
import { generateToken, hashPassword, comparePassword, validatePassword } from "../services/authService.js";
import { sendOtp, verifyOtp } from "../services/otpService.js";
import { startTrial } from "../services/stripeService.js";
import { getAdminId } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { signupSchema, loginSchema } from "../schemas/auth.js";

const router = Router();

router.post("/auth/send-otp", async (req, res) => {
  try {
    const { email, adminId, password, storeName, phone } = req.body;

    if (!email || !adminId || !password) {
      return res.status(400).json({ error: "email, adminId, and password are required" });
    }
    if (!email.toLowerCase().endsWith('@gmail.com')) {
      return res.status(400).json({ error: "For security reasons, only Gmail accounts are accepted for registration." });
    }
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.error });
    }

    const emailExists = await dbService.adminExistsByEmail(email);
    if (emailExists) {
      return res.status(409).json({ error: "This email is already registered. Use a different email or login." });
    }

    const idExists = await dbService.adminExists(adminId);
    if (idExists) {
      return res.status(409).json({ error: "This Store ID already exists." });
    }

    const result = await sendOtp(email, { adminId, password, storeName, phone });

    if (!result.success) {
      return res.status(500).json({ error: result.error || "Failed to send OTP" });
    }

    res.json({ success: true, message: "OTP sent to your email" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/auth/verify-otp", async (req, res) => {
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
    res.json({ success: true, token, adminId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/auth/register", validate(signupSchema), async (req, res) => {
  try {
    const { adminId, password, storeName } = req.body;
    if (!adminId || !password) {
      return res.status(400).json({ error: "adminId and password required" });
    }
    const pwCheck = validatePassword(password);
    if (!pwCheck.valid) {
      return res.status(400).json({ error: pwCheck.error });
    }

    const exists = await dbService.adminExists(adminId);
    if (exists) {
      return res.status(409).json({ error: "Admin ID already exists" });
    }

    const passwordHash = await hashPassword(password);
    await dbService.registerAdmin(adminId, passwordHash);

    const trial = startTrial();
    await dbService.updateSubscription(adminId, trial);

    if (storeName) {
      await dbService.updateSettings(adminId, { storeName });
    }

    const token = generateToken(adminId);
    res.json({ success: true, token, adminId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/auth/login", validate(loginSchema), async (req, res) => {
  try {
    const { adminId, password } = req.body;
    if (!adminId || !password) {
      return res.status(400).json({ error: "adminId and password required" });
    }

    const hash = await dbService.getAdminPasswordHash(adminId);
    const envPassword = process.env.ADMIN_PASSWORD || '';

    if (!hash) {
      if (envPassword && password !== envPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const newHash = await hashPassword(password);
      await dbService.registerAdmin(adminId, newHash);
      const token = generateToken(adminId);
      const settings = await dbService.getSettings(adminId);
      return res.json({ success: true, token, adminId, storeName: settings.storeName });
    }

    let valid = await comparePassword(password, hash);
    if (!valid && envPassword) {
      valid = password === envPassword;
      if (valid) {
        const newHash = await hashPassword(password);
        await dbService.registerAdmin(adminId, newHash);
      }
    }
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = generateToken(adminId);
    const settings = await dbService.getSettings(adminId);
    res.json({ success: true, token, adminId, storeName: settings.storeName });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/auth/change-password", async (req, res) => {
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
    if (hash) {
      const valid = await comparePassword(oldPassword, hash);
      if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
    } else {
      const envPassword = process.env.ADMIN_PASSWORD || '';
      if (!envPassword) return res.status(500).json({ error: "No admin configured. Set ADMIN_PASSWORD in .env" });
      if (oldPassword !== envPassword) return res.status(401).json({ error: "Current password is incorrect" });
    }

    const newHash = await hashPassword(newPassword);
    await dbService.registerAdmin(adminId, newHash);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
