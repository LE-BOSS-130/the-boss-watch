import { prisma } from "./db";

export type MemberRole = "OWNER" | "COORDINATOR" | "MEMBER" | "DEPENDENT" | "GUEST";

const RANK: Record<MemberRole, number> = {
  OWNER: 50,
  COORDINATOR: 40,
  MEMBER: 30,
  DEPENDENT: 20,
  GUEST: 10,
};

export async function getMembership(groupId: string, userId: string) {
  return prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
}

export async function requireMember(groupId: string, userId: string) {
  const m = await getMembership(groupId, userId);
  if (!m) throw new Error("Not a member of this group");
  return m;
}

export function canManageTasks(role: string) {
  return RANK[(role as MemberRole) || "GUEST"] >= RANK.MEMBER;
}

export function canCoordinate(role: string) {
  return RANK[(role as MemberRole) || "GUEST"] >= RANK.COORDINATOR;
}

export function canAdminGroup(role: string) {
  return role === "OWNER";
}
