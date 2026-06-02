import { hashPassword, comparePassword } from "./authService.js";
import { getTeamMemberByEmail, TeamMember } from "./roleService.js";
import { env } from "../lib/env.js";
import { createChildLogger } from "../lib/logger.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const log = createChildLogger("team-auth");

export interface TeamAuthPayload {
  adminId: string;
  memberId: string;
  role: TeamMember["role"];
  iat?: number;
  exp?: number;
}

const TEAM_TOKEN_EXPIRY = "1h"; // Team tokens are short-lived

export function generateTeamToken(adminId: string, memberId: string, role: TeamMember["role"]): string {
  return jwt.sign(
    { adminId, memberId, role, type: "team" } as TeamAuthPayload & { type: string },
    env.JWT_SECRET,
    {
      expiresIn: TEAM_TOKEN_EXPIRY,
      issuer: "saascloser",
      subject: memberId,
      jwtid: crypto.randomBytes(8).toString("hex"),
    }
  );
}

export function verifyTeamToken(token: string): TeamAuthPayload | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: "saascloser" }) as any;
    if (payload.type !== "team") return null;
    return {
      adminId: payload.adminId,
      memberId: payload.memberId,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export { hashPassword, comparePassword };

export async function teamLogin(
  email: string,
  password: string
): Promise<{ token: string; member: TeamMember; adminId: string } | null> {
  const result = await getTeamMemberByEmail(email);
  if (!result) {
    // Use constant-time to prevent enumeration
    await comparePassword(password, "$2b$12$" + "a".repeat(53));
    return null;
  }

  const { adminId, member } = result;

  if (!member.isActive) {
    await comparePassword(password, "$2b$12$" + "a".repeat(53));
    return null;
  }

  if (!member.passwordHash) {
    await comparePassword(password, "$2b$12$" + "a".repeat(53));
    return null;
  }

  const valid = await comparePassword(password, member.passwordHash);
  if (!valid) return null;

  const token = generateTeamToken(adminId, member.id, member.role);
  log.info({ adminId, memberId: member.id, role: member.role }, "Team member logged in");
  return { token, member, adminId };
}
