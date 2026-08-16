// Playwright webServer 런처 — pg 스키마 리셋 → 마이그레이션 → 시드 → next dev 스폰.
// webServer는 globalSetup보다 먼저 뜨고 instrumentation.register()가 부팅 즉시
// DB를 만지므로, 서버 기동 "전"에 스키마·시드가 반드시 존재해야 한다 → 여기서 준비.
// pg 전환: 격리 = 전용 e2e 데이터베이스(recruit_flow_e2e). better-sqlite3 제거로
//   Node 22 세그폴트 제약 소멸 — 어느 Node로 실행해도 된다.
import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const root = process.cwd();
const port = process.env.E2E_PORT ?? "3200";
const dbUrl =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5433/recruit_flow_e2e";

// 대상 e2e 데이터베이스가 없으면 생성(admin = 기본 postgres db 접속).
const dbName = new URL(dbUrl).pathname.replace(/^\//, "");
const adminUrl = new URL(dbUrl);
adminUrl.pathname = "/postgres";
{
  const admin = postgres(adminUrl.toString(), { max: 1 });
  const exists = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
  if (exists.length === 0) {
    await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  }
  await admin.end();
}

// 클린 슬레이트: public + drizzle(마이그레이션 추적) 스키마 드롭 → 재마이그레이션.
// drizzle postgres-js 마이그레이터는 추적 테이블을 별도 `drizzle` 스키마에 두므로
// public만 지우면 migrate가 "이미 적용됨"으로 오판해 테이블을 안 만든다 → 둘 다 드롭.
const sql = postgres(dbUrl, { max: 1 });
await sql.unsafe(
  "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;",
);
await migrate(drizzle(sql), { migrationsFolder: path.join(root, "drizzle") });

// 시드.
const { seed } = await import(
  pathToFileURL(path.join(root, "e2e", "support", "seed.mjs")).href
);
await seed(sql);
await sql.end();

// next dev 기동(스텁 모드 + 격리 pg DB). instrumentation의 부팅 migrate는 no-op.
const env = {
  ...process.env,
  RECRUIT_FLOW_E2E_STUB: process.env.RECRUIT_FLOW_E2E_STUB ?? "1",
  DATABASE_URL: dbUrl,
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
