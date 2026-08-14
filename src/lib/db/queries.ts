// DB 쿼리 레이어 — CRUD + 엔진 헬퍼.
// 반환은 API 경계 형태(types.ts, camelCase)로 정규화. 시각은 unixepoch ms.

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "./client";
import {
  artifacts,
  blockDefs,
  chatMessages,
  documents,
  documentVersions,
  edges,
  nodeRuns,
  nodes,
  runs,
} from "./schema";
import type {
  Artifact,
  ArtifactFormat,
  ArtifactMeta,
  BlockDef,
  ChatMessage,
  ChatMessageKind,
  Document,
  DocumentDetail,
  DocumentVersion,
  EdgeRow,
  Graph,
  NodeConfig,
  NodeRow,
  NodeRun,
  NodeRunStatus,
  NodeType,
  Pipeline,
  Run,
  RunStatus,
} from "../types";

const now = () => Date.now();

// ===========================================================================
// pipelines
// ===========================================================================

export function listPipelines(): Pipeline[] {
  return db
    .select()
    .from(pipelinesTable())
    .orderBy(desc(pipelinesTable().lastOpenedAt), desc(pipelinesTable().updatedAt))
    .all()
    .map(toPipeline);
}

export function getPipeline(id: string): Pipeline | null {
  const row = db.select().from(pipelinesTable()).where(eq(pipelinesTable().id, id)).get();
  return row ? toPipeline(row) : null;
}

export function createPipeline(name: string): Pipeline {
  const ts = now();
  const row = {
    id: nanoid(),
    name,
    createdAt: ts,
    updatedAt: ts,
    lastOpenedAt: ts,
  };
  db.insert(pipelinesTable()).values(row).run();
  return toPipeline(row);
}

export function updatePipeline(
  id: string,
  patch: { name?: string; lastOpenedAt?: number },
): Pipeline | null {
  const existing = getPipeline(id);
  if (!existing) return null;
  const next = {
    name: patch.name ?? existing.name,
    lastOpenedAt: patch.lastOpenedAt ?? existing.lastOpenedAt ?? undefined,
    updatedAt: now(),
  };
  db.update(pipelinesTable()).set(next).where(eq(pipelinesTable().id, id)).run();
  return getPipeline(id);
}

export function deletePipeline(id: string): boolean {
  const res = db.delete(pipelinesTable()).where(eq(pipelinesTable().id, id)).run();
  return res.changes > 0;
}

// ===========================================================================
// graph (nodes + edges)
// ===========================================================================

export function getGraph(pipelineId: string): Graph {
  const nodeRows = db
    .select()
    .from(nodes)
    .where(eq(nodes.pipelineId, pipelineId))
    .all();
  const edgeRows = db
    .select()
    .from(edges)
    .where(eq(edges.pipelineId, pipelineId))
    .all();
  return {
    nodes: nodeRows.map(toNodeRow),
    edges: edgeRows.map(toEdgeRow),
  };
}

/** nodes+edges를 트랜잭션으로 통째 replace(캔버스 일괄 저장). */
export function saveGraph(pipelineId: string, graph: Graph): void {
  const ts = now();
  db.transaction((tx) => {
    tx.delete(edges).where(eq(edges.pipelineId, pipelineId)).run();
    tx.delete(nodes).where(eq(nodes.pipelineId, pipelineId)).run();

    for (const n of graph.nodes) {
      tx.insert(nodes)
        .values({
          id: n.id || nanoid(),
          pipelineId,
          type: n.type,
          name: n.name,
          positionX: n.positionX,
          positionY: n.positionY,
          config: n.config,
          createdAt: ts,
          updatedAt: ts,
        })
        .run();
    }
    for (const e of graph.edges) {
      tx.insert(edges)
        .values({
          id: e.id || nanoid(),
          pipelineId,
          sourceNodeId: e.sourceNodeId,
          targetNodeId: e.targetNodeId,
          kind: e.kind ?? "flow",
          sourceHandle: e.sourceHandle ?? null,
          inputOrder: e.inputOrder ?? 0,
        })
        .run();
    }
    tx.update(pipelinesTable())
      .set({ updatedAt: ts })
      .where(eq(pipelinesTable().id, pipelineId))
      .run();
  });
}

// ===========================================================================
// documents / document_versions
// ===========================================================================

export function listDocuments(): Document[] {
  return db
    .select()
    .from(documents)
    .orderBy(desc(documents.createdAt))
    .all()
    .map(toDocument);
}

/** 문서 + 현재 본문(current_version 행). */
export function getDocument(id: string): DocumentDetail | null {
  const doc = db.select().from(documents).where(eq(documents.id, id)).get();
  if (!doc) return null;
  const ver = db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.documentId, id),
        eq(documentVersions.version, doc.currentVersion),
      ),
    )
    .get();
  return { ...toDocument(doc), content: ver?.content ?? "" };
}

/** 문서 생성 + v1 초기 버전. author 기본 'human'. */
export function createDocument(
  name: string,
  content: string,
  author: "human" | "llm" = "human",
  note?: string,
): DocumentDetail {
  const ts = now();
  const docId = nanoid();
  db.transaction((tx) => {
    tx.insert(documents)
      .values({ id: docId, name, currentVersion: 1, createdAt: ts })
      .run();
    tx.insert(documentVersions)
      .values({
        id: nanoid(),
        documentId: docId,
        version: 1,
        content,
        author,
        note: note ?? null,
        createdAt: ts,
      })
      .run();
  });
  return { id: docId, name, currentVersion: 1, createdAt: ts, content };
}

/** 새 버전 추가 → current_version 갱신. author 기본 'human'. */
export function addDocumentVersion(
  documentId: string,
  content: string,
  author: "human" | "llm" = "human",
  note?: string,
): DocumentDetail | null {
  const doc = db.select().from(documents).where(eq(documents.id, documentId)).get();
  if (!doc) return null;
  const nextVersion = doc.currentVersion + 1;
  const ts = now();
  db.transaction((tx) => {
    tx.insert(documentVersions)
      .values({
        id: nanoid(),
        documentId,
        version: nextVersion,
        content,
        author,
        note: note ?? null,
        createdAt: ts,
      })
      .run();
    tx.update(documents)
      .set({ currentVersion: nextVersion })
      .where(eq(documents.id, documentId))
      .run();
  });
  return getDocument(documentId);
}

export function listDocumentVersions(documentId: string): DocumentVersion[] {
  return db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.version))
    .all()
    .map(toDocumentVersion);
}

/** Input 노드가 실행 시점에 읽는 최신 버전(전문 + 버전 번호). */
export function getCurrentDocumentVersion(
  documentId: string,
): DocumentVersion | null {
  const doc = db.select().from(documents).where(eq(documents.id, documentId)).get();
  if (!doc) return null;
  const ver = db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.version, doc.currentVersion),
      ),
    )
    .get();
  return ver ? toDocumentVersion(ver) : null;
}

// ===========================================================================
// 엔진 헬퍼 — runs / node_runs / artifacts
// (행 쓰기는 engine-builder 코드가 이 헬퍼를 통해 수행)
// ===========================================================================

export function createRun(
  pipelineId: string,
  graphSnapshot: Graph,
  upstreamRunId?: string | null,
): Run {
  const ts = now();
  const row = {
    id: nanoid(),
    pipelineId,
    status: "running" as RunStatus,
    graphSnapshot,
    upstreamRunId: upstreamRunId ?? null,
    startedAt: ts,
    endedAt: null,
  };
  db.insert(runs).values(row).run();
  return toRun(row);
}

export function setRunStatus(
  runId: string,
  status: RunStatus,
  ended = status !== "running",
): void {
  db.update(runs)
    .set({ status, endedAt: ended ? now() : null })
    .where(eq(runs.id, runId))
    .run();
}

export function getRun(runId: string): Run | null {
  const row = db.select().from(runs).where(eq(runs.id, runId)).get();
  return row ? toRun(row) : null;
}

/** 시작 시 그래프 스냅샷 전체(엔진이 스케줄링에 사용). */
export function getRunSnapshot(runId: string): Graph | null {
  const row = db.select().from(runs).where(eq(runs.id, runId)).get();
  return row ? (row.graphSnapshot as Graph) : null;
}

/**
 * 같은 파이프라인의 활성 run(1개 제한 강제용).
 * M2: running ∪ waiting_human을 활성으로 취급(동시 run 1개, nodes.md §8).
 * 엔진·run 시작 검증이 공유한다.
 */
/** 파이프라인의 완료된 run 목록(최신순, 최대 20개). */
export function listRuns(pipelineId: string, limit = 20): Run[] {
  return db
    .select()
    .from(runs)
    .where(eq(runs.pipelineId, pipelineId))
    .orderBy(desc(runs.startedAt))
    .limit(limit)
    .all()
    .map(toRun);
}

export function getActiveRun(pipelineId: string): Run | null {
  const row = db
    .select()
    .from(runs)
    .where(
      and(
        eq(runs.pipelineId, pipelineId),
        inArray(runs.status, ["running", "waiting_human"]),
      ),
    )
    .orderBy(desc(runs.startedAt))
    .get();
  return row ? toRun(row) : null;
}

export function createNodeRun(
  runId: string,
  nodeId: string,
  status: NodeRunStatus = "queued",
  iteration = 1,
): NodeRun {
  const row = {
    id: nanoid(),
    runId,
    nodeId,
    iteration,
    status,
    // Gate 판정 시에만 채워진다(setNodeRunGateDecision).
    gateDecision: null as string | null,
    error: null as string | null,
    startedAt: status === "running" ? now() : null,
    endedAt: null as number | null,
  };
  db.insert(nodeRuns).values(row).run();
  return toNodeRun(row);
}

export function setNodeRunStatus(
  nodeRunId: string,
  status: NodeRunStatus,
  error?: string | null,
): NodeRun | null {
  const patch: Record<string, unknown> = { status };
  if (status === "running") patch.startedAt = now();
  if (status === "succeeded" || status === "failed" || status === "skipped") {
    patch.endedAt = now();
  }
  if (error !== undefined) patch.error = error;
  db.update(nodeRuns).set(patch).where(eq(nodeRuns.id, nodeRunId)).run();
  const row = db.select().from(nodeRuns).where(eq(nodeRuns.id, nodeRunId)).get();
  return row ? toNodeRun(row) : null;
}

/**
 * Gate 라우팅 결정을 node_run에 영속화(schema.md).
 * Gate는 판정 후 항상 succeeded로 마감하므로 status만으로는 pass/fail을
 * 복원할 수 없다 — 재시작·재하이드레이션이 이 값을 읽는다.
 */
export function setNodeRunGateDecision(
  nodeRunId: string,
  decision: "pass" | "fail",
): void {
  db.update(nodeRuns)
    .set({ gateDecision: decision })
    .where(eq(nodeRuns.id, nodeRunId))
    .run();
}

/** 노드 실행 1회 = 아티팩트 1개. 스트리밍 시작 시 빈 content로 생성. */
export function createArtifact(
  nodeRunId: string,
  format: ArtifactFormat,
  content = "",
  meta?: ArtifactMeta | null,
): Artifact {
  const row = {
    id: nanoid(),
    nodeRunId,
    format,
    content,
    meta: meta ?? null,
    createdAt: now(),
  };
  db.insert(artifacts).values(row).run();
  return toArtifact(row);
}

/** 스트리밍 flush — 누적 content 전체를 갱신(append-flush). */
export function updateArtifactContent(
  artifactId: string,
  content: string,
): void {
  db.update(artifacts).set({ content }).where(eq(artifacts.id, artifactId)).run();
}

/** 완료 시 확정(내용 + 선택적 meta). */
export function finalizeArtifact(
  artifactId: string,
  content: string,
  meta?: ArtifactMeta | null,
): void {
  const patch: Record<string, unknown> = { content };
  if (meta !== undefined) patch.meta = meta;
  db.update(artifacts).set(patch).where(eq(artifacts.id, artifactId)).run();
}

export function getArtifact(id: string): Artifact | null {
  const row = db.select().from(artifacts).where(eq(artifacts.id, id)).get();
  return row ? toArtifact(row) : null;
}

/** 특정 node_run의 아티팩트(1개). */
export function getArtifactByNodeRun(nodeRunId: string): Artifact | null {
  const row = db
    .select()
    .from(artifacts)
    .where(eq(artifacts.nodeRunId, nodeRunId))
    .get();
  return row ? toArtifact(row) : null;
}

/** run 복원 조회 — GET /api/runs/[id] (RunState). */
export function getRunState(runId: string): {
  run: Run;
  nodeRuns: NodeRun[];
  artifacts: Artifact[];
} | null {
  const run = getRun(runId);
  if (!run) return null;
  const nrRows = db
    .select()
    .from(nodeRuns)
    .where(eq(nodeRuns.runId, runId))
    .orderBy(asc(nodeRuns.startedAt))
    .all();
  const nrList = nrRows.map(toNodeRun);
  const artRows = nrList.length
    ? db
        .select()
        .from(artifacts)
        .where(inArray(artifacts.nodeRunId, nrList.map((nr) => nr.id)))
        .all()
    : [];
  return {
    run,
    nodeRuns: nrList,
    artifacts: artRows.map(toArtifact),
  };
}

/**
 * 부분 재실행 상류 복사 — 직전 완료 run(fromRunId)에서 nodeIds 집합의
 * succeeded node_run + 그 아티팩트를 새 run(newRunId)으로 복제한다.
 * 폐포(상류 전이 폐포) 계산은 엔진 몫 — 여기서는 주어진 nodeIds만 처리.
 * node_run은 iteration 유지, 새 id 발급. status=succeeded만 복사(회차별
 * 최신 succeeded 1개). 복사한 nodeId 목록을 반환(엔진이 큐잉 판단에 사용).
 */
export function copyUpstreamArtifacts(
  newRunId: string,
  fromRunId: string,
  nodeIds: string[],
): string[] {
  if (nodeIds.length === 0) return [];
  const ts = now();
  const copied: string[] = [];

  db.transaction((tx) => {
    const srcRuns = tx
      .select()
      .from(nodeRuns)
      .where(
        and(
          eq(nodeRuns.runId, fromRunId),
          eq(nodeRuns.status, "succeeded"),
          inArray(nodeRuns.nodeId, nodeIds),
        ),
      )
      .orderBy(asc(nodeRuns.iteration))
      .all();

    // 같은 nodeId에 여러 succeeded 행(Gate 루프)이 있으면 최신 iteration만.
    const latestByNode = new Map<string, NodeRunDbRow>();
    for (const nr of srcRuns) {
      const prev = latestByNode.get(nr.nodeId);
      if (!prev || nr.iteration >= prev.iteration) {
        latestByNode.set(nr.nodeId, nr);
      }
    }

    for (const src of latestByNode.values()) {
      const newNodeRunId = nanoid();
      tx.insert(nodeRuns)
        .values({
          id: newNodeRunId,
          runId: newRunId,
          nodeId: src.nodeId,
          iteration: src.iteration,
          status: "succeeded",
          error: null,
          startedAt: src.startedAt ?? ts,
          endedAt: src.endedAt ?? ts,
        })
        .run();

      const srcArts = tx
        .select()
        .from(artifacts)
        .where(eq(artifacts.nodeRunId, src.id))
        .all();
      for (const a of srcArts) {
        tx.insert(artifacts)
          .values({
            id: nanoid(),
            nodeRunId: newNodeRunId,
            format: a.format,
            content: a.content,
            meta: a.meta ?? null,
            createdAt: ts,
          })
          .run();
      }
      copied.push(src.nodeId);
    }
  });

  return copied;
}

// ===========================================================================
// block_defs — 팔레트 저장 정의(임포터·챗봇 산출)
// ===========================================================================

/**
 * 블록 정의 upsert(name+type 키 — 임포터 idempotent).
 * 기존 행이 있으면 description/config/origin/tray를 갱신하고 enabled·id는 유지.
 */
export function createBlockDef(input: {
  type: NodeType;
  name: string;
  description?: string;
  config: NodeConfig;
  origin: BlockDef["origin"];
  enabled?: boolean;
  tray?: boolean;
  /** true(기본)면 (type,name) upsert(임포터 idempotency). false면 항상 신규
   *  삽입 — 챗봇 add_block은 기존 승인 블록을 덮어쓰면 안 됨(결정 5 "add만"). */
  upsert?: boolean;
}): BlockDef {
  const existing =
    input.upsert === false
      ? undefined
      : db
          .select()
          .from(blockDefs)
          .where(
            and(eq(blockDefs.type, input.type), eq(blockDefs.name, input.name)),
          )
          .get();

  if (existing) {
    db.update(blockDefs)
      .set({
        description: input.description ?? null,
        config: input.config,
        origin: input.origin,
        tray: input.tray ?? existing.tray,
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      })
      .where(eq(blockDefs.id, existing.id))
      .run();
    return getBlockDef(existing.id) as BlockDef;
  }

  const row = {
    id: nanoid(),
    type: input.type,
    name: input.name,
    description: input.description ?? null,
    config: input.config,
    enabled: input.enabled ?? true,
    origin: input.origin,
    tray: input.tray ?? false,
    createdAt: now(),
  };
  db.insert(blockDefs).values(row).run();
  return toBlockDef(row);
}

/** enabledOnly=true면 팔레트 노출용(enabled 항목)만. tray 상관없이 전부 조회 옵션. */
export function listBlockDefs(opts?: { enabledOnly?: boolean }): BlockDef[] {
  const rows = opts?.enabledOnly
    ? db.select().from(blockDefs).where(eq(blockDefs.enabled, true)).all()
    : db.select().from(blockDefs).all();
  return rows
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(toBlockDef);
}

export function getBlockDef(id: string): BlockDef | null {
  const row = db.select().from(blockDefs).where(eq(blockDefs.id, id)).get();
  return row ? toBlockDef(row) : null;
}

export function setBlockDefEnabled(id: string, enabled: boolean): BlockDef | null {
  db.update(blockDefs).set({ enabled }).where(eq(blockDefs.id, id)).run();
  return getBlockDef(id);
}

/** 블록 정의 이름 변경. 팔레트 인라인 편집에서 호출. */
export function setBlockDefName(id: string, name: string): BlockDef | null {
  db.update(blockDefs).set({ name }).where(eq(blockDefs.id, id)).run();
  return getBlockDef(id);
}

/**
 * 트레이 승인(tray:false) 또는 트레이 대기(tray:true) 토글.
 * 챗봇이 add_block으로 트레이에 넣은 블록을 캔버스 드래그로 승인할 때 사용.
 */
export function setBlockDefTray(id: string, tray: boolean): BlockDef | null {
  db.update(blockDefs).set({ tray }).where(eq(blockDefs.id, id)).run();
  return getBlockDef(id);
}

export function deleteBlockDef(id: string): boolean {
  const res = db.delete(blockDefs).where(eq(blockDefs.id, id)).run();
  return res.changes > 0;
}

// ===========================================================================
// chat_messages — 파이프라인당 1 스레드(M2는 이벤트 카드만)
// ===========================================================================

/** 카드/메시지 1건 append. payload는 JSON(카드 데이터 또는 텍스트). */
export function appendChatMessage(
  pipelineId: string,
  kind: ChatMessageKind,
  payload: unknown,
  runId?: string | null,
  nodeRunId?: string | null,
  messageId?: string,
): ChatMessage {
  const row = {
    id: messageId ?? nanoid(),
    pipelineId,
    kind,
    payload,
    runId: runId ?? null,
    nodeRunId: nodeRunId ?? null,
    createdAt: now(),
  };
  db.insert(chatMessages).values(row).run();
  return toChatMessage(row);
}

/** 파이프라인 채팅 스레드(시간 오름차순). */
export function listChatMessages(pipelineId: string): ChatMessage[] {
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.pipelineId, pipelineId))
    .orderBy(asc(chatMessages.createdAt))
    .all()
    .map(toChatMessage);
}

// ===========================================================================
// 매핑 헬퍼 (DB row → API 경계 타입)
// ===========================================================================

// pipelines 테이블을 지연 참조(순환 import 회피용은 아니고 가독성).
import { pipelines as pipelinesSchema } from "./schema";
function pipelinesTable() {
  return pipelinesSchema;
}

type PipelineDbRow = typeof pipelinesSchema.$inferSelect;
function toPipeline(r: PipelineDbRow): Pipeline {
  return {
    id: r.id,
    name: r.name,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    lastOpenedAt: r.lastOpenedAt ?? null,
  };
}

type NodeDbRow = typeof nodes.$inferSelect;
function toNodeRow(r: NodeDbRow): NodeRow {
  return {
    id: r.id,
    pipelineId: r.pipelineId,
    type: r.type as NodeType,
    name: r.name,
    positionX: r.positionX,
    positionY: r.positionY,
    config: r.config as NodeConfig,
  };
}

type EdgeDbRow = typeof edges.$inferSelect;
function toEdgeRow(r: EdgeDbRow): EdgeRow {
  return {
    id: r.id,
    pipelineId: r.pipelineId,
    sourceNodeId: r.sourceNodeId,
    targetNodeId: r.targetNodeId,
    kind: r.kind as "flow",
    sourceHandle: (r.sourceHandle ?? null) as null,
    inputOrder: r.inputOrder,
  };
}

type RunDbRow = typeof runs.$inferSelect;
function toRun(r: Omit<RunDbRow, "graphSnapshot"> & { graphSnapshot?: unknown }): Run {
  return {
    id: r.id,
    pipelineId: r.pipelineId,
    status: r.status as RunStatus,
    upstreamRunId: r.upstreamRunId ?? null,
    startedAt: r.startedAt,
    endedAt: r.endedAt ?? null,
  };
}

type NodeRunDbRow = typeof nodeRuns.$inferSelect;
function toNodeRun(r: NodeRunDbRow): NodeRun {
  return {
    id: r.id,
    runId: r.runId,
    nodeId: r.nodeId,
    iteration: r.iteration,
    status: r.status as NodeRunStatus,
    gateDecision: (r.gateDecision as "pass" | "fail" | null) ?? null,
    error: r.error ?? null,
    startedAt: r.startedAt ?? null,
    endedAt: r.endedAt ?? null,
  };
}

type ArtifactDbRow = typeof artifacts.$inferSelect;
function toArtifact(r: ArtifactDbRow): Artifact {
  return {
    id: r.id,
    nodeRunId: r.nodeRunId,
    format: r.format as ArtifactFormat,
    content: r.content,
    meta: (r.meta ?? null) as ArtifactMeta | null,
  };
}

type BlockDefDbRow = typeof blockDefs.$inferSelect;
function toBlockDef(r: BlockDefDbRow): BlockDef {
  return {
    id: r.id,
    type: r.type as NodeType,
    name: r.name,
    description: r.description ?? "",
    config: r.config as NodeConfig,
    enabled: r.enabled,
    origin: r.origin as BlockDef["origin"],
    tray: r.tray,
    createdAt: r.createdAt,
  };
}

type ChatMessageDbRow = typeof chatMessages.$inferSelect;
function toChatMessage(r: ChatMessageDbRow): ChatMessage {
  return {
    id: r.id,
    pipelineId: r.pipelineId,
    kind: r.kind as ChatMessageKind,
    payload: r.payload,
    runId: r.runId ?? null,
    nodeRunId: r.nodeRunId ?? null,
    createdAt: r.createdAt,
  };
}

type DocumentDbRow = typeof documents.$inferSelect;
function toDocument(r: DocumentDbRow): Document {
  return {
    id: r.id,
    name: r.name,
    currentVersion: r.currentVersion,
    createdAt: r.createdAt,
  };
}

type DocumentVersionDbRow = typeof documentVersions.$inferSelect;
function toDocumentVersion(r: DocumentVersionDbRow): DocumentVersion {
  return {
    id: r.id,
    documentId: r.documentId,
    version: r.version,
    content: r.content,
    author: r.author as "human" | "llm",
    note: r.note ?? null,
    createdAt: r.createdAt,
  };
}
