// postgres.js 싱글턴 + drizzle(postgres-js).
// 커넥션 문자열은 DATABASE_URL(미설정 시 로컬 dev pg로 폴백).
// ★ Node 22 ABI 제약 소멸(better-sqlite3 제거) — 순수 JS 드라이버.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// 로컬 개발용 기본 커넥션. 프로덕션·검증은 DATABASE_URL로 주입.
const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5433/recruit_flow";

// Next dev/HMR에서 모듈이 재평가돼도 커넥션 풀이 중복 생성되지 않도록 전역 캐시.
const globalForDb = globalThis as unknown as {
  __recruitFlowPg?: ReturnType<typeof postgres>;
};

export const sql: ReturnType<typeof postgres> =
  globalForDb.__recruitFlowPg ?? postgres(DATABASE_URL);

if (process.env.NODE_ENV !== "production") {
  globalForDb.__recruitFlowPg = sql;
}

export const db = drizzle(sql, { schema });

export type Db = typeof db;
