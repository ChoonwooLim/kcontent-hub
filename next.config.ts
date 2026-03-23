import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker/Orbitron
  output: "standalone",

  // Fix: Orbitron runs `npx next build` which uses a fresh Next.js download.
  // Turbopack incorrectly infers /app/src/app as workspace root.
  // Setting root explicitly to process.cwd() (/app in Docker) fixes it.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
