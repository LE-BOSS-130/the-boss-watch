/**
 * Starts Next.js production server for the Electron desktop shell.
 * Used by the installed Windows app (NSIS) via electron-builder extraResources
 * or by `npm run desktop` after `npm run build`.
 */
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "start", "-p", "3000"], {
  cwd: root,
  env: { ...process.env, NODE_ENV: "production" },
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
