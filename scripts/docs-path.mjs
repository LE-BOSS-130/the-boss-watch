/**
 * Resolve the user's real Documents folder.
 * Prefer OneDrive Documents when present (Windows + OneDrive known folder redirect).
 */
import fs from "fs";
import path from "path";
import os from "os";

export function getDocumentsRoot() {
  const home = os.homedir();
  const candidates = [
    path.join(home, "OneDrive", "Documents"),
    path.join(home, "OneDrive", "Documentos"), // some locales
    process.env.OneDrive
      ? path.join(process.env.OneDrive, "Documents")
      : null,
    path.join(home, "Documents"),
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  // Last resort
  return path.join(home, "Documents");
}

export function getBossWatchDocsRoot() {
  return path.join(getDocumentsRoot(), "THE BOSS Watch");
}
