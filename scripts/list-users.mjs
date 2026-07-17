const { PrismaClient } = require("@prisma/client");
async function list(label, url) {
  if (url) process.env.DATABASE_URL = url;
  const p = new PrismaClient();
  try {
    const users = await p.user.findMany({
      select: { email: true, name: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const groups = await p.taskGroup.findMany({
      select: { name: true, inviteCode: true, _count: { select: { members: true, tasks: true } } },
    });
    console.log("\n== " + label + " ==");
    console.log("Users:", JSON.stringify(users, null, 2));
    console.log("Groups:", JSON.stringify(groups, null, 2));
  } catch (e) {
    console.log("\n== " + label + " ERROR ==", e.message);
  } finally {
    await p.$disconnect();
  }
}
(async () => {
  await list("project prisma/dev.db", "file:./prisma/dev.db");
  await list(
    "desktop userData",
    "file:C:/Users/josep/AppData/Roaming/THE BOSS Watch/data/boss-watch.db"
  );
})();
