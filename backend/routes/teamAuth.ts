import { Router } from "express";
import { teamLogin } from "../services/teamAuthService.js";
import { dbService } from "../services/dbService.js";
import { generateToken, comparePassword } from "../services/authService.js";

const router = Router();

router.post("/team/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    const result = await teamLogin(email, password);
    if (!result) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const { token, member, adminId } = result;
    res.json({ success: true, token, member, adminId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/team/login/admin", async (req, res) => {
  try {
    const { adminId, password } = req.body;
    if (!adminId || !password) {
      return res.status(400).json({ error: "adminId and password are required" });
    }
    const hash = await dbService.getAdminPasswordHash(adminId);
    if (!hash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const valid = await comparePassword(password, hash);
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

export default router;
