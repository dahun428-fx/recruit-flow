/**
 * scripts/pg-bootstrap.mts — recruit-flow PostgreSQL 클러스터 초기화 (멱등).
 *
 * 사용법:
 *   npx tsx scripts/pg-bootstrap.mts
 *
 * 환경변수:
 *   DATABASE_URL  슈퍼유저 접속 URL (기본: postgres://postgres:postgres@localhost:5433/recruit_flow)
 *   RF_APP_PASSWORD  rf_app 롤 비밀번호 (기본: 'rf_app')
 *
 * 수행 내용:
 *   1. rf_app 롤 생성(이미 존재하면 스킵) — NOSUPERUSER, LOGIN
 *   2. 대상 DB에 CONNECT 권한 부여
 *   3. public 스키마 USAGE 부여
 *   4. 현재 및 미래 테이블에 SELECT/INSERT/UPDATE/DELETE 부여
 *   5. DEFAULT PRIVILEGES 설정 (미래 마이그레이션 테이블 자동 커버)
 *
 * 주의: rf_app은 테이블 오너(postgres)가 아님 → 마이그레이션이 FORCE ROW LEVEL SECURITY를
 * 사용하는 이유(오너도 RLS 강제).
 */

import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5433/recruit_flow";

const RF_APP_PASSWORD = process.env.RF_APP_PASSWORD ?? "rf_app";

// 대상 DB 이름 추출 (URL 경로 마지막 세그먼트)
const dbName = new URL(DATABASE_URL).pathname.replace(/^\//, "");

const sql = postgres(DATABASE_URL, { max: 1 });

try {
  // 1. rf_app 롤 생성 (멱등: 이미 존재하면 DO NOTHING)
  await sql.unsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rf_app') THEN
        CREATE ROLE rf_app LOGIN NOSUPERUSER PASSWORD '${RF_APP_PASSWORD.replace(/'/g, "''")}';
        RAISE NOTICE 'rf_app 롤 생성 완료';
      ELSE
        RAISE NOTICE 'rf_app 롤 이미 존재 — 비밀번호 갱신 생략';
      END IF;
    END
    $$;
  `);
  console.log("[bootstrap] rf_app 롤 확인 완료");

  // 2. 대상 DB에 CONNECT 권한
  await sql.unsafe(`GRANT CONNECT ON DATABASE "${dbName}" TO rf_app`);
  console.log(`[bootstrap] GRANT CONNECT ON DATABASE ${dbName} → rf_app`);

  // 3. public 스키마 USAGE
  await sql`GRANT USAGE ON SCHEMA public TO rf_app`;
  console.log("[bootstrap] GRANT USAGE ON SCHEMA public → rf_app");

  // 4. 현재 테이블 전체 DML 권한
  await sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rf_app`;
  console.log("[bootstrap] GRANT SELECT/INSERT/UPDATE/DELETE ON ALL TABLES → rf_app");

  // 5. 미래 테이블(drizzle-kit 마이그레이션)도 자동 커버
  // ALTER DEFAULT PRIVILEGES는 현재 세션 오너(postgres)가 앞으로 만들 테이블에 적용됨.
  await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rf_app`;
  console.log("[bootstrap] ALTER DEFAULT PRIVILEGES → rf_app (미래 테이블 자동 커버)");

  console.log("[bootstrap] 완료 — recruit_flow DB에 rf_app 권한 설정 성공");
} finally {
  await sql.end();
}
