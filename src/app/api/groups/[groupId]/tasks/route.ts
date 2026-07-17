import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireMember, canManageTasks } from "@/lib/permissions";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  dueAt: z.string().datetime().optional().nullable(),
  remindAt: z.string().datetime().optional().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  primaryUserId: z.string().optional().nullable(),
  backupUserId: z.string().optional().nullable(),
  recurrenceRule: z.string().optional().nullable(),
  verificationType: z
    .enum(["CHECKBOX", "PHOTO", "LOCATION", "APPROVAL", "NOTE", "RECEIPT", "TIMER"])
    .optional(),
  locationHint: z.string().optional().nullable(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId } = await params;
  let membership;
  try {
    membership = await requireMember(groupId, session.user.id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!canManageTasks(membership.role)) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());
    const task = await prisma.task.create({
      data: {
        groupId,
        creatorId: session.user.id,
        title: body.title,
        description: body.description,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
        remindAt: body.remindAt ? new Date(body.remindAt) : null,
        priority: body.priority ?? "NORMAL",
        primaryUserId: body.primaryUserId ?? null,
        backupUserId: body.backupUserId ?? null,
        recurrenceRule: body.recurrenceRule ?? null,
        verificationType: body.verificationType ?? "CHECKBOX",
        locationHint: body.locationHint ?? null,
        status: "UPCOMING",
        assignments: {
          create: [
            ...(body.primaryUserId
              ? [
                  {
                    userId: body.primaryUserId,
                    role: "PRIMARY",
                    commitment: "PENDING",
                  },
                ]
              : []),
            ...(body.backupUserId && body.backupUserId !== body.primaryUserId
              ? [
                  {
                    userId: body.backupUserId,
                    role: "BACKUP",
                    commitment: "PENDING",
                  },
                ]
              : []),
          ],
        },
        actions: {
          create: {
            userId: session.user.id,
            type: "CREATED",
          },
        },
      },
      include: {
        assignments: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    return NextResponse.json({ task });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}
