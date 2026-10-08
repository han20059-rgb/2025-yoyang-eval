import type { NextConfig } from "next";

const githubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  ...(githubPages ? { output: "export" as const } : {}),
  images: { unoptimized: true },
  basePath: githubPages ? "/2025-yoyang-eval" : "",
  serverExternalPackages: ["pdfjs-dist", "tesseract.js", "cfb", "jszip", "@napi-rs/canvas", "pg"],
};

export default nextConfig;
