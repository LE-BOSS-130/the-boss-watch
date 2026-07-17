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

  await runGroupScheduler(groupId);

  const group = await prisma.taskGroup.findUnique({
    where: { id: groupId },
    include: {
      tasks: {
        where: { status: { notIn: ["CANCELLED"] } },
        include: {
          assignments: { include: { user: { select: { id: true, name: true } } } },
        },
      },
      members: { include: { user: { select: { name: true } } } },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const open = group.tasks.filter((t) => t.status !== "COMPLETED");
  const mine = open.filter(
    (t) =>
      t.primaryUserId === session.user.id ||
      t.assignments.some((a) => a.userId === session.user.id)
  );
  const acceptedByOthers = open.filter(
    (t) =>
      t.assignments.some((a) => a.commitment === "ACCEPTED" && a.userId !== session.user.id) &&
      !mine.includes(t)
  );
  const needOwner = open.filter(
    (t) =>
      t.assignments.length === 0 ||
      t.assignments.every((a) => a.commitment === "PENDING" || a.commitment === "DECLINED")
  );
  const overdue = open.filter((t) => t.status === "OVERDUE");

  const lines = [
    `The group “${group.name}” has ${open.length} open task${open.length === 1 ? "" : "s"} today.`,
    `${mine.length} assigned to you, ${acceptedByOthers.length} accepted by others, ${needOwner.length} still need someone.`,
  ];
  if (overdue.length) {
    lines.push(`${overdue.length} overdue — escalate or reassign soon.`);
  }

  return NextResponse.json({
    summary: lines.join(" "),
    counts: {
      open: open.length,
      mine: mine.length,
      acceptedByOthers: acceptedByOthers.length,
      needOwner: needOwner.length,
      overdue: overdue.length,
      members: group.members.length,
    },
    highlights: {
      mine: mine.map((t) => ({ id: t.id, title: t.title, status: t.status, dueAt: t.dueAt })),
      needOwner: needOwner.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueAt: t.dueAt,
      })),
      overdue: overdue.map((t) => ({ id: t.id, title: t.title, dueAt: t.dueAt })),
    },
  });
}
