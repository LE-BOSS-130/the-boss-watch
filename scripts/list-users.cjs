const { PrismaClient } = require("@prisma/client");
async function list(label, url) {
  process.env.DATABASE_URL = url;
  const p = new PrismaClient();
  try {
    const users = await p.user.findMany({
      select: { email: true, name: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    const groups = await p.taskGroup.findMany({
      select: { name: true, inviteCode: true },
    });
    console.log("\n== " + label + " ==");
    console.log(JSON.stringify({ users, groups }, null, 2));
  } catch (e) {
    console.log("\n== " + label + " ERROR ==", e.message);
  } finally {
    await p.$disconnect();
  }
}
(async () => {
  await list("project", "file:./dev.db");
  await list("desktop", "file:C:/Users/josep/AppData/Roaming/THE BOSS Watch/data/boss-watch.db");
})();
