import { defineConfig, devices } from "@playwright/test";

// @live 전용 — 실 LLM(스텁 없음). 별도 포트·전용 pg DB(recruit_flow_live)로 격리.
// 실행: npm run e2e:live. (pg 전환 후 Node 22 제약 소멸 — 기본 config와 동일.)
const NODE = process.execPath;
const PORT = process.env.E2E_LIVE_PORT ?? "3201";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000, // 실 LLM은 느림
  expect: { timeout: 60_000 },
  grep: /@live/, // @live 태그만
  reporter: [["list"], ["json", { outputFile: "test-results/e2e-live-results.json" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
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
      RECRUIT_FLOW_E2E_STUB: "0", // 실 LLM
      // 격리 = 전용 live pg DB. 런처(start-server.mjs)가 admin으로 리셋·마이그레이트·
      // GRANT·시드 후 앱을 rf_app로 스폰한다(기본 e2e config와 동일 메커니즘).
      DATABASE_URL:
        process.env.E2E_LIVE_DATABASE_URL ??
        "postgres://rf_app:rf_app@localhost:5433/recruit_flow_live",
      RF_ADMIN_DATABASE_URL:
        process.env.E2E_LIVE_ADMIN_DATABASE_URL ??
        "postgres://postgres:postgres@localhost:5433/recruit_flow_live",
      E2E_PORT: PORT,
    },
  },
});
