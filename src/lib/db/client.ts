// better-sqlite3 싱글턴 + drizzle().
// data/ 디렉터리 없으면 생성, WAL 모드.
// ★ Node 22로 실행해야 함(전역 Node 23은 better-sqlite3 세그폴트) — CLAUDE.md.

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

// 기본 data/recruit-flow.db. 스모크·테스트는 RECRUIT_FLOW_DB_PATH로 격리 가능.
const DB_PATH =
  process.env.RECRUIT_FLOW_DB_PATH || path.join(process.cwd(), "data", "recruit-flow.db");
const DB_DIR = path.dirname(DB_PATH);

// Next dev/HMR에서 모듈이 재평가돼도 커넥션이 중복 생성되지 않도록 전역 캐시.
const globalForDb = globalThis as unknown as {
  __recruitFlowSqlite?: Database.Database;
};

function createSqlite(): Database.Database {
  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

export const sqlite: Database.Database =
  globalForDb.__recruitFlowSqlite ?? createSqlite();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__recruitFlowSqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });

export type Db = typeof db;
