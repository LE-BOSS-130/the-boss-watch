import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained Node server for the desktop app (Electron)
  output: "standalone",
};

export default nextConfig;
