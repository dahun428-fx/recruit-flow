// recruit-flow DB 스키마 (Drizzle / better-sqlite3)
// 계약서: specs/schema.md — 9개 테이블(+ document_versions = 10개 실 테이블).
// id는 전부 text(nanoid), 시각은 integer(unixepoch ms).
// M1에서 block_defs·chat_messages는 테이블만 정의(미사용).

import { sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// pipelines
// ---------------------------------------------------------------------------
export const pipelines = sqliteTable("pipelines", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  // 앱 진입 시 "마지막 파이프라인" 결정
  lastOpenedAt: integer("last_opened_at"),
});

// ---------------------------------------------------------------------------
// nodes — 편집 중인 현재 그래프
// ---------------------------------------------------------------------------
export const nodes = sqliteTable("nodes", {
  id: text("id").primaryKey(),
  pipelineId: text("pipeline_id")
    .notNull()
    .references(() => pipelines.id, { onDelete: "cascade" }),
  // agent/input/output/gate/human/skill/rule/tool
  type: text("type").notNull(),
  name: text("name").notNull(),
  positionX: real("position_x").notNull(),
  positionY: real("position_y").notNull(),
  // 타입별 속성(nodes.md) — JSON
  config: text("config", { mode: "json" }).notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ---------------------------------------------------------------------------
// edges
// ---------------------------------------------------------------------------
export const edges = sqliteTable("edges", {
  id: text("id").primaryKey(),
  pipelineId: text("pipeline_id")
    .notNull()
    .references(() => pipelines.id, { onDelete: "cascade" }),
  sourceNodeId: text("source_node_id").notNull(),
  targetNodeId: text("target_node_id").notNull(),
  // flow(실선) / mount(점선)
  kind: text("kind").notNull(),
  // Gate만 pass/fail
  sourceHandle: text("source_handle"),
  // Q11 입력 순번(엣지 클릭으로 조정)
  inputOrder: integer("input_order").notNull().default(0),
});

// ---------------------------------------------------------------------------
// block_defs — 팔레트 하위 항목(저장된 정의). M1 미사용.
// ---------------------------------------------------------------------------
export const blockDefs = sqliteTable("block_defs", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  config: text("config", { mode: "json" }).notNull(),
  // 하위 항목별 활성/비활성(Q10-B)
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  // human / chatbot / import
  origin: text("origin").notNull(),
  // true = 새 블록 트레이 대기(챗봇 add, 미승인). 캔버스 드래그 승인 시 false
  tray: integer("tray", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

// ---------------------------------------------------------------------------
// runs
// ---------------------------------------------------------------------------
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  pipelineId: text("pipeline_id")
    .notNull()
    .references(() => pipelines.id, { onDelete: "cascade" }),
  // running / waiting_human / succeeded / failed / gate_failed / cancelled
  status: text("status").notNull(),
  // 시작 시 nodes+edges 전체 복사(JSON)
  graphSnapshot: text("graph_snapshot", { mode: "json" }).notNull(),
  // 부분 재실행 시 아티팩트 재사용 출처(직전 완료 run)
  upstreamRunId: text("upstream_run_id"),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
});

// ---------------------------------------------------------------------------
// node_runs — run별 노드 실행 기록
// ---------------------------------------------------------------------------
export const nodeRuns = sqliteTable("node_runs", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  // 스냅샷 내 노드 id
  nodeId: text("node_id").notNull(),
  // Gate 루프 회차(1부터)
  iteration: integer("iteration").notNull().default(1),
  // queued / running / waiting_human / succeeded / failed / skipped
  status: text("status").notNull(),
  // Gate 전용 라우팅 결정 — pass / fail. Gate 외 노드는 null.
  // Gate는 판정 후 항상 succeeded로 마감하므로 status로는 복원 불가(schema.md).
  gateDecision: text("gate_decision"),
  error: text("error"),
  startedAt: integer("started_at"),
  endedAt: integer("ended_at"),
});

// ---------------------------------------------------------------------------
// artifacts — 노드 실행 1회 = 아티팩트 1개
// ---------------------------------------------------------------------------
export const artifacts = sqliteTable("artifacts", {
  id: text("id").primaryKey(),
  nodeRunId: text("node_run_id")
    .notNull()
    .references(() => nodeRuns.id, { onDelete: "cascade" }),
  // markdown / json / html(Output)
  format: text("format").notNull(),
  // 스트리밍 중 주기적 append-flush, 완료 시 확정
  content: text("content").notNull().default(""),
  // Input: 문서 버전 번호 / Human: 편집 주체 등
  meta: text("meta", { mode: "json" }),
  createdAt: integer("created_at").notNull(),
});

// ---------------------------------------------------------------------------
// documents / document_versions — 본문은 versions에만 존재
// ---------------------------------------------------------------------------
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // 현재 본문 = current_version 행
  currentVersion: integer("current_version").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const documentVersions = sqliteTable("document_versions", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  // 전문
  content: text("content").notNull(),
  // human / llm
  author: text("author").notNull(),
  // 변경 요약
  note: text("note"),
  createdAt: integer("created_at").notNull(),
});

// ---------------------------------------------------------------------------
// chat_messages — 파이프라인당 1 스레드. M1 미사용.
// ---------------------------------------------------------------------------
export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  pipelineId: text("pipeline_id")
    .notNull()
    .references(() => pipelines.id, { onDelete: "cascade" }),
  // user / assistant / card_block / card_human / card_run
  kind: text("kind").notNull(),
  // 텍스트 또는 카드 데이터(JSON)
  payload: text("payload", { mode: "json" }).notNull(),
  runId: text("run_id"),
  nodeRunId: text("node_run_id"),
  createdAt: integer("created_at").notNull(),
});

// 마이그레이션 생성 시 sql 헬퍼 존재를 강제하지 않도록 참조만 유지.
export const _schemaSqlRef = sql;
