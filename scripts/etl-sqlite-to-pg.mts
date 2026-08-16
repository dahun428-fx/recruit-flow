// 일회성 ETL — 기존 SQLite DB(data/recruit-flow.db)를 Postgres로 복사.
// 재플랫폼 Phase 1(replatform-plan.md). better-sqlite3 없이 `sqlite3 -json` CLI로
// 소스를 읽고(드라이버 의존 제거), postgres.js로 대상에 적재한다.
//
// 실행:
//   DATABASE_URL=postgres://postgres:postgres@localhost:5433/recruit_flow \
//   SQLITE_SRC=data/recruit-flow.db npx tsx scripts/etl-sqlite-to-pg.mts
//
// 대상 스키마는 미리 마이그레이션돼 있어야 한다(instrumentation 또는 drizzle-kit migrate).
// 멱등: 적재 전 전체 테이블을 TRUNCATE CASCADE 한다.
import { execFileSync } from "node:child_process";
import postgres from "postgres";

const SRC = process.env.SQLITE_SRC ?? "data/recruit-flow.db";
const DB_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5433/recruit_flow";

/** sqlite3 -json 으로 테이블 전체를 읽는다(빈 테이블이면 []). */
function readTable(table: string): Record<string, unknown>[] {
  // 쿼리는 ASCII만 — 한글은 argv로 넘기지 않는다(Windows cp949 함정, CLAUDE.md).
  const out = execFileSync(
    "sqlite3",
    ["-json", "-readonly", SRC, `SELECT * FROM ${table};`],
    { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  ).trim();
  return out ? (JSON.parse(out) as Record<string, unknown>[]) : [];
}

// FK 부모 우선 순서. (col 목록 = pg 스키마 snake_case, jsonb·boolean 표기)
type Spec = {
  table: string;
  cols: string[];
  json?: string[];
  bool?: string[];
  // 자기참조 FK 컬럼(있으면 부모→자식 위상정렬 후 삽입 — non-deferrable FK 대비).
  selfRef?: string;
};

/** 자기참조 테이블을 부모 우선 순서로 재배열(부모가 없거나 이미 삽입된 행부터). */
function topoSortSelfRef(
  rows: Record<string, unknown>[],
  parentCol: string,
): Record<string, unknown>[] {
  const done = new Set<unknown>();
  const out: Record<string, unknown>[] = [];
  let remaining = rows.slice();
  while (remaining.length) {
    const ready = remaining.filter((r) => {
      const p = r[parentCol];
      return p === null || p === undefined || done.has(p);
    });
    if (ready.length === 0) {
      // 순환/고아 참조 — 남은 것을 원순서대로(안전판; 정상 데이터면 도달 안 함).
      out.push(...remaining);
      break;
    }
    for (const r of ready) {
      out.push(r);
      done.add(r.id);
    }
    const readySet = new Set(ready);
    remaining = remaining.filter((r) => !readySet.has(r));
  }
  return out;
}
const ORDER: Spec[] = [
  { table: "pipelines", cols: ["id", "name", "created_at", "updated_at", "last_opened_at"] },
  { table: "folders", cols: ["id", "name", "parent_id", "created_at"], selfRef: "parent_id" },
  { table: "documents", cols: ["id", "name", "current_version", "folder_id", "created_at"] },
  { table: "document_versions", cols: ["id", "document_id", "version", "content", "author", "note", "created_at"] },
  { table: "block_defs", cols: ["id", "type", "name", "description", "config", "enabled", "origin", "tray", "created_at"], json: ["config"], bool: ["enabled", "tray"] },
  { table: "nodes", cols: ["id", "pipeline_id", "type", "name", "position_x", "position_y", "block_def_id", "config", "created_at", "updated_at"], json: ["config"] },
  { table: "edges", cols: ["id", "pipeline_id", "source_node_id", "target_node_id", "kind", "source_handle", "input_order"] },
  { table: "runs", cols: ["id", "pipeline_id", "status", "graph_snapshot", "upstream_run_id", "label", "started_at", "ended_at"], json: ["graph_snapshot"] },
  { table: "node_runs", cols: ["id", "run_id", "node_id", "iteration", "status", "gate_decision", "error", "started_at", "ended_at"] },
  { table: "artifacts", cols: ["id", "node_run_id", "format", "content", "meta", "created_at"], json: ["meta"] },
  { table: "chat_messages", cols: ["id", "pipeline_id", "kind", "payload", "run_id", "node_run_id", "created_at"], json: ["payload"] },
];

const sql = postgres(DB_URL, { max: 1 });

try {
  // 멱등 초기화 — 전체 비우기(FK CASCADE).
  const allTables = ORDER.map((s) => `"${s.table}"`).join(", ");
  await sql.unsafe(`TRUNCATE ${allTables} RESTART IDENTITY CASCADE;`);

  let grand = 0;
  for (const spec of ORDER) {
    let rows = readTable(spec.table);
    if (spec.selfRef) rows = topoSortSelfRef(rows, spec.selfRef);
    const jsonCols = new Set(spec.json ?? []);
    const boolCols = new Set(spec.bool ?? []);
    for (const r of rows) {
      const placeholders = spec.cols
        .map((c, i) => (jsonCols.has(c) ? `$${i + 1}::jsonb` : `$${i + 1}`))
        .join(", ");
      const params = spec.cols.map((c) => {
        const v = r[c];
        if (v === null || v === undefined) return null;
        if (boolCols.has(c)) return v ? true : false; // sqlite 0/1 → bool
        // jsonb: sqlite는 JSON 텍스트로 보관 → 반드시 파싱해 "객체"로 넘긴다.
        // 텍스트 그대로 넘기면 postgres.js가 ::jsonb 문맥에서 문자열을 재-인코딩해
        // JSON 스칼라("{...}")로 이중 인코딩된다 → jsonb_typeof=string 버그.
        if (jsonCols.has(c)) return JSON.parse(v as string);
        return v;
      });
      await sql.unsafe(
        `INSERT INTO "${spec.table}" (${spec.cols.join(", ")}) VALUES (${placeholders});`,
        params as never[],
      );
    }
    grand += rows.length;
    console.log(`  ${spec.table.padEnd(20)} ${rows.length}`);
  }
  console.log(`\nETL 완료: ${grand} rows → ${new URL(DB_URL).pathname.slice(1)}`);
} finally {
  await sql.end();
}
