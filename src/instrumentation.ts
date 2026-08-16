// Next 서버 프로세스 기동 시 1회 실행(engine.md §복구).
// 1) pg 마이그레이션을 적용해 백지 DB도 사용 가능하게 만든다.
// 2) 이전 프로세스가 남긴 running run을 failed로 마감한다(waiting_human은 복원 유지).
// postgres.js는 nodejs 런타임 전용 — edge에서 로드하지 않도록 가드.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // 스키마 적용(백지 pg → 사용 가능). 이미 최신이면 no-op.
  // ★ 마이그레이션은 테이블·정책·인덱스를 만든다 — rf_app(비오너)은 권한이 없다.
  //   반드시 슈퍼유저 관리 커넥션(adminDb)으로 실행한다(auth.md §4·§5).
  try {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const { adminDb } = await import("@/lib/db/client");
    await migrate(adminDb, { migrationsFolder: "drizzle" });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[instrumentation] pg migrate 실패:", e);
  }

  // e2e 결정론 스텁(테스트 전용). env 미설정 시 import 자체가 안 됨 → 프로덕션 무영향.
  if (process.env.RECRUIT_FLOW_E2E_STUB === "1") {
    const { installE2eStubs } = await import("@/lib/engine/e2e-stubs");
    installE2eStubs();
  }
  const { runner } = await import("@/lib/engine/runner");
  await runner.recoverOnBoot();
}
