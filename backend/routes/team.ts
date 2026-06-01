import { Router } from "express";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import { hashPassword } from "../services/authService.js";
import {
  getTeamMembers,
  addTeamMember,
  removeTeamMember,
  updateTeamMember,
  updateTeamMemberPassword,
} from "../services/roleService.js";
import { validate } from "../middleware/validate.js";
import { addTeamMemberSchema, updateTeamMemberSchema } from "../schemas/team.js";

const router = Router();

router.use(requireAuth);

router.get("/team", async (req: AuthenticatedRequest, res) => {
  try {
    const members = await getTeamMembers(req.adminId!);
    res.json(members);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/team", validate(addTeamMemberSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, email, role, password } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ error: "name, email, and role are required" });
    }
    if (password && password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    if (!["admin", "manager", "agent", "viewer"].includes(role)) {
      return res.status(400).json({ error: "Invalid role. Must be admin, manager, agent, or viewer" });
    }
    const passwordHash = password ? await hashPassword(password) : undefined;
    const member = await addTeamMember(req.adminId!, { name, email, role, passwordHash });
    const { passwordHash: _, ...safeMember } = member;
    res.status(201).json(safeMember);
  } catch (error: any) {
    if (error.message.includes("already exists")) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete("/team/:memberId", async (req: AuthenticatedRequest, res) => {
  try {
    await removeTeamMember(req.adminId!, req.params.memberId);
    res.json({ success: true });
  } catch (error: any) {
    if (error.message === "Team member not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.patch("/team/:memberId", validate(updateTeamMemberSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, role, isActive } = req.body;
    if (role && !["admin", "manager", "agent", "viewer"].includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;
    const member = await updateTeamMember(req.adminId!, req.params.memberId, updates);
    const { passwordHash: _, ...safeMember } = member;
    res.json(safeMember);
  } catch (error: any) {
    if (error.message === "Team member not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

router.post("/team/:memberId/set-password", async (req: AuthenticatedRequest, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }
    const passwordHash = await hashPassword(password);
    await updateTeamMemberPassword(req.adminId!, req.params.memberId, passwordHash);
    res.json({ success: true });
  } catch (error: any) {
    if (error.message === "Team member not found") {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
