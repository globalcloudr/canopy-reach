import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@canopy/ui"],
  experimental: {
    externalDir: true,
  },
};

export default nextConfig;
