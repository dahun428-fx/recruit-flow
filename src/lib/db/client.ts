// postgres.js 싱글턴 + drizzle(postgres-js).
// ★ Node 22 ABI 제약 소멸(better-sqlite3 제거) — 순수 JS 드라이버.
//
// 커넥션 분리(Phase 2a 슬라이스 4b, auth.md §4):
//   - 앱 커넥션(sql/db) = 비슈퍼유저 rf_app 롤. FORCE RLS 적용받음. 요청·러너의
//     모든 격리 대상 쿼리는 여기(예약 커넥션+GUC) 위에서 돈다.
//   - 관리 커넥션(adminSql/adminDb) = 슈퍼유저 postgres. RLS 우회. 오직 마이그레이션과
//     부팅 복구의 교차 소유자 고아 스캔에만 쓴다(auth.md §5). 테넌트 쓰기 금지.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// 앱(rf_app) 커넥션. 프로덕션·검증은 DATABASE_URL로 주입.
// 기본값을 비슈퍼유저 rf_app으로 둔다 — RLS가 실제로 강제되는 롤.
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://rf_app:rf_app@localhost:5433/recruit_flow";

// 관리(슈퍼유저) 커넥션. 마이그레이션·부팅 고아 스캔 전용.
const RF_ADMIN_DATABASE_URL =
  process.env.RF_ADMIN_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5433/recruit_flow";

// Next dev/HMR에서 모듈이 재평가돼도 커넥션 풀이 중복 생성되지 않도록 전역 캐시.
const globalForDb = globalThis as unknown as {
  __recruitFlowPg?: ReturnType<typeof postgres>;
  __recruitFlowAdminPg?: ReturnType<typeof postgres>;
};

// ===========================================================================
// 앱 커넥션(rf_app) — 격리 대상 쿼리 경로.
// ===========================================================================
export const sql: ReturnType<typeof postgres> =
  globalForDb.__recruitFlowPg ?? postgres(DATABASE_URL);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__recruitFlowPg = sql;
}

export const db = drizzle(sql, { schema });

export type Db = typeof db;

// ===========================================================================
// 관리 커넥션(슈퍼유저) — 마이그레이션 + 부팅 고아 스캔 전용(auth.md §5).
// 테넌트 쓰기에 절대 쓰지 않는다(RLS 우회 = R3 위반).
// ===========================================================================
export const adminSql: ReturnType<typeof postgres> =
  globalForDb.__recruitFlowAdminPg ?? postgres(RF_ADMIN_DATABASE_URL);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__recruitFlowAdminPg = adminSql;
}

export const adminDb = drizzle(adminSql, { schema });
