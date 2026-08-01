// Next 서버 프로세스 기동 시 1회 실행(engine.md §복구).
// 이전 프로세스가 남긴 running run을 failed로 마감한다. waiting_human은 M1 없음.
// better-sqlite3는 nodejs 런타임 전용 — edge에서 로드하지 않도록 가드.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runner } = await import("@/lib/engine/runner");
  runner.recoverOnBoot();
}
