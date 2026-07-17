import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { inviteCode } from "@/lib/utils";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await prisma.groupMember.findMany({
    where: { userId: session.user.id },
    include: {
      group: {
        include: {
          _count: { select: { members: true, tasks: true } },
          tasks: {
            where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return NextResponse.json({
    groups: memberships.map((m) => ({
      id: m.group.id,
      name: m.group.name,
      description: m.group.description,
      inviteCode: m.group.inviteCode,
      role: m.role,
      memberCount: m.group._count.members,
      openTasks: m.group.tasks.length,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = createSchema.parse(await req.json());
    const group = await prisma.taskGroup.create({
      data: {
        name: body.name,
        description: body.description,
        inviteCode: inviteCode(),
        ownerId: session.user.id,
        members: {
          create: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
        rules: {
          create: {
            name: "Default escalation",
            ruleText:
              "If primary has not accepted 2 hours before deadline, contact backup. If still open at deadline, notify coordinator.",
          },
        },
      },
    });

    return NextResponse.json({ group });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
  }
}
