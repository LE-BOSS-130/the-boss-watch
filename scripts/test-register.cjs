const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
process.env.DATABASE_URL = "file:C:/Users/josep/Projects/the-boss-watch/prisma/dev.db";
const p = new PrismaClient();
(async () => {
  const email = "owner@example.com";
  const existing = await p.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Already exists:", existing.email, existing.name);
  } else {
    const passwordHash = await bcrypt.hash("password123", 10);
    const user = await p.user.create({
      data: { name: "Owner", email, passwordHash },
    });
    console.log("Created:", user.email);
  }
  const users = await p.user.findMany({ select: { email: true, name: true } });
  console.log(users);
  await p.$disconnect();
})();
