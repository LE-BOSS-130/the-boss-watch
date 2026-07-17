import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { inviteCode } from "@/lib/utils";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(128),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = schema.parse(body);
    const email = data.email.toLowerCase().trim();
    const name = data.name.trim();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: { name, email, passwordHash },
      select: { id: true, name: true, email: true },
    });

    // Starter group so a brand-new account immediately has a place to work
    const group = await prisma.taskGroup.create({
      data: {
        name: `${name}'s group`,
        description:
          "Your first Task Group. Share the invite code so others can join and share the same AI.",
        inviteCode: inviteCode(),
        ownerId: user.id,
        members: {
          create: { userId: user.id, role: "OWNER" },
        },
        rules: {
          create: {
            name: "Default escalation",
            ruleText:
              "If primary has not accepted 2 hours before deadline, contact backup. Notify coordinator if still open at deadline.",
          },
        },
      },
      select: { id: true, name: true, inviteCode: true },
    });

    return NextResponse.json({ user, group });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    console.error("Registration failed:", e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
