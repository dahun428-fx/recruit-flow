// Playwright webServer 런처 — DB 리셋→마이그레이션→시드→next dev 스폰.
// webServer는 globalSetup보다 먼저 뜨고 instrumentation.register()가 부팅 즉시
// DB를 만지므로, 서버 기동 "전"에 스키마가 반드시 존재해야 한다 → 여기서 준비.
// ★ Node 22 필수: Playwright config가 절대경로 .node22/node.exe로 이 파일을 실행하므로
//   process.execPath == node22. next dev도 그 execPath로 스폰해 세그폴트 회피.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Database from "better-sqlite3";

const root = process.cwd();
const port = process.env.E2E_PORT ?? "3200";
const dbPath =
  process.env.RECRUIT_FLOW_DB_PATH ??
  path.join(root, "tmp", "e2e", "recruit-flow-e2e.db");

mkdirSync(path.dirname(dbPath), { recursive: true });
for (const suf of ["", "-wal", "-shm"]) {
  try {
    rmSync(dbPath + suf);
  } catch {
    /* 없으면 무시 */
  }
}

// 마이그레이션 적용(스모크와 동일: --> statement-breakpoint 분할 exec).
// ★ 전부, 파일명 순서대로. 첫 파일만 적용하면 이후 마이그레이션의 컬럼이
//   없어 "no such column"으로 죽는다.
const migDir = path.join(root, "drizzle");
const migFiles = readdirSync(migDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const db = new Database(dbPath);
for (const migFile of migFiles) {
  const sql = readFileSync(path.join(migDir, migFile), "utf8");
  for (const stmt of sql.split("--> statement-breakpoint")) {
    const s = stmt.trim();
    if (s) db.exec(s);
  }
}
db.close();

// 시드.
const seedUrl = pathToFileURL(
  path.join(root, "e2e", "support", "seed.mjs"),
).href;
const { seed } = await import(seedUrl);
seed(dbPath);

// next dev 기동(스텁 모드 + 격리 DB).
const env = {
  ...process.env,
  RECRUIT_FLOW_E2E_STUB: process.env.RECRUIT_FLOW_E2E_STUB ?? "1",
  RECRUIT_FLOW_DB_PATH: dbPath,
};
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [nextBin, "dev", "-p", port], {
  env,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    child.kill(sig);
  });
}
