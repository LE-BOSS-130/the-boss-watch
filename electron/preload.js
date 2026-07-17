const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("bossWatchDesktop", {
  platform: process.platform,
  isDesktop: true,
});
