import jwt from "jsonwebtoken";
import { hashPassword, comparePassword } from "./authService.js";
import { getTeamMemberByEmail, TeamMember } from "./roleService.js";

const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET environment variable is required in production");
  }
  return "dev-secret-change-in-production";
})();
const TOKEN_EXPIRY = "24h";

export interface TeamAuthPayload {
  adminId: string;
  memberId: string;
  role: TeamMember["role"];
}

export function generateTeamToken(adminId: string, memberId: string, role: TeamMember["role"]): string {
  return jwt.sign({ adminId, memberId, role, type: "team" }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyTeamToken(token: string): TeamAuthPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    if (payload.type !== "team") return null;
    return { adminId: payload.adminId, memberId: payload.memberId, role: payload.role };
  } catch {
    return null;
  }
}

export { hashPassword, comparePassword };

export async function teamLogin(email: string, password: string): Promise<{ token: string; member: TeamMember; adminId: string } | null> {
  const result = await getTeamMemberByEmail(email);
  if (!result) return null;
  const { adminId, member } = result;
  if (!member.isActive) return null;
  if (!member.passwordHash) return null;
  const valid = await comparePassword(password, member.passwordHash);
  if (!valid) return null;
  const token = generateTeamToken(adminId, member.id, member.role);
  return { token, member, adminId };
}
