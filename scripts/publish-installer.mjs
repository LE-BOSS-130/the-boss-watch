/**
 * Copy built installers into OneDrive Documents\THE BOSS Watch\Installers
 * (never the Desktop).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getBossWatchDocsRoot, getDocumentsRoot } from "./docs-path.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const releaseDir = path.join(root, "release");
const docsRoot = getBossWatchDocsRoot();
const installersDir = path.join(docsRoot, "Installers");

fs.mkdirSync(installersDir, { recursive: true });
fs.mkdirSync(path.join(docsRoot, "Data"), { recursive: true });

const readme = path.join(docsRoot, "README.txt");
fs.writeFileSync(
  readme,
  `THE BOSS Watch
================

Shared responsibility assistant — one group AI for families, crews, and teams.

Location (this folder)
----------------------
${docsRoot}

Documents root used:
${getDocumentsRoot()}

Folders
-------
Installers\\   Windows setup EXEs (new builds go here)
Data\\         Optional local notes / exports

How to install
--------------
1. Open Installers\\
2. Run THE-BOSS-Watch-Setup-*.exe
3. Launch "THE BOSS Watch" from the Start Menu

Demo logins (fresh install)
---------------------------
  joe@bosswatch.local / password123
  matthew@bosswatch.local / password123
  sam@bosswatch.local / password123
  Invite code: HOUSEHOLD

Project source
--------------
  ${root}
  https://github.com/LE-BOSS-130/the-boss-watch
`,
  "utf8"
);

if (!fs.existsSync(releaseDir)) {
  console.error("No release/ folder — run electron-builder first.");
  process.exit(1);
}

const files = fs
  .readdirSync(releaseDir)
  .filter((f) => f.endsWith(".exe") && !f.includes("uninstaller"));
if (!files.length) {
  console.error("No installer .exe found in release/");
  process.exit(1);
}

for (const f of files) {
  const src = path.join(releaseDir, f);
  const dest = path.join(installersDir, f);
  fs.copyFileSync(src, dest);
  console.log("Published:", dest);
}

const latest = files.sort().at(-1);
fs.writeFileSync(
  path.join(installersDir, "latest.json"),
  JSON.stringify(
    {
      product: "THE BOSS Watch",
      version: latest.match(/(\d+\.\d+\.\d+)/)?.[1] || "0.1.0",
      file: latest,
      documentsRoot: getDocumentsRoot(),
      path: path.join(installersDir, latest),
      updatedAt: new Date().toISOString(),
    },
    null,
    2
  ),
  "utf8"
);

console.log("\nDocuments root:", getDocumentsRoot());
console.log("Installers live in:");
console.log(" ", installersDir);
