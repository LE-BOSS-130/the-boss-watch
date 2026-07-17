/**
 * Seed demo users + a household Task Group for local testing.
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const joe = await prisma.user.upsert({
    where: { email: "joe@pact.local" },
    update: {},
    create: {
      email: "joe@pact.local",
      name: "Joe",
      passwordHash,
    },
  });

  const matthew = await prisma.user.upsert({
    where: { email: "matthew@pact.local" },
    update: {},
    create: {
      email: "matthew@pact.local",
      name: "Matthew",
      passwordHash,
    },
  });

  const sam = await prisma.user.upsert({
    where: { email: "sam@pact.local" },
    update: {},
    create: {
      email: "sam@pact.local",
      name: "Sam",
      passwordHash,
    },
  });

  // Clear previous demo group with same code if re-seeding
  const existing = await prisma.taskGroup.findUnique({ where: { inviteCode: "HOUSEHOLD" } });
  if (existing) {
    await prisma.taskGroup.delete({ where: { id: existing.id } });
  }

  const tomorrow7 = new Date();
  tomorrow7.setDate(tomorrow7.getDate() + 1);
  tomorrow7.setHours(7, 0, 0, 0);

  const remind = new Date(tomorrow7.getTime() - 12 * 60 * 60 * 1000);

  const group = await prisma.taskGroup.create({
    data: {
      name: "Household",
      description: "Shared home responsibilities — demo group",
      inviteCode: "HOUSEHOLD",
      ownerId: joe.id,
      members: {
        create: [
          { userId: joe.id, role: "OWNER" },
          { userId: matthew.id, role: "MEMBER" },
          { userId: sam.id, role: "COORDINATOR" },
        ],
      },
      rules: {
        create: {
          name: "Default escalation",
          ruleText:
            "If primary has not accepted 2 hours before deadline, contact backup. Notify coordinator if still open at deadline.",
        },
      },
      tasks: {
        create: {
          title: "Garbage collection — Thursday morning",
          description: "Bins must be outside before 7:00 a.m. Joe primary, Matthew backup.",
          creatorId: joe.id,
          status: "REMINDED",
          priority: "HIGH",
          dueAt: tomorrow7,
          remindAt: remind,
          primaryUserId: joe.id,
          backupUserId: matthew.id,
          verificationType: "CHECKBOX",
          escalationStage: 1,
          locationHint: "Curb",
          assignments: {
            create: [
              { userId: joe.id, role: "PRIMARY", commitment: "PENDING" },
              { userId: matthew.id, role: "BACKUP", commitment: "PENDING" },
            ],
          },
          actions: {
            create: {
              userId: joe.id,
              type: "CREATED",
              payload: "seed",
            },
          },
        },
      },
    },
  });

  // Second task: pickup
  const pickup = new Date();
  pickup.setHours(pickup.getHours() + 4);
  await prisma.task.create({
    data: {
      groupId: group.id,
      creatorId: sam.id,
      title: "Pick up Emma from school",
      description: "Leave by 3:10 if driving from home.",
      status: "UPCOMING",
      priority: "URGENT",
      dueAt: pickup,
      primaryUserId: null,
      verificationType: "NOTE",
      assignments: { create: [] },
      actions: {
        create: { userId: sam.id, type: "CREATED" },
      },
    },
  });

  console.log("Seeded demo data:");
  console.log("  joe@pact.local / password123 (Owner)");
  console.log("  matthew@pact.local / password123 (Member)");
  console.log("  sam@pact.local / password123 (Coordinator)");
  console.log("  Invite code: HOUSEHOLD");
  console.log("  Group:", group.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
