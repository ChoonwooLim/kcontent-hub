import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // turbopack.root: npx next build 시 workspace root 오탐 방지
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: ["yt-dlp-wrap"],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.youtube.com",
      },
      {
        protocol: "https",
        hostname: "*.ytimg.com",
      },
    ],
  },
};

export default nextConfig;

