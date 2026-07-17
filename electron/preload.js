const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("pactDesktop", {
  platform: process.platform,
  isDesktop: true,
});
