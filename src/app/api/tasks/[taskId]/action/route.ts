import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { escalateTask } from "@/lib/escalation";
import { z } from "zod";

const schema = z.object({
  type: z.enum([
    "ACCEPT",
    "DECLINE",
    "HELP",
    "SNOOZE",
    "COMPLETE",
    "REASSIGN",
    "NOTE",
    "ESCALATE",
  ]),
  reason: z.string().max(500).optional(),
  reassignUserId: z.string().optional(),
  note: z.string().max(1000).optional(),
  snoozeUntil: z.string().datetime().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId } = await params;
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignments: true },
  });
  if (!task) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: task.groupId, userId: session.user.id } },
  });
  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());
    const userId = session.user.id;

    switch (body.type) {
      case "ACCEPT": {
        await prisma.taskAssignment.upsert({
          where: { taskId_userId: { taskId, userId } },
          create: { taskId, userId, role: "PRIMARY", commitment: "ACCEPTED" },
          update: { commitment: "ACCEPTED", reason: body.reason },
        });
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "ACCEPTED", primaryUserId: userId },
        });
        await prisma.taskAction.create({
          data: { taskId, userId, type: "ACCEPTED", payload: body.reason },
        });
        break;
      }
      case "DECLINE": {
        await prisma.taskAssignment.upsert({
          where: { taskId_userId: { taskId, userId } },
          create: {
            taskId,
            userId,
            role: "PRIMARY",
            commitment: "DECLINED",
            reason: body.reason,
          },
          update: { commitment: "DECLINED", reason: body.reason },
        });
        await prisma.taskAction.create({
          data: { taskId, userId, type: "DECLINED", payload: body.reason },
        });
        // Auto-escalate to backup when primary declines
        if (task.backupUserId && task.backupUserId !== userId) {
          await escalateTask(taskId);
        }
        break;
      }
      case "HELP": {
        await prisma.taskAssignment.upsert({
          where: { taskId_userId: { taskId, userId } },
          create: {
            taskId,
            userId,
            role: "HELPER",
            commitment: "HELP_REQUESTED",
            reason: body.reason,
          },
          update: { commitment: "HELP_REQUESTED", reason: body.reason },
        });
        await prisma.taskAction.create({
          data: { taskId, userId, type: "HELP", payload: body.reason },
        });
        break;
      }
      case "SNOOZE": {
        await prisma.taskAssignment.upsert({
          where: { taskId_userId: { taskId, userId } },
          create: {
            taskId,
            userId,
            role: "PRIMARY",
            commitment: "SNOOZED",
            reason: body.reason,
          },
          update: { commitment: "SNOOZED", reason: body.reason },
        });
        if (body.snoozeUntil) {
          await prisma.task.update({
            where: { id: taskId },
            data: { remindAt: new Date(body.snoozeUntil) },
          });
        }
        await prisma.taskAction.create({
          data: {
            taskId,
            userId,
            type: "SNOOZE",
            payload: JSON.stringify({ reason: body.reason, until: body.snoozeUntil }),
          },
        });
        break;
      }
      case "COMPLETE": {
        await prisma.task.update({
          where: { id: taskId },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        await prisma.taskAssignment.updateMany({
          where: { taskId, userId },
          data: { commitment: "COMPLETED" },
        });
        await prisma.taskAction.create({
          data: {
            taskId,
            userId,
            type: "COMPLETE",
            payload: body.note ?? body.reason,
          },
        });
        break;
      }
      case "REASSIGN": {
        if (!body.reassignUserId) {
          return NextResponse.json({ error: "reassignUserId required" }, { status: 400 });
        }
        await prisma.taskAssignment.updateMany({
          where: { taskId, userId },
          data: { commitment: "REASSIGNED" },
        });
        await prisma.taskAssignment.upsert({
          where: {
            taskId_userId: { taskId, userId: body.reassignUserId },
          },
          create: {
            taskId,
            userId: body.reassignUserId,
            role: "PRIMARY",
            commitment: "PENDING",
          },
          update: { role: "PRIMARY", commitment: "PENDING" },
        });
        await prisma.task.update({
          where: { id: taskId },
          data: { primaryUserId: body.reassignUserId, status: "UPCOMING" },
        });
        await prisma.taskAction.create({
          data: {
            taskId,
            userId,
            type: "REASSIGN",
            payload: JSON.stringify({ to: body.reassignUserId, reason: body.reason }),
          },
        });
        break;
      }
      case "NOTE": {
        await prisma.taskAction.create({
          data: {
            taskId,
            userId,
            type: "NOTE",
            payload: body.note ?? body.reason,
          },
        });
        if (body.note) {
          await prisma.task.update({
            where: { id: taskId },
            data: {
              notes: task.notes ? `${task.notes}\n${body.note}` : body.note,
            },
          });
        }
        break;
      }
      case "ESCALATE": {
        const msg = await escalateTask(taskId);
        return NextResponse.json({ ok: true, message: msg });
      }
    }

    const updated = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignments: { include: { user: { select: { id: true, name: true } } } },
        actions: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { user: { select: { name: true } } },
        },
      },
    });

    return NextResponse.json({ task: updated });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Action failed" }, { status: 500 });
  }
}
