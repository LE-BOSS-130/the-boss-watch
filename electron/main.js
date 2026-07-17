const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");

const PORT = Number(process.env.BOSS_WATCH_PORT || 3847);
const HOST = "127.0.0.1";

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {import('child_process').ChildProcess | null} */
let serverProcess = null;
let shuttingDown = false;

function isDev() {
  return !app.isPackaged;
}

function userDataDir() {
  const dir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function databaseUrl() {
  // Prisma SQLite absolute path on Windows: file:C:/...
  const dbFile = path.join(userDataDir(), "boss-watch.db");
  const normalized = dbFile.replace(/\\/g, "/");
  return `file:${normalized}`;
}

function ensureDatabase() {
  const dbFile = path.join(userDataDir(), "boss-watch.db");
  if (fs.existsSync(dbFile)) return dbFile;

  const candidates = [
    path.join(process.resourcesPath || "", "template.db"),
    path.join(__dirname, "..", "prisma", "dev.db"),
  ];
  for (const src of candidates) {
    if (src && fs.existsSync(src)) {
      fs.copyFileSync(src, dbFile);
      return dbFile;
    }
  }
  // Empty file — Prisma will still need schema; seed template should exist in builds
  return dbFile;
}

function serverRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "server");
  }
  return path.join(__dirname, "..");
}

function loadingHtml(message) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>THE BOSS Watch</title>
<style>
  html,body{margin:0;height:100%;background:#07090c;color:#e4e4e7;
  font-family:system-ui,Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center}
  .box{text-align:center;max-width:28rem;padding:2rem}
  h1{font-size:1.25rem;font-weight:600;margin:0 0 .75rem}
  p{color:#a1a1aa;line-height:1.5;margin:0}
  .dot{display:inline-block;width:.5rem;height:.5rem;border-radius:999px;background:#34d399;
  margin-right:.5rem;animation:pulse 1.2s ease-in-out infinite}
  @keyframes pulse{0%,100%{opacity:.35}50%{opacity:1}}
</style></head><body><div class="box">
  <h1><span class="dot"></span>THE BOSS Watch</h1>
  <p>${message}</p>
</div></body></html>`)}`;
}

function waitForServer(timeoutMs = 60000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(`http://${HOST}:${PORT}/`, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error("Server did not start in time"));
          return;
        }
        setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });
}

function startEmbeddedServer() {
  ensureDatabase();
  const root = serverRoot();
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(PORT),
    HOSTNAME: HOST,
    DATABASE_URL: databaseUrl(),
    AUTH_SECRET:
      process.env.AUTH_SECRET ||
      "the-boss-watch-desktop-secret-change-me-in-production",
    NEXTAUTH_URL: `http://${HOST}:${PORT}`,
    AUTH_URL: `http://${HOST}:${PORT}`,
    AUTH_TRUST_HOST: "true",
  };

  if (app.isPackaged) {
    const serverJs = path.join(root, "server.js");
    if (!fs.existsSync(serverJs)) {
      throw new Error(`Missing packaged server at ${serverJs}`);
    }
    // Run Next standalone with Electron's Node
    serverProcess = spawn(process.execPath, [serverJs], {
      cwd: root,
      env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } else {
    // Dev: prefer already-running next, else start `next dev`
    const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
    serverProcess = spawn(process.execPath, [nextBin, "dev", "-H", HOST, "-p", String(PORT)], {
      cwd: root,
      env: { ...env, ELECTRON_RUN_AS_NODE: "1", NODE_ENV: "development" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  }

  serverProcess.stdout?.on("data", (d) => console.log(`[server] ${d}`));
  serverProcess.stderr?.on("data", (d) => console.error(`[server] ${d}`));
  serverProcess.on("exit", (code) => {
    serverProcess = null;
    if (!shuttingDown && code && code !== 0) {
      console.error("Server exited with code", code);
    }
  });
}

function stopServer() {
  shuttingDown = true;
  if (serverProcess && !serverProcess.killed) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(serverProcess.pid), "/f", "/t"], {
          windowsHide: true,
        });
      } else {
        serverProcess.kill("SIGTERM");
      }
    } catch {
      /* ignore */
    }
    serverProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "THE BOSS Watch",
    backgroundColor: "#07090c",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function boot() {
  createWindow();
  const external = process.env.BOSS_WATCH_URL;
  if (external) {
    await mainWindow.loadURL(external);
    return;
  }

  await mainWindow.loadURL(
    loadingHtml("Starting the shared coordinator… this only takes a moment.")
  );

  try {
    // If something is already listening (e.g. npm run dev), reuse it
    let alreadyUp = false;
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://${HOST}:${PORT}/`, (res) => {
          res.resume();
          resolve();
        });
        req.on("error", reject);
        req.setTimeout(800, () => {
          req.destroy();
          reject(new Error("timeout"));
        });
      });
      alreadyUp = true;
    } catch {
      alreadyUp = false;
    }

    if (!alreadyUp) {
      startEmbeddedServer();
      await waitForServer(90000);
    }

    await mainWindow.loadURL(`http://${HOST}:${PORT}/`);
  } catch (err) {
    console.error(err);
    await mainWindow.loadURL(
      loadingHtml(
        `Could not start the app server.<br/><br/>${String(err.message || err)}<br/><br/>Try running <code>start-the-boss-watch.bat</code> from the project folder, or reinstall from Documents\\THE BOSS Watch\\Installers.`
      )
    );
    dialog.showErrorBox(
      "THE BOSS Watch",
      `Could not start the local server:\n\n${err.message || err}`
    );
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(boot);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) boot();
  });
}

app.on("window-all-closed", () => {
  stopServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopServer();
});
