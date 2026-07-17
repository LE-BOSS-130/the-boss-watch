/**
 * Assemble Electron resources after `next build` (standalone).
 * Copies Next standalone + static + public + seed database template.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const staticDir = path.join(root, ".next", "static");
const publicDir = path.join(root, "public");
const outServer = path.join(root, "desktop-resources", "server");
const outRoot = path.join(root, "desktop-resources");

function rimraf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

if (!fs.existsSync(standalone)) {
  console.error("Missing .next/standalone — run `next build` first (output: 'standalone').");
  process.exit(1);
}

rimraf(outRoot);
copyDir(standalone, outServer);

// Next standalone may nest under package name — normalize so server.js is at server/
const nested = path.join(outServer, "the-boss-watch");
if (fs.existsSync(path.join(nested, "server.js")) && !fs.existsSync(path.join(outServer, "server.js"))) {
  // Move nested contents up
  for (const name of fs.readdirSync(nested)) {
    fs.renameSync(path.join(nested, name), path.join(outServer, name));
  }
  fs.rmSync(nested, { recursive: true, force: true });
}

// Never ship a .env that points at dev paths / wrong NEXTAUTH_URL —
// Electron injects DATABASE_URL + AUTH_* at runtime into userData.
for (const envName of [".env", ".env.local", ".env.production"]) {
  const envPath = path.join(outServer, envName);
  if (fs.existsSync(envPath)) {
    fs.unlinkSync(envPath);
    console.log("Removed packaged", envName);
  }
}

const destStatic = path.join(outServer, ".next", "static");
if (fs.existsSync(staticDir)) {
  copyDir(staticDir, destStatic);
}

const destPublic = path.join(outServer, "public");
if (fs.existsSync(publicDir)) {
  copyDir(publicDir, destPublic);
}

// Ensure seed DB exists for first-run template
const dbPath = path.join(root, "prisma", "dev.db");
if (!fs.existsSync(dbPath)) {
  console.log("Creating seed database…");
  execSync("npx prisma db push", { cwd: root, stdio: "inherit" });
  execSync("npm run db:seed", { cwd: root, stdio: "inherit" });
}
fs.copyFileSync(dbPath, path.join(outRoot, "template.db"));

// Prisma engines sometimes need to live next to the server
const prismaClient = path.join(root, "node_modules", ".prisma");
if (fs.existsSync(prismaClient)) {
  copyDir(prismaClient, path.join(outServer, "node_modules", ".prisma"));
}
const prismaPkg = path.join(root, "node_modules", "@prisma");
if (fs.existsSync(prismaPkg)) {
  copyDir(prismaPkg, path.join(outServer, "node_modules", "@prisma"));
}

console.log("Desktop resources ready at desktop-resources/");
console.log("  server/  → Next standalone");
console.log("  template.db → first-run database");
