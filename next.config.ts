import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  basePath: process.env.GITHUB_PAGES === "true" ? "/2025-yoyang-eval" : "",
};

export default nextConfig;
