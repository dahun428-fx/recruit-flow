import { defineConfig, devices } from "@playwright/test";

// pg 전환 후 Node 22 제약 소멸(better-sqlite3 제거). 어느 Node로 실행해도 된다.
//   이 config를 실행 중인 Node의 execPath로 서버 런처를 실행하고, 런처가 다시 같은
//   execPath로 next dev를 스폰한다(일관성 유지).
const NODE = process.execPath;
const PORT = process.env.E2E_PORT ?? "3200"; // 3000은 타앱 서비스워커 오염 회피

export default defineConfig({
  testDir: "./e2e",
  // 단일 SQLite + 러너 전역 상태 → 병렬 금지, 안정 우선.
  fullyParallel: false,
  workers: 1,
  retries: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  // 기본 스위트는 @live(실 LLM) 제외 — 결정론 스텁 모드.
  grepInvert: /@live/,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/e2e-results.json" }],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `"${NODE}" e2e/support/start-server.mjs`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      RECRUIT_FLOW_E2E_STUB: "1",
      // 격리 = 전용 e2e 데이터베이스. 런처가 매 실행마다 스키마를 리셋·GRANT·시드한다.
      // ★ 슬라이스 4b: 앱은 rf_app(RLS 강제)으로, 리셋·마이그레이션·시드는
      //   슈퍼유저(RF_ADMIN_DATABASE_URL)로. 런처가 두 URL을 모두 사용한다.
      DATABASE_URL:
        process.env.E2E_DATABASE_URL ??
        "postgres://rf_app:rf_app@localhost:5433/recruit_flow_e2e",
      RF_ADMIN_DATABASE_URL:
        process.env.E2E_ADMIN_DATABASE_URL ??
        "postgres://postgres:postgres@localhost:5433/recruit_flow_e2e",
      E2E_PORT: PORT,
    },
  },
});
