import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3는 네이티브 모듈 — 서버 번들에서 외부화(번들링 제외)
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
