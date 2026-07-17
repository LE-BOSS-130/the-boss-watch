import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireMember } from "@/lib/permissions";
import { chatWithGroupAI } from "@/lib/ai";
import { z } from "zod";

const schema = z.object({
  message: z.string().min(1).max(4000),
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
  try {
    await requireMember(groupId, session.user.id);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = schema.parse(await req.json());
    const result = await chatWithGroupAI({
      groupId,
      userId: session.user.id,
      userName: session.user.name || "Member",
      message: body.message,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "AI request failed" }, { status: 500 });
  }
}
