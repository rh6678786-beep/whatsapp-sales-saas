import { z } from "zod";
export const addTeamMemberSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["admin", "manager", "agent", "viewer"]),
  password: z.string().min(6).optional(),
});
export const updateTeamMemberSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["admin", "manager", "agent", "viewer"]).optional(),
  isActive: z.boolean().optional(),
});
