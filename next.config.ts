import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // postgres.js는 순수 JS 드라이버 — 네이티브 외부화 불필요(better-sqlite3 제거).
  // Next 16은 dev에서 교차 출처(/_next 리소스) 접근을 기본 차단한다.
  // 127.0.0.1로 접근하면 HMR·클라이언트 번들이 막혀 하이드레이션이 실패하고
  // UI가 초기 상태(빈 목록·로딩)에 멈춘다 → localhost로 뜬 서버를 127.0.0.1로
  // 열면 "앱이 다 깨진 것"처럼 보인다. 로컬 개발 호스트를 허용해 이 함정 제거.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
