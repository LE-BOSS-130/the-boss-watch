import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireMember } from "@/lib/permissions";
import { runGroupScheduler } from "@/lib/escalation";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId } = await params;
  try {
    await requireMember(groupId, session.user.id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const schedulerNotes = await runGroupScheduler(groupId);

  const group = await prisma.taskGroup.findUnique({
    where: { id: groupId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: "asc" },
      },
      tasks: {
        include: {
          assignments: {
            include: { user: { select: { id: true, name: true } } },
          },
          actions: {
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { user: { select: { name: true } } },
          },
        },
        orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      },
      rules: { where: { active: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const me = group.members.find((m) => m.userId === session.user.id);

  return NextResponse.json({
    group: {
      ...group,
      messages: group.messages.reverse(),
    },
    myRole: me?.role,
    schedulerNotes,
  });
}
