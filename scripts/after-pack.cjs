/**
 * electron-builder afterPack — ensure Next standalone node_modules
 * is present under resources/server (builder sometimes omits it).
 */
const fs = require("fs");
const path = require("path");

exports.default = async function afterPack(context) {
  const projectDir = context.packager.projectDir;
  const appOutDir = context.appOutDir;
  const srcServer = path.join(projectDir, "desktop-resources", "server");
  const destServer = path.join(appOutDir, "resources", "server");

  if (!fs.existsSync(srcServer)) {
    console.warn("afterPack: desktop-resources/server missing");
    return;
  }

  fs.mkdirSync(destServer, { recursive: true });
  // Full sync so standalone server is complete
  fs.cpSync(srcServer, destServer, { recursive: true, force: true });

  const templateSrc = path.join(projectDir, "desktop-resources", "template.db");
  const templateDest = path.join(appOutDir, "resources", "template.db");
  if (fs.existsSync(templateSrc)) {
    fs.copyFileSync(templateSrc, templateDest);
  }

  const hasNext = fs.existsSync(path.join(destServer, "node_modules", "next"));
  console.log(`afterPack: server synced, next module present=${hasNext}`);
  if (!hasNext) {
    throw new Error("afterPack: node_modules/next missing from packaged server");
  }
};
