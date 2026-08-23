// recruit-flow DB 스키마 (Drizzle / postgres.js — pg-core).
// 계약서: specs/schema.md — 9개 테이블(+ document_versions = 10개 실 테이블).
// id는 전부 text(nanoid), 시각은 bigint(unixepoch ms, mode:"number").
// 재플랫폼 Phase 1(2026-08-16): sqlite-core → pg-core 방언 전환. 테이블·컬럼·
// 관계 계약은 불변. folders.parentId·documents.folderId는 진짜 FK로 승격하되
// 순환 검증은 앱 레벨 유지(schema.md 방언 델타).
// Phase 2a Slice 1(2026-08-17): appUsers 테이블 + owner_id(nullable) 루트 5개 테이블.
// NOT NULL 승격·RLS 정책은 Phase 2a Slice 4(0002 마이그레이션).

import {
  type AnyPgColumn,
  bigint,
  boolean,
  doublePrecision,
  jsonb,
  pgTable,
  text,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// app_users — 최소 사용자 테이블 (Phase 2a). RLS·자기참조 정책은 Slice 4.
// ---------------------------------------------------------------------------
export const appUsers = pgTable("app_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

// ---------------------------------------------------------------------------
// pipelines
// ---------------------------------------------------------------------------
export const pipelines = pgTable("pipelines", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  // 앱 진입 시 "마지막 파이프라인" 결정
  lastOpenedAt: bigint("last_opened_at", { mode: "number" }),
  // Phase 2a: 소유자(nullable — Slice 4에서 NOT NULL 승격). FK→app_users.id
  ownerId: text("owner_id").references(() => appUsers.id),
});

// ---------------------------------------------------------------------------
// nodes — 편집 중인 현재 그래프
// ---------------------------------------------------------------------------
export const nodes = pgTable("nodes", {
  id: text("id").primaryKey(),
  pipelineId: text("pipeline_id")
    .notNull()
    .references(() => pipelines.id, { onDelete: "cascade" }),
  // agent/input/output/gate/human/skill/rule/tool
  type: text("type").notNull(),
  name: text("name").notNull(),
  positionX: doublePrecision("position_x").notNull(),
  positionY: doublePrecision("position_y").notNull(),
  // M4 결정 1·4-A: 참조+오버라이드 시맨틱.
  // null=맨손 노드(config 완결). non-null=정의 참조(config는 오버라이드 필드만).
  // 정의 삭제 시 SET NULL — 노드는 맨손으로 남는다.
  blockDefId: text("block_def_id").references(() => blockDefs.id, {
    onDelete: "set null",
  }),
  // 타입별 속성(nodes.md) — JSON. blockDefId 있으면 오버라이드 필드만.
  config: jsonb("config").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});

// ---------------------------------------------------------------------------
// edges
// ---------------------------------------------------------------------------
export const edges = pgTable("edges", {
  id: text("id").primaryKey(),
  pipelineId: text("pipeline_id")
    .notNull()
    .references(() => pipelines.id, { onDelete: "cascade" }),
  sourceNodeId: text("source_node_id").notNull(),
  targetNodeId: text("target_node_id").notNull(),
  // flow(실선). "mount"는 M4에서 Agent config.mounts 칩으로 대체된 레거시 값 —
  // 캔버스 렌더·자동정렬·검증에서 제외되며 신규 생성 경로 없음.
  kind: text("kind").notNull(),
  // Gate만 pass/fail
  sourceHandle: text("source_handle"),
  // Q11 입력 순번(엣지 클릭으로 조정)
  inputOrder: bigint("input_order", { mode: "number" }).notNull().default(0),
});

// ---------------------------------------------------------------------------
// block_defs — 팔레트 하위 항목(저장된 정의). M1 미사용.
// ---------------------------------------------------------------------------
export const blockDefs = pgTable("block_defs", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  config: jsonb("config").notNull(),
  // 하위 항목별 활성/비활성(Q10-B) — M4부터 미사용(마이그레이션 회피용 잔존).
  enabled: boolean("enabled").notNull().default(true),
  // human / chatbot / import
  origin: text("origin").notNull(),
  // true = 새 블록 트레이 대기(챗봇 add, 미승인). 캔버스 드래그 승인 시 false
  tray: boolean("tray").notNull().default(false),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  // Phase 2a: 소유자(nullable — Slice 4에서 NOT NULL 승격). FK→app_users.id
  ownerId: text("owner_id").references(() => appUsers.id),
});

// ---------------------------------------------------------------------------
// runs
// ---------------------------------------------------------------------------
export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  pipelineId: text("pipeline_id")
    .notNull()
    .references(() => pipelines.id, { onDelete: "cascade" }),
  // running / waiting_human / succeeded / failed / gate_failed / cancelled
  status: text("status").notNull(),
  // 시작 시 nodes+edges 전체 복사(JSON)
  graphSnapshot: jsonb("graph_snapshot").notNull(),
  // 부분 재실행 시 아티팩트 재사용 출처(직전 완료 run)
  upstreamRunId: text("upstream_run_id"),
  // M5 워크스트림 D: JD별 run 그룹핑용 자유 라벨(회사/직군명).
  // run 시작 시 Input 노드의 JD 문서 내용 첫 줄에서 자동 도출.
  label: text("label"),
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  endedAt: bigint("ended_at", { mode: "number" }),
  // Phase 2a: 소유자(nullable — Slice 4에서 NOT NULL 승격). FK→app_users.id
  // 러너가 요청 밖에서 행을 쓰므로 자체 owner_id 보유(auth.md §3·5).
  ownerId: text("owner_id").references(() => appUsers.id),
});

// ---------------------------------------------------------------------------
// node_runs — run별 노드 실행 기록
// ---------------------------------------------------------------------------
export const nodeRuns = pgTable("node_runs", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  // 스냅샷 내 노드 id
  nodeId: text("node_id").notNull(),
  // Gate 루프 회차(1부터)
  iteration: bigint("iteration", { mode: "number" }).notNull().default(1),
  // queued / running / waiting_human / succeeded / failed / skipped
  status: text("status").notNull(),
  // Gate 전용 라우팅 결정 — pass / fail. Gate 외 노드는 null.
  // Gate는 판정 후 항상 succeeded로 마감하므로 status로는 복원 불가(schema.md).
  gateDecision: text("gate_decision"),
  error: text("error"),
  startedAt: bigint("started_at", { mode: "number" }),
  endedAt: bigint("ended_at", { mode: "number" }),
});

// ---------------------------------------------------------------------------
// artifacts — 노드 실행 1회 = 아티팩트 1개
// ---------------------------------------------------------------------------
export const artifacts = pgTable("artifacts", {
  id: text("id").primaryKey(),
  nodeRunId: text("node_run_id")
    .notNull()
    .references(() => nodeRuns.id, { onDelete: "cascade" }),
  // markdown / json / html(Output)
  format: text("format").notNull(),
  // 스트리밍 중 주기적 append-flush, 완료 시 확정
  content: text("content").notNull().default(""),
  // Input: 문서 버전 번호 / Human: 편집 주체 등
  meta: jsonb("meta"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

// ---------------------------------------------------------------------------
// folders — 문서 임의 폴더 하이라키 (schema.md §folders)
// parent_id 자기참조 FK(nullable). 순환 금지·존재 검증은 앱 레벨 강제(방언 델타).
// ---------------------------------------------------------------------------
export const folders = pgTable("folders", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // 상위 폴더(null=루트 직속). 진짜 FK지만 순환 검증은 앱 레벨.
  parentId: text("parent_id").references((): AnyPgColumn => folders.id),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  // Phase 2a: 소유자(nullable — Slice 4에서 NOT NULL 승격). FK→app_users.id
  ownerId: text("owner_id").references(() => appUsers.id),
});

// ---------------------------------------------------------------------------
// documents / document_versions — 본문은 versions에만 존재
// ---------------------------------------------------------------------------
export const documents = pgTable("documents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // 현재 본문 = current_version 행
  currentVersion: bigint("current_version", { mode: "number" })
    .notNull()
    .default(0),
  // M5(v2→현행): 소속 폴더(null=루트). 진짜 FK, 앱 레벨 강제.
  folderId: text("folder_id").references(() => folders.id),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  // Phase 2a: 소유자(nullable — Slice 4에서 NOT NULL 승격). FK→app_users.id
  ownerId: text("owner_id").references(() => appUsers.id),
});

export const documentVersions = pgTable("document_versions", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  version: bigint("version", { mode: "number" }).notNull(),
  // 전문
  content: text("content").notNull(),
  // human / llm
  author: text("author").notNull(),
  // 변경 요약
  note: text("note"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

// ---------------------------------------------------------------------------
// chat_messages — 파이프라인당 1 스레드. M1 미사용.
// ---------------------------------------------------------------------------
export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  pipelineId: text("pipeline_id")
    .notNull()
    .references(() => pipelines.id, { onDelete: "cascade" }),
  // user / assistant / card_block / card_human / card_run
  kind: text("kind").notNull(),
  // 텍스트 또는 카드 데이터(JSON)
  payload: jsonb("payload").notNull(),
  runId: text("run_id"),
  nodeRunId: text("node_run_id"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
