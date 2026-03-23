import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // turbopack.root: npx next build 시 workspace root 오탐 방지
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
