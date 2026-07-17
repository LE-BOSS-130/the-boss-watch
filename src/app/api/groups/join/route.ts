import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  inviteCode: z.string().min(4).max(16),
  role: z.enum(["MEMBER", "DEPENDENT", "GUEST"]).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = schema.parse(await req.json());
    const code = body.inviteCode.toUpperCase().replace(/\s/g, "");
    const group = await prisma.taskGroup.findUnique({ where: { inviteCode: code } });
    if (!group) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: session.user.id } },
    });
    if (existing) {
      return NextResponse.json({ group, alreadyMember: true });
    }

    await prisma.groupMember.create({
      data: {
        groupId: group.id,
        userId: session.user.id,
        role: body.role ?? "MEMBER",
      },
    });

    return NextResponse.json({ group });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Join failed" }, { status: 500 });
  }
}
