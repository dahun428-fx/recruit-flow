import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// @live 전용 — 실 LLM(스텁 없음). 별도 포트·DB로 격리. 실행: npm run e2e:live.
// ★ Node 22 강제(기본 config와 동일 근거).
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
      RECRUIT_FLOW_DB_PATH: path.join(
        process.cwd(),
        "tmp",
        "e2e",
        "recruit-flow-live.db",
      ),
      E2E_PORT: PORT,
    },
  },
});
