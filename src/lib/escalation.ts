import { prisma } from "./db";

const STAGES = [
  "UPCOMING",
  "REMINDED",
  "ACCEPTED",
  "DEADLINE_APPROACHING",
  "BACKUP_CONTACTED",
  "COORDINATOR_NOTIFIED",
  "OVERDUE",
];

/**
 * Move a task one step through the shared escalation ladder.
 * Not a dumb re-alarm — contacts backup / coordinator as stage advances.
 */
export async function escalateTask(taskId: string): Promise<string> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignments: { include: { user: true } },
      group: { include: { members: { include: { user: true } } } },
    },
  });
  if (!task) return "Task not found";
  if (task.status === "COMPLETED" || task.status === "CANCELLED") {
    return `Task is already ${task.status}`;
  }

  const stage = Math.min(task.escalationStage + 1, STAGES.length - 1);
  let status: string = STAGES[stage];
  const notes: string[] = [];

  // If primary never accepted and we're past remind → contact backup
  const primary = task.assignments.find((a) => a.role === "PRIMARY");
  const backup = task.assignments.find((a) => a.role === "BACKUP");

  if (stage >= 3 && primary && primary.commitment === "PENDING" && backup) {
    status = "BACKUP_CONTACTED";
    notes.push(
      `${primary.user.name} has not confirmed. ${backup.user.name} (backup) is being contacted.`
    );
  }

  if (stage >= 5) {
    const coord = task.group.members.find(
      (m) => m.role === "COORDINATOR" || m.role === "OWNER"
    );
    status = "COORDINATOR_NOTIFIED";
    if (coord) {
      notes.push(`Group coordinator ${coord.user.name} notified.`);
    }
  }

  if (task.dueAt && task.dueAt.getTime() < Date.now()) {
    status = "OVERDUE";
    notes.push("Past hard deadline — marked overdue.");
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      escalationStage: stage,
      status,
    },
  });

  await prisma.taskAction.create({
    data: {
      taskId,
      userId: task.creatorId,
      type: "ESCALATE",
      payload: JSON.stringify({ stage, status, notes }),
    },
  });

  return `Escalated “${task.title}” → ${status}${notes.length ? `. ${notes.join(" ")}` : ""}`;
}

/** Run lightweight scheduler checks for a group (call on dashboard load / cron). */
export async function runGroupScheduler(groupId: string): Promise<string[]> {
  const now = new Date();
  const soon = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2h
  const messages: string[] = [];

  const tasks = await prisma.task.findMany({
    where: {
      groupId,
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
    include: { assignments: true },
  });

  for (const task of tasks) {
    // Past due → overdue
    if (task.dueAt && task.dueAt < now && task.status !== "OVERDUE") {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "OVERDUE", escalationStage: Math.max(task.escalationStage, 6) },
      });
      messages.push(`“${task.title}” marked OVERDUE`);
      continue;
    }

    // Deadline approaching within 2h and not accepted
    if (
      task.dueAt &&
      task.dueAt <= soon &&
      task.dueAt > now &&
      !["ACCEPTED", "DEADLINE_APPROACHING", "BACKUP_CONTACTED", "COORDINATOR_NOTIFIED"].includes(
        task.status
      )
    ) {
      const accepted = task.assignments.some((a) => a.commitment === "ACCEPTED");
      if (!accepted) {
        await escalateTask(task.id);
        messages.push(`Escalated “${task.title}” (deadline approaching, unaccepted)`);
      } else if (task.status !== "DEADLINE_APPROACHING") {
        await prisma.task.update({
          where: { id: task.id },
          data: { status: "DEADLINE_APPROACHING" },
        });
        messages.push(`“${task.title}” deadline approaching`);
      }
    }

    // Reminder time passed
    if (
      task.remindAt &&
      task.remindAt <= now &&
      task.status === "UPCOMING"
    ) {
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "REMINDED", escalationStage: Math.max(task.escalationStage, 1) },
      });
      messages.push(`Reminder fired for “${task.title}”`);
    }
  }

  return messages;
}
