// Playwright webServer 런처 — pg 스키마 리셋 → 마이그레이션 → GRANT → 시드 → next dev 스폰.
// webServer는 globalSetup보다 먼저 뜨고 instrumentation.register()가 부팅 즉시
// DB를 만지므로, 서버 기동 "전"에 스키마·시드가 반드시 존재해야 한다 → 여기서 준비.
// pg 전환: 격리 = 전용 e2e 데이터베이스(recruit_flow_e2e). better-sqlite3 제거로
//   Node 22 세그폴트 제약 소멸 — 어느 Node로 실행해도 된다.
//
// ★ 슬라이스 4b(RLS 강제): 앱은 이제 비슈퍼유저 rf_app으로 접속한다(RLS 적용받음).
//   리셋·마이그레이션·GRANT·시드는 슈퍼유저(RF_ADMIN_DATABASE_URL)로 수행하고,
//   next dev는 DATABASE_URL=rf_app으로 스폰한다. DROP SCHEMA로 테이블이 사라졌다가
//   슈퍼유저가 새로 만들므로, 마이그레이션 뒤 rf_app에 명시적으로 GRANT해야 앱이
//   테이블에 접근할 수 있다(ALTER DEFAULT PRIVILEGES는 dropped-then-recreated
//   스키마에서 다른 롤이 만든 테이블엔 적용되지 않음).
import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const root = process.cwd();
const port = process.env.E2E_PORT ?? "3200";

// 관리(슈퍼유저) URL — 리셋·마이그레이션·GRANT·시드용.
const adminUrl =
  process.env.RF_ADMIN_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5433/recruit_flow_e2e";

// 앱(rf_app) URL — next dev가 이 롤로 접속(RLS 강제).
const appUrl =
  process.env.DATABASE_URL ??
  "postgres://rf_app:rf_app@localhost:5433/recruit_flow_e2e";

// rf_app 롤 비밀번호(롤 생성 시). 기본 'rf_app'.
const rfAppPassword = process.env.RF_APP_PASSWORD ?? "rf_app";

// 대상 e2e 데이터베이스가 없으면 생성(admin = 기본 postgres db 접속).
const dbName = new URL(adminUrl).pathname.replace(/^\//, "");
const bootstrapUrl = new URL(adminUrl);
bootstrapUrl.pathname = "/postgres";
{
  const admin = postgres(bootstrapUrl.toString(), { max: 1 });
  // rf_app 롤이 없으면 생성(클러스터 전역 — 멱등).
  await admin.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rf_app') THEN
        CREATE ROLE rf_app LOGIN NOSUPERUSER PASSWORD '${rfAppPassword.replace(/'/g, "''")}';
      END IF;
    END
    $$;
  `);
  const exists = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
  if (exists.length === 0) {
    await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  }
  await admin.end();
}

// 클린 슬레이트: public + drizzle(마이그레이션 추적) 스키마 드롭 → 재마이그레이션.
// drizzle postgres-js 마이그레이터는 추적 테이블을 별도 `drizzle` 스키마에 두므로
// public만 지우면 migrate가 "이미 적용됨"으로 오판해 테이블을 안 만든다 → 둘 다 드롭.
const sql = postgres(adminUrl, { max: 1 });
await sql.unsafe(
  "DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;",
);
await migrate(drizzle(sql), { migrationsFolder: path.join(root, "drizzle") });

// ★ GRANT: 마이그레이션이 슈퍼유저로 새 스키마에 테이블·정책을 만들었으므로 rf_app에
//   접근 권한이 없다. DROP SCHEMA로 이전 GRANT·DEFAULT PRIVILEGES가 모두 사라졌으니
//   여기서 다시 부여한다(pg-bootstrap.mts의 GRANT 로직 인라인). rf_app은 오너가 아니라
//   FORCE RLS 적용을 받는다 — RLS가 실제로 강제됨.
await sql`GRANT CONNECT ON DATABASE ${sql(dbName)} TO rf_app`;
await sql`GRANT USAGE ON SCHEMA public TO rf_app`;
await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rf_app`;
await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rf_app`;

// 시드(슈퍼유저 — RLS 우회, owner_id 명시 삽입).
const { seed } = await import(
  pathToFileURL(path.join(root, "e2e", "support", "seed.mjs")).href
);
await seed(sql);
await sql.end();

// next dev 기동(스텁 모드 + 격리 pg DB). instrumentation의 부팅 migrate는 admin(no-op).
// DATABASE_URL=rf_app(앱), RF_ADMIN_DATABASE_URL=슈퍼유저(마이그레이션·부팅 고아 스캔).
const env = {
  ...process.env,
  RECRUIT_FLOW_E2E_STUB: process.env.RECRUIT_FLOW_E2E_STUB ?? "1",
  DATABASE_URL: appUrl,
  RF_ADMIN_DATABASE_URL: adminUrl,
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
