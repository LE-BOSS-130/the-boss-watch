import OpenAI from "openai";
import { prisma } from "./db";

const MODEL = "grok-4.5";

function client() {
  const key = process.env.XAI_API_KEY;
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: "https://api.x.ai/v1",
  });
}

export type GroupContext = {
  groupId: string;
  groupName: string;
  members: { id: string; name: string; role: string; available: boolean }[];
  tasks: {
    id: string;
    title: string;
    status: string;
    dueAt: string | null;
    priority: string;
    assignees: string[];
    primary?: string | null;
    backup?: string | null;
  }[];
  rules: string[];
};

export async function buildGroupContext(groupId: string): Promise<GroupContext | null> {
  const group = await prisma.taskGroup.findUnique({
    where: { id: groupId },
    include: {
      members: { include: { user: true } },
      tasks: {
        where: { status: { notIn: ["CANCELLED"] } },
        include: {
          assignments: { include: { user: true } },
        },
        orderBy: { dueAt: "asc" },
        take: 40,
      },
      rules: { where: { active: true } },
    },
  });
  if (!group) return null;

  return {
    groupId: group.id,
    groupName: group.name,
    members: group.members.map((m) => ({
      id: m.userId,
      name: m.user.name,
      role: m.role,
      available: m.available,
    })),
    tasks: group.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      dueAt: t.dueAt?.toISOString() ?? null,
      priority: t.priority,
      assignees: t.assignments.map((a) => `${a.user.name} (${a.role}/${a.commitment})`),
      primary: t.primaryUserId,
      backup: t.backupUserId,
    })),
    rules: group.rules.map((r) => r.ruleText),
  };
}

function systemPrompt(ctx: GroupContext, userName: string): string {
  return `You are THE BOSS Watch — the shared group AI coordinator for "${ctx.groupName}".
You are ONE persistent assistant for the whole group, not a private chatbot.
Current speaker: ${userName}.
Current time: ${new Date().toISOString()}.

Your job:
- Coordinate shared responsibilities across members
- Create/update tasks from natural language
- Suggest fair assignments based on workload, role, and availability
- Escalate when deadlines approach and no one has accepted
- Give daily briefings and answer "who is doing X?"
- Detect missing ownership and negotiate schedules
- Recommend earlier reminders when tasks are often late

Member roles: Owner, Coordinator, Member, Dependent, Guest.
Task lifecycle: Upcoming → Reminder → Accepted → Deadline approaching → Backup contacted → Coordinator notified → Overdue → Reschedule/reassign.

GROUP MEMBERS:
${ctx.members.map((m) => `- ${m.name} [${m.role}] available=${m.available} id=${m.id}`).join("\n")}

ACTIVE / RECENT TASKS:
${
  ctx.tasks.length
    ? ctx.tasks
        .map(
          (t) =>
            `- [${t.status}] ${t.title} | due=${t.dueAt ?? "none"} | pri=${t.priority} | ${t.assignees.join(", ") || "unassigned"} | id=${t.id}`
        )
        .join("\n")
    : "(no tasks yet)"
}

GROUP RULES:
${ctx.rules.length ? ctx.rules.map((r) => `- ${r}`).join("\n") : "(none)"}

When the user wants to create or change tasks, respond with helpful natural language AND include a machine-readable JSON block at the end:

\`\`\`boss-actions
{ "actions": [ ... ] }
\`\`\`

Supported actions:
1. create_task: { "type":"create_task", "title":"...", "description":"...", "dueAt":"ISO or null", "remindAt":"ISO or null", "priority":"LOW|NORMAL|HIGH|URGENT", "primaryName":"member name or null", "backupName":"member name or null", "recurrenceRule":"text or null", "verificationType":"CHECKBOX|PHOTO|NOTE|APPROVAL" }
2. update_task_status: { "type":"update_task_status", "taskId":"...", "status":"..." }
3. assign_task: { "type":"assign_task", "taskId":"...", "userName":"...", "role":"PRIMARY|BACKUP" }
4. escalate_task: { "type":"escalate_task", "taskId":"..." }
5. add_rule: { "type":"add_rule", "name":"...", "ruleText":"..." }

If no structural change is needed, omit the boss-actions block.
Be concise, practical, and group-aware. Prefer suggesting backups and confirmations over nagging.`;
}

export type BossAction =
  | {
      type: "create_task";
      title: string;
      description?: string;
      dueAt?: string | null;
      remindAt?: string | null;
      priority?: string;
      primaryName?: string | null;
      backupName?: string | null;
      recurrenceRule?: string | null;
      verificationType?: string;
    }
  | { type: "update_task_status"; taskId: string; status: string }
  | { type: "assign_task"; taskId: string; userName: string; role?: string }
  | { type: "escalate_task"; taskId: string }
  | { type: "add_rule"; name: string; ruleText: string };

export function parseBossActions(text: string): { clean: string; actions: BossAction[] } {
  const match = text.match(/```(?:boss-actions|pact-actions)\s*([\s\S]*?)```/i);
  if (!match) return { clean: text.trim(), actions: [] };
  try {
    const json = JSON.parse(match[1].trim());
    const actions = Array.isArray(json.actions) ? json.actions : [];
    const clean = text.replace(match[0], "").trim();
    return { clean, actions };
  } catch {
    return { clean: text.trim(), actions: [] };
  }
}

export async function applyBossActions(
  groupId: string,
  userId: string,
  actions: BossAction[]
): Promise<string[]> {
  const results: string[] = [];
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true },
  });
  const byName = (name: string) =>
    members.find((m) => m.user.name.toLowerCase() === name.toLowerCase())?.user;

  for (const action of actions) {
    try {
      if (action.type === "create_task") {
        const primary = action.primaryName ? byName(action.primaryName) : null;
        const backupUser = action.backupName ? byName(action.backupName) : null;

        const task = await prisma.task.create({
          data: {
            groupId,
            creatorId: userId,
            title: action.title,
            description: action.description ?? null,
            dueAt: action.dueAt ? new Date(action.dueAt) : null,
            remindAt: action.remindAt ? new Date(action.remindAt) : null,
            priority: action.priority || "NORMAL",
            primaryUserId: primary?.id ?? null,
            backupUserId: backupUser?.id ?? null,
            recurrenceRule: action.recurrenceRule ?? null,
            verificationType: action.verificationType || "CHECKBOX",
            status: "UPCOMING",
            assignments: {
              create: [
                ...(primary
                  ? [{ userId: primary.id, role: "PRIMARY", commitment: "PENDING" }]
                  : []),
                ...(backupUser && backupUser.id !== primary?.id
                  ? [
                      {
                        userId: backupUser.id,
                        role: "BACKUP",
                        commitment: "PENDING",
                      },
                    ]
                  : []),
              ],
            },
            actions: {
              create: { userId, type: "AI", payload: JSON.stringify({ source: "create_task" }) },
            },
          },
        });
        results.push(`Created task “${task.title}”`);
      } else if (action.type === "update_task_status") {
        await prisma.task.update({
          where: { id: action.taskId },
          data: {
            status: action.status,
            completedAt: action.status === "COMPLETED" ? new Date() : undefined,
          },
        });
        results.push(`Updated task status to ${action.status}`);
      } else if (action.type === "assign_task") {
        const user = byName(action.userName);
        if (!user) {
          results.push(`Could not find member ${action.userName}`);
          continue;
        }
        const assignRole = action.role || "PRIMARY";
        await prisma.taskAssignment.upsert({
          where: { taskId_userId: { taskId: action.taskId, userId: user.id } },
          create: {
            taskId: action.taskId,
            userId: user.id,
            role: assignRole,
            commitment: "PENDING",
          },
          update: {
            role: assignRole,
            commitment: "PENDING",
          },
        });
        if (assignRole === "PRIMARY") {
          await prisma.task.update({
            where: { id: action.taskId },
            data: { primaryUserId: user.id },
          });
        } else if (assignRole === "BACKUP") {
          await prisma.task.update({
            where: { id: action.taskId },
            data: { backupUserId: user.id },
          });
        }
        results.push(`Assigned ${user.name} as ${action.role || "PRIMARY"}`);
      } else if (action.type === "escalate_task") {
        const { escalateTask } = await import("./escalation");
        const msg = await escalateTask(action.taskId);
        results.push(msg);
      } else if (action.type === "add_rule") {
        await prisma.groupRule.create({
          data: { groupId, name: action.name, ruleText: action.ruleText },
        });
        results.push(`Added rule “${action.name}”`);
      }
    } catch (e) {
      results.push(`Action failed: ${action.type} (${e instanceof Error ? e.message : "error"})`);
    }
  }
  return results;
}

export async function chatWithGroupAI(opts: {
  groupId: string;
  userId: string;
  userName: string;
  message: string;
}): Promise<{ reply: string; applied: string[] }> {
  const ctx = await buildGroupContext(opts.groupId);
  if (!ctx) return { reply: "Group not found.", applied: [] };

  await prisma.conversationMessage.create({
    data: {
      groupId: opts.groupId,
      userId: opts.userId,
      role: "user",
      content: opts.message,
    },
  });

  const history = await prisma.conversationMessage.findMany({
    where: { groupId: opts.groupId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  history.reverse();

  const ai = client();
  let raw: string;

  if (!ai) {
    raw = localFallback(opts.message, ctx, opts.userName);
  } else {
    try {
      const completion = await ai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt(ctx, opts.userName) },
          ...history.map((h) => ({
            role: (h.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
            content: h.content,
          })),
        ],
        temperature: 0.4,
      });
      raw = completion.choices[0]?.message?.content ?? "I couldn't generate a reply.";
    } catch (e) {
      console.error("AI error", e);
      raw = localFallback(opts.message, ctx, opts.userName);
    }
  }

  const { clean, actions } = parseBossActions(raw);
  const applied = await applyBossActions(opts.groupId, opts.userId, actions);
  const reply =
    applied.length > 0
      ? `${clean}\n\n_Applied: ${applied.join("; ")}_`
      : clean;

  await prisma.conversationMessage.create({
    data: {
      groupId: opts.groupId,
      userId: null,
      role: "assistant",
      content: reply,
    },
  });

  return { reply, applied };
}

function localFallback(message: string, ctx: GroupContext, userName: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("briefing") || lower.includes("today") || lower.includes("summary")) {
    const open = ctx.tasks.filter((t) => !["COMPLETED", "CANCELLED"].includes(t.status));
    const mine = open.filter((t) => t.assignees.some((a) => a.toLowerCase().includes(userName.toLowerCase())));
    const unassigned = open.filter((t) => t.assignees.length === 0);
    return `Daily briefing for ${ctx.groupName}:\n• ${open.length} open tasks\n• ${mine.length} involving you (${userName})\n• ${unassigned.length} still need an owner\n\n${open
      .slice(0, 8)
      .map((t) => `– [${t.status}] ${t.title}${t.dueAt ? ` · due ${t.dueAt}` : ""}`)
      .join("\n") || "No open tasks."}\n\n(Tip: set XAI_API_KEY for full AI coordination.)`;
  }

  if (lower.includes("who") && (lower.includes("pick") || lower.includes("doing") || lower.includes("handle"))) {
    const match = ctx.tasks.find((t) =>
      lower.split(" ").some((w) => w.length > 3 && t.title.toLowerCase().includes(w))
    );
    if (match) {
      return match.assignees.length
        ? `For “${match.title}”: ${match.assignees.join(", ")} · status ${match.status}.`
        : `Nobody has accepted “${match.title}” yet. Should I ask available members?`;
    }
    return `I couldn't match that to a task. Open tasks:\n${ctx.tasks
      .filter((t) => t.status !== "COMPLETED")
      .map((t) => `– ${t.title}`)
      .join("\n")}`;
  }

  // Simple create: "remind X to Y"
  const createMatch =
    message.match(/remind (.+?) to (.+?)(?:\s+by\s+(.+))?$/i) ||
    message.match(/create (?:a )?task[:\s]+(.+)/i) ||
    message.match(/every .+ remind .+/i);

  if (createMatch || lower.includes("remind") || lower.includes("create task") || lower.startsWith("add ")) {
    const title =
      createMatch?.[2]?.trim() ||
      createMatch?.[1]?.trim() ||
      message.replace(/^(please\s+)?(add|create|remind)\s+/i, "").trim() ||
      message;
    const primaryName =
      createMatch?.[1] && createMatch?.[2] ? createMatch[1].trim() : null;

    return `I'll create that as a coordinated task for the group.\n\n\`\`\`boss-actions\n${JSON.stringify(
      {
        actions: [
          {
            type: "create_task",
            title: title.slice(0, 120),
            description: message,
            primaryName,
            priority: "NORMAL",
            verificationType: "CHECKBOX",
          },
        ],
      },
      null,
      2
    )}\n\`\`\``;
  }

  return `I'm THE BOSS Watch, your group coordinator for ${ctx.groupName}. I can create shared tasks, assign primaries/backups, escalate, and brief the team.\n\nTry:\n• "Every Friday remind whoever is home to put recycling out before 7"\n• "Who is picking up Emma?"\n• "Daily briefing"\n\n${ctx.tasks.filter((t) => t.status !== "COMPLETED").length} open tasks · ${ctx.members.length} members.\n\n(Set XAI_API_KEY for full natural-language intelligence.)`;
}
