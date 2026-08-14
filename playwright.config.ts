import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// ★ Node 22 강제: better-sqlite3는 ABI가 맞는 Node에서만 로드된다(Node 23 = 세그폴트).
//   이 config를 실행 중인 Node가 곧 프로젝트가 정한 Node이므로, 그 execPath로 서버
//   런처를 실행하고 런처가 다시 같은 execPath로 next dev를 스폰한다.
//   Windows(`.node22\npm.cmd run e2e`)·macOS(volta) 모두 자동으로 맞는다.
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
      RECRUIT_FLOW_DB_PATH: path.join(
        process.cwd(),
        "tmp",
        "e2e",
        "recruit-flow-e2e.db",
      ),
      E2E_PORT: PORT,
    },
  },
});
