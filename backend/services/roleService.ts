import { v4 as uuidv4 } from "uuid";
import { dbService } from "./dbService.js";

export interface TeamMember {
  id: string;
  adminId: string;
  name: string;
  email: string;
  role: "admin" | "manager" | "agent" | "viewer";
  isActive: boolean;
  createdAt: string;
  passwordHash?: string;
}

type Permission = "read" | "write" | "delete" | "billing" | "settings" | "team";

const ROLE_PERMISSIONS: Record<TeamMember["role"], Permission[]> = {
  admin: ["read", "write", "delete", "billing", "settings", "team"],
  manager: ["read", "write"],
  agent: ["read", "write"],
  viewer: ["read"],
};

async function getMembers(adminId: string): Promise<TeamMember[]> {
  const settings = await dbService.getSettings(adminId);
  return settings.teamMembers ?? [];
}

async function saveMembers(adminId: string, members: TeamMember[]) {
  await dbService.updateSettings(adminId, { teamMembers: members });
}

export async function getTeamMembers(adminId: string): Promise<TeamMember[]> {
  return getMembers(adminId);
}

export async function addTeamMember(
  adminId: string,
  member: Omit<TeamMember, "id" | "adminId" | "createdAt" | "isActive" | "passwordHash"> & { passwordHash?: string }
): Promise<TeamMember> {
  const members = await getMembers(adminId);
  const exists = members.find(
    (m) => m.email.toLowerCase() === member.email.toLowerCase()
  );
  if (exists) {
    throw new Error("A team member with this email already exists");
  }

  const newMember: TeamMember = {
    id: uuidv4(),
    adminId,
    name: member.name,
    email: member.email,
    role: member.role,
    isActive: true,
    createdAt: new Date().toISOString(),
    passwordHash: member.passwordHash,
  };

  members.push(newMember);
  await saveMembers(adminId, members);
  return newMember;
}

export async function removeTeamMember(adminId: string, memberId: string): Promise<void> {
  let members = await getMembers(adminId);
  const idx = members.findIndex((m) => m.id === memberId);
  if (idx === -1) {
    throw new Error("Team member not found");
  }
  members.splice(idx, 1);
  await saveMembers(adminId, members);
}

export async function updateTeamMember(
  adminId: string,
  memberId: string,
  updates: Partial<Pick<TeamMember, "name" | "role" | "isActive" | "passwordHash">>
): Promise<TeamMember> {
  const members = await getMembers(adminId);
  const member = members.find((m) => m.id === memberId);
  if (!member) {
    throw new Error("Team member not found");
  }
  if (updates.name !== undefined) member.name = updates.name;
  if (updates.role !== undefined) member.role = updates.role;
  if (updates.isActive !== undefined) member.isActive = updates.isActive;
  if (updates.passwordHash !== undefined) member.passwordHash = updates.passwordHash;
  await saveMembers(adminId, members);
  return member;
}

export async function getTeamMemberByEmail(email: string): Promise<{ adminId: string; member: TeamMember } | null> {
  const { dbService } = await import("./dbService.js");
  const adminIds = await dbService.getAllAdminIds();
  for (const adminId of adminIds) {
    const members = await getMembers(adminId);
    const member = members.find((m) => m.email.toLowerCase() === email.toLowerCase());
    if (member) return { adminId, member };
  }
  return null;
}

export async function updateTeamMemberPassword(adminId: string, memberId: string, passwordHash: string): Promise<void> {
  const members = await getMembers(adminId);
  const member = members.find((m) => m.id === memberId);
  if (!member) throw new Error("Team member not found");
  member.passwordHash = passwordHash;
  await saveMembers(adminId, members);
}

export async function hasPermission(
  adminId: string,
  memberId: string,
  permission: Permission
): Promise<boolean> {
  const members = await getMembers(adminId);
  const member = members.find((m) => m.id === memberId);
  if (!member) return false;
  if (!member.isActive) return false;
  const perms = ROLE_PERMISSIONS[member.role] ?? [];
  return perms.includes(permission);
}
