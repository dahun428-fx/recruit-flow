// DB 쿼리 레이어 — CRUD + 엔진 헬퍼.
// 반환은 API 경계 형태(types.ts, camelCase)로 정규화. 시각은 unixepoch ms.
// 재플랫폼 Phase 1: postgres.js 드라이버는 async — 모든 쿼리 함수가 Promise 반환.

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getCurrentUserId, getDb } from "@/lib/auth/context";
import {
  artifacts,
  blockDefs,
  chatMessages,
  documents,
  documentVersions,
  edges,
  folders,
  nodeRuns,
  nodes,
  runs,
} from "./schema";
import type {
  AgentConfig,
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
  Folder,
  Graph,
  MountRef,
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
// resolveNodeConfig — 참조+오버라이드 시맨틱(M4 결정 1·4-A).
// runner가 스냅샷 생성 시 호출하는 헬퍼. DB 조회 있음(async).
// ===========================================================================

/**
 * 노드의 실효 config를 반환한다.
 *
 * - blockDefId === null(맨손 노드): node.config 그대로 반환.
 * - blockDefId !== null(정의 참조): block_def.config에 node.config 필드를
 *   덮어쓴 완결 config 반환(얕은 필드별 병합).
 *   Agent 타입이면 mounts 배열 각 MountRef도 resolve:
 *     각 MountRef의 blockDefId 정의 config에 MountRef.override를 병합.
 *
 * 정의 행이 DB에 없으면(삭제 경합 등) node.config를 그대로 반환한다(방어).
 */
export async function resolveNodeConfig(node: NodeRow): Promise<NodeConfig> {
  if (!node.blockDefId) {
    // 맨손 노드 — config가 완결
    return node.config as NodeConfig;
  }

  const def = await getBlockDef(node.blockDefId);
  if (!def) {
    // 정의가 없으면(SET NULL 경합 등) 보유 config 그대로
    return node.config as NodeConfig;
  }

  // 얕은 필드별 병합: 정의 config 위에 노드 오버라이드 덮어쓰기
  const merged = { ...def.config, ...(node.config as Partial<NodeConfig>) } as NodeConfig;

  // Agent 타입이면 mounts 배열도 resolve
  if (node.type === "agent") {
    const agentMerged = merged as AgentConfig;
    if (agentMerged.mounts && agentMerged.mounts.length > 0) {
      const resolvedMounts: MountRef[] = [];
      for (const mountRef of agentMerged.mounts) {
        const mountDef = await getBlockDef(mountRef.blockDefId);
        if (!mountDef) {
          resolvedMounts.push(mountRef); // 정의 없으면 ref 그대로
          continue;
        }
        // MountRef.override를 정의 config 위에 덮어쓰기
        const resolvedOverride = mountRef.override
          ? { ...mountDef.config, ...mountRef.override }
          : mountDef.config;
        // type·name도 박제 — deriveMounts가 DB 재조회 없이 자족(스냅샷 불변성).
        resolvedMounts.push({
          ...mountRef,
          type: mountDef.type as "skill" | "rule" | "tool",
          name: mountDef.name,
          override: resolvedOverride as MountRef["override"],
        });
      }
      agentMerged.mounts = resolvedMounts;
    }
  }

  return merged;
}

// ===========================================================================
// pipelines
// ===========================================================================

export async function listPipelines(): Promise<Pipeline[]> {
  const rows = await getDb()
    .select()
    .from(pipelinesTable())
    .where(eq(pipelinesTable().ownerId, getCurrentUserId()))
    .orderBy(desc(pipelinesTable().lastOpenedAt), desc(pipelinesTable().updatedAt));
  return rows.map(toPipeline);
}

export async function getPipeline(id: string): Promise<Pipeline | null> {
  const row = (
    await getDb().select().from(pipelinesTable()).where(and(eq(pipelinesTable().id, id), eq(pipelinesTable().ownerId, getCurrentUserId()))).limit(1)
  )[0];
  return row ? toPipeline(row) : null;
}

export async function createPipeline(name: string): Promise<Pipeline> {
  const ts = now();
  const row = {
    id: nanoid(),
    name,
    createdAt: ts,
    updatedAt: ts,
    lastOpenedAt: ts,
    ownerId: getCurrentUserId(),
  };
  await getDb().insert(pipelinesTable()).values(row);
  return toPipeline(row);
}

export async function updatePipeline(
  id: string,
  patch: { name?: string; lastOpenedAt?: number },
): Promise<Pipeline | null> {
  const existing = await getPipeline(id);
  if (!existing) return null;
  const next = {
    name: patch.name ?? existing.name,
    lastOpenedAt: patch.lastOpenedAt ?? existing.lastOpenedAt ?? undefined,
    updatedAt: now(),
  };
  await getDb().update(pipelinesTable()).set(next).where(eq(pipelinesTable().id, id));
  return getPipeline(id);
}

export async function deletePipeline(id: string): Promise<boolean> {
  const res = await getDb()
    .delete(pipelinesTable())
    .where(and(eq(pipelinesTable().id, id), eq(pipelinesTable().ownerId, getCurrentUserId())))
    .returning({ id: pipelinesTable().id });
  return res.length > 0;
}

// ===========================================================================
// graph (nodes + edges)
// ===========================================================================

export async function getGraph(pipelineId: string): Promise<Graph> {
  const nodeRows = await getDb()
    .select()
    .from(nodes)
    .where(eq(nodes.pipelineId, pipelineId));
  const edgeRows = await getDb()
    .select()
    .from(edges)
    .where(eq(edges.pipelineId, pipelineId));
  return {
    nodes: nodeRows.map(toNodeRow),
    edges: edgeRows.map(toEdgeRow),
  };
}

/** nodes+edges를 트랜잭션으로 통째 replace(캔버스 일괄 저장). */
export async function saveGraph(pipelineId: string, graph: Graph): Promise<void> {
  const ts = now();
  await getDb().transaction(async (tx) => {
    await tx.delete(edges).where(eq(edges.pipelineId, pipelineId));
    await tx.delete(nodes).where(eq(nodes.pipelineId, pipelineId));

    for (const n of graph.nodes) {
      await tx.insert(nodes).values({
        id: n.id || nanoid(),
        pipelineId,
        type: n.type,
        name: n.name,
        positionX: n.positionX,
        positionY: n.positionY,
        blockDefId: n.blockDefId ?? null,
        config: n.config,
        createdAt: ts,
        updatedAt: ts,
      });
    }
    for (const e of graph.edges) {
      await tx.insert(edges).values({
        id: e.id || nanoid(),
        pipelineId,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        kind: e.kind ?? "flow",
        sourceHandle: e.sourceHandle ?? null,
        inputOrder: e.inputOrder ?? 0,
      });
    }
    await tx
      .update(pipelinesTable())
      .set({ updatedAt: ts })
      .where(eq(pipelinesTable().id, pipelineId));
  });
}

// ===========================================================================
// documents / document_versions
// ===========================================================================

export async function listDocuments(): Promise<Document[]> {
  const rows = await getDb().select().from(documents).where(eq(documents.ownerId, getCurrentUserId())).orderBy(desc(documents.createdAt));
  return rows.map(toDocument);
}

/** 문서 + 현재 본문(current_version 행). */
export async function getDocument(id: string): Promise<DocumentDetail | null> {
  const doc = (await getDb().select().from(documents).where(and(eq(documents.id, id), eq(documents.ownerId, getCurrentUserId()))).limit(1))[0];
  if (!doc) return null;
  const ver = (
    await getDb()
      .select()
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.documentId, id),
          eq(documentVersions.version, doc.currentVersion),
        ),
      )
      .limit(1)
  )[0];
  return { ...toDocument(doc), content: ver?.content ?? "" };
}

/** 문서 생성 + v1 초기 버전. author 기본 'human'. */
export async function createDocument(
  name: string,
  content: string,
  author: "human" | "llm" = "human",
  note?: string,
  folderId?: string | null,
): Promise<DocumentDetail> {
  const ts = now();
  const docId = nanoid();
  await getDb().transaction(async (tx) => {
    await tx
      .insert(documents)
      .values({
        id: docId,
        name,
        currentVersion: 1,
        folderId: folderId ?? null,
        createdAt: ts,
        ownerId: getCurrentUserId(),
      });
    await tx.insert(documentVersions).values({
      id: nanoid(),
      documentId: docId,
      version: 1,
      content,
      author,
      note: note ?? null,
      createdAt: ts,
    });
  });
  return { id: docId, name, currentVersion: 1, folderId: folderId ?? null, createdAt: ts, content };
}

/** 새 버전 추가 → current_version 갱신. author 기본 'human'. */
export async function addDocumentVersion(
  documentId: string,
  content: string,
  author: "human" | "llm" = "human",
  note?: string,
): Promise<DocumentDetail | null> {
  // 소유자 필터 — 비소유자가 남의 문서에 버전을 쓰지 못하게 부모 조회에서 차단
  // (쓰기 전 차단; 러너/챗봇 edit_document·register_document도 요청 컨텍스트라 ALS 유효).
  const doc = (
    await getDb()
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.ownerId, getCurrentUserId())))
      .limit(1)
  )[0];
  if (!doc) return null;
  const nextVersion = doc.currentVersion + 1;
  const ts = now();
  await getDb().transaction(async (tx) => {
    await tx.insert(documentVersions).values({
      id: nanoid(),
      documentId,
      version: nextVersion,
      content,
      author,
      note: note ?? null,
      createdAt: ts,
    });
    await tx
      .update(documents)
      .set({ currentVersion: nextVersion })
      .where(eq(documents.id, documentId));
  });
  return getDocument(documentId);
}

/**
 * 문서 삭제. document_versions는 FK onDelete:"cascade"로 함께 삭제된다.
 * Input 노드 config.documentId 참조(JSON 필드)는 DB 제약 밖이므로
 * 삭제를 막지 않는다 — 해당 노드는 실행 시점에 "문서 없음"으로 실패한다.
 * 존재하지 않는 id면 false 반환.
 */
export async function deleteDocument(id: string): Promise<boolean> {
  const res = await getDb()
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.ownerId, getCurrentUserId())))
    .returning({ id: documents.id });
  return res.length > 0;
}

export async function listDocumentVersions(
  documentId: string,
): Promise<DocumentVersion[]> {
  const rows = await getDb()
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(desc(documentVersions.version));
  return rows.map(toDocumentVersion);
}

/** Input 노드가 실행 시점에 읽는 최신 버전(전문 + 버전 번호). */
export async function getCurrentDocumentVersion(
  documentId: string,
): Promise<DocumentVersion | null> {
  const doc = (
    await getDb().select().from(documents).where(eq(documents.id, documentId)).limit(1)
  )[0];
  if (!doc) return null;
  const ver = (
    await getDb()
      .select()
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.documentId, documentId),
          eq(documentVersions.version, doc.currentVersion),
        ),
      )
      .limit(1)
  )[0];
  return ver ? toDocumentVersion(ver) : null;
}

// ===========================================================================
// folders — 문서 임의 폴더 하이라키 (schema.md §folders)
// ===========================================================================

export async function listFolders(): Promise<Folder[]> {
  const rows = await getDb().select().from(folders).where(eq(folders.ownerId, getCurrentUserId())).orderBy(asc(folders.createdAt));
  return rows.map(toFolder);
}

export async function createFolder(
  name: string,
  parentId?: string | null,
): Promise<Folder> {
  const row = {
    id: nanoid(),
    name,
    parentId: parentId ?? null,
    createdAt: now(),
    ownerId: getCurrentUserId(),
  };
  await getDb().insert(folders).values(row);
  return toFolder(row);
}

export async function renameFolder(id: string, name: string): Promise<Folder | null> {
  // 소유자 검증을 WHERE에 포함 — 영향 행 0이면 비소유자 또는 존재하지 않음.
  const res = await getDb().update(folders).set({ name })
    .where(and(eq(folders.id, id), eq(folders.ownerId, getCurrentUserId())))
    .returning({ id: folders.id });
  if (res.length === 0) return null;
  const row = (await getDb().select().from(folders).where(and(eq(folders.id, id), eq(folders.ownerId, getCurrentUserId()))).limit(1))[0];
  return row ? toFolder(row) : null;
}

/**
 * 폴더 삭제 정책(schema.md §folders):
 *   - 하위 문서: folder_id → null(루트 이동, 비파괴)
 *   - 하위 폴더: parent_id → 삭제 폴더의 parent_id(조부모로 승격)
 *   - 그 후 폴더 행 삭제
 * 트랜잭션으로 원자 처리. 존재하지 않으면 false.
 */
export async function deleteFolder(id: string): Promise<boolean> {
  const target = (
    await getDb().select().from(folders).where(and(eq(folders.id, id), eq(folders.ownerId, getCurrentUserId()))).limit(1)
  )[0];
  if (!target) return false;

  await getDb().transaction(async (tx) => {
    // 하위 문서 → 루트(null)로 이동
    await tx
      .update(documents)
      .set({ folderId: null })
      .where(eq(documents.folderId, id));

    // 하위 폴더 → 조부모(target.parentId)로 승격
    await tx
      .update(folders)
      .set({ parentId: target.parentId })
      .where(eq(folders.parentId, id));

    // 폴더 행 삭제
    await tx.delete(folders).where(eq(folders.id, id));
  });

  return true;
}

/**
 * 문서의 folder_id 갱신.
 * folderId가 non-null이면 해당 폴더 존재 여부를 검증한다.
 * 존재하지 않는 문서이거나 폴더가 없으면 false.
 */
export async function moveDocument(
  docId: string,
  folderId: string | null,
): Promise<boolean> {
  const doc = (await getDb().select().from(documents).where(and(eq(documents.id, docId), eq(documents.ownerId, getCurrentUserId()))).limit(1))[0];
  if (!doc) return false;

  if (folderId !== null) {
    const folder = (
      await getDb().select().from(folders).where(and(eq(folders.id, folderId), eq(folders.ownerId, getCurrentUserId()))).limit(1)
    )[0];
    if (!folder) return false;
  }

  await getDb().update(documents).set({ folderId }).where(eq(documents.id, docId));
  return true;
}

/**
 * 폴더의 parent_id 갱신.
 * 순환 금지: parentId가 자기 자신이거나 자신의 후손이면 거부(false 반환).
 * parentId가 non-null이면 대상 폴더 존재 여부도 검증.
 */
export async function moveFolder(id: string, parentId: string | null): Promise<boolean> {
  const target = (await getDb().select().from(folders).where(and(eq(folders.id, id), eq(folders.ownerId, getCurrentUserId()))).limit(1))[0];
  if (!target) return false;

  if (parentId !== null) {
    // 자기 자신으로 이동 불가
    if (parentId === id) return false;

    // parentId가 실제 존재하는지 확인
    const newParent = (
      await getDb().select().from(folders).where(and(eq(folders.id, parentId), eq(folders.ownerId, getCurrentUserId()))).limit(1)
    )[0];
    if (!newParent) return false;

    // 순환 방지: parentId가 자신의 후손인지 조상 체인 순회로 판정
    // parentId의 조상을 따라 올라가며 id가 나오면 순환 → 거부
    let cursor: string | null = newParent.parentId;
    while (cursor !== null) {
      if (cursor === id) return false; // id가 parentId의 조상 체인에 존재 → 순환
      const row: { parentId: string | null } | undefined = (
        await getDb().select().from(folders).where(eq(folders.id, cursor)).limit(1)
      )[0];
      if (!row) break; // 끊김(방어)
      cursor = row.parentId;
    }
  }

  await getDb().update(folders).set({ parentId }).where(and(eq(folders.id, id), eq(folders.ownerId, getCurrentUserId())));
  return true;
}

// ===========================================================================
// 엔진 헬퍼 — runs / node_runs / artifacts
// (행 쓰기는 engine-builder 코드가 이 헬퍼를 통해 수행)
// ===========================================================================

/**
 * 스냅샷에서 JD 라벨을 도출한다.
 * 순서:
 *   1. Input 노드 중 name에 "JD"(대소문자 무관)가 포함된 것을 우선 선택.
 *      없으면 첫 번째 Input 노드를 선택.
 *   2. 선택된 Input 노드의 config.documentId로 document_versions를 읽어
 *      현재 본문(current_version)의 첫 비어있지 않은 줄을 반환.
 *   3. 줄 앞의 '#' 문자와 공백을 제거하고 60자로 truncate.
 *   4. 문서 없거나 줄을 추출 못 하면 null 반환.
 *
 * 러너 무변경 원칙: createRun 내부에서만 호출, 스냅샷 기반 순수 처리.
 */
async function deriveRunLabel(graphSnapshot: Graph): Promise<string | null> {
  const inputNodes = graphSnapshot.nodes.filter((n) => n.type === "input");
  if (inputNodes.length === 0) return null;

  // JD가 이름에 포함된 노드 우선, 없으면 첫 번째 input 노드
  const jdNode =
    inputNodes.find((n) => /jd/i.test(n.name)) ?? inputNodes[0];

  const cfg = jdNode.config as Partial<{ documentId?: string }>;
  const documentId = cfg.documentId;
  if (!documentId) return null;

  // 문서의 현재 버전 본문 조회
  const doc = (
    await getDb().select().from(documents).where(eq(documents.id, documentId)).limit(1)
  )[0];
  if (!doc) return null;

  const ver = (
    await getDb()
      .select()
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.documentId, documentId),
          eq(documentVersions.version, doc.currentVersion),
        ),
      )
      .limit(1)
  )[0];
  if (!ver) return null;

  // 첫 비어있지 않은 줄 — '#' 접두어·공백 제거
  for (const raw of ver.content.split("\n")) {
    const line = raw.replace(/^#+\s*/, "").trim();
    if (line.length > 0) {
      return line.slice(0, 60);
    }
  }
  return null;
}

export async function createRun(
  pipelineId: string,
  graphSnapshot: Graph,
  upstreamRunId?: string | null,
): Promise<Run> {
  const ts = now();
  // JD 문서 내용 첫 줄로 라벨 자동 도출(없으면 null)
  const label = await deriveRunLabel(graphSnapshot);
  const row = {
    id: nanoid(),
    pipelineId,
    status: "running" as RunStatus,
    graphSnapshot,
    upstreamRunId: upstreamRunId ?? null,
    label,
    startedAt: ts,
    endedAt: null,
    // 소유자 각인 — start/startFrom은 요청 컨텍스트(POST /runs·챗봇 trigger_run)라
    // ALS가 유효(postgres.js await 후에도 유지됨을 실증). 컨텍스트 밖이면 닫힌 실패.
    ownerId: getCurrentUserId(),
  };
  await getDb().insert(runs).values(row);
  return toRun(row);
}

export async function setRunStatus(
  runId: string,
  status: RunStatus,
  ended = status !== "running",
): Promise<void> {
  await getDb()
    .update(runs)
    .set({ status, endedAt: ended ? now() : null })
    .where(eq(runs.id, runId));
}

export async function getRun(runId: string): Promise<Run | null> {
  const row = (await getDb().select().from(runs).where(eq(runs.id, runId)).limit(1))[0];
  return row ? toRun(row) : null;
}

/** 시작 시 그래프 스냅샷 전체(엔진이 스케줄링에 사용). */
export async function getRunSnapshot(runId: string): Promise<Graph | null> {
  const row = (await getDb().select().from(runs).where(eq(runs.id, runId)).limit(1))[0];
  return row ? (row.graphSnapshot as Graph) : null;
}

/** 파이프라인의 완료된 run 목록(최신순, 최대 20개). */
export async function listRuns(pipelineId: string, limit = 20): Promise<Run[]> {
  const rows = await getDb()
    .select()
    .from(runs)
    .where(eq(runs.pipelineId, pipelineId))
    .orderBy(desc(runs.startedAt))
    .limit(limit);
  return rows.map(toRun);
}

/**
 * 같은 파이프라인의 활성 run(1개 제한 강제용).
 * M2: running ∪ waiting_human을 활성으로 취급(동시 run 1개, nodes.md §8).
 * 엔진·run 시작 검증이 공유한다.
 */
export async function getActiveRun(pipelineId: string): Promise<Run | null> {
  const row = (
    await getDb()
      .select()
      .from(runs)
      .where(
        and(
          eq(runs.pipelineId, pipelineId),
          inArray(runs.status, ["running", "waiting_human"]),
        ),
      )
      .orderBy(desc(runs.startedAt))
      .limit(1)
  )[0];
  return row ? toRun(row) : null;
}

export async function createNodeRun(
  runId: string,
  nodeId: string,
  status: NodeRunStatus = "queued",
  iteration = 1,
): Promise<NodeRun> {
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
  await getDb().insert(nodeRuns).values(row);
  return toNodeRun(row);
}

export async function setNodeRunStatus(
  nodeRunId: string,
  status: NodeRunStatus,
  error?: string | null,
): Promise<NodeRun | null> {
  const patch: Record<string, unknown> = { status };
  if (status === "running") patch.startedAt = now();
  if (status === "succeeded" || status === "failed" || status === "skipped") {
    patch.endedAt = now();
  }
  if (error !== undefined) patch.error = error;
  await getDb().update(nodeRuns).set(patch).where(eq(nodeRuns.id, nodeRunId));
  const row = (
    await getDb().select().from(nodeRuns).where(eq(nodeRuns.id, nodeRunId)).limit(1)
  )[0];
  return row ? toNodeRun(row) : null;
}

/**
 * Gate 라우팅 결정을 node_run에 영속화(schema.md).
 * Gate는 판정 후 항상 succeeded로 마감하므로 status만으로는 pass/fail을
 * 복원할 수 없다 — 재시작·재하이드레이션이 이 값을 읽는다.
 */
export async function setNodeRunGateDecision(
  nodeRunId: string,
  decision: "pass" | "fail",
): Promise<void> {
  await getDb()
    .update(nodeRuns)
    .set({ gateDecision: decision })
    .where(eq(nodeRuns.id, nodeRunId));
}

/** 노드 실행 1회 = 아티팩트 1개. 스트리밍 시작 시 빈 content로 생성. */
export async function createArtifact(
  nodeRunId: string,
  format: ArtifactFormat,
  content = "",
  meta?: ArtifactMeta | null,
): Promise<Artifact> {
  const row = {
    id: nanoid(),
    nodeRunId,
    format,
    content,
    meta: meta ?? null,
    createdAt: now(),
  };
  await getDb().insert(artifacts).values(row);
  return toArtifact(row);
}

/** 스트리밍 flush — 누적 content 전체를 갱신(append-flush). */
export async function updateArtifactContent(
  artifactId: string,
  content: string,
): Promise<void> {
  await getDb().update(artifacts).set({ content }).where(eq(artifacts.id, artifactId));
}

/** 완료 시 확정(내용 + 선택적 meta). */
export async function finalizeArtifact(
  artifactId: string,
  content: string,
  meta?: ArtifactMeta | null,
): Promise<void> {
  const patch: Record<string, unknown> = { content };
  if (meta !== undefined) patch.meta = meta;
  await getDb().update(artifacts).set(patch).where(eq(artifacts.id, artifactId));
}

export async function getArtifact(id: string): Promise<Artifact | null> {
  const row = (await getDb().select().from(artifacts).where(eq(artifacts.id, id)).limit(1))[0];
  return row ? toArtifact(row) : null;
}

/** 특정 node_run의 아티팩트(1개). */
export async function getArtifactByNodeRun(nodeRunId: string): Promise<Artifact | null> {
  const row = (
    await getDb().select().from(artifacts).where(eq(artifacts.nodeRunId, nodeRunId)).limit(1)
  )[0];
  return row ? toArtifact(row) : null;
}

/** run 복원 조회 — GET /api/runs/[id] (RunState). */
export async function getRunState(runId: string): Promise<{
  run: Run;
  nodeRuns: NodeRun[];
  artifacts: Artifact[];
} | null> {
  const run = await getRun(runId);
  if (!run) return null;
  const nrRows = await getDb()
    .select()
    .from(nodeRuns)
    .where(eq(nodeRuns.runId, runId))
    .orderBy(asc(nodeRuns.startedAt));
  const nrList = nrRows.map(toNodeRun);
  const artRows = nrList.length
    ? await getDb()
        .select()
        .from(artifacts)
        .where(
          inArray(
            artifacts.nodeRunId,
            nrList.map((nr) => nr.id),
          ),
        )
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
export async function copyUpstreamArtifacts(
  newRunId: string,
  fromRunId: string,
  nodeIds: string[],
): Promise<string[]> {
  if (nodeIds.length === 0) return [];
  const ts = now();
  const copied: string[] = [];

  await getDb().transaction(async (tx) => {
    const srcRuns = await tx
      .select()
      .from(nodeRuns)
      .where(
        and(
          eq(nodeRuns.runId, fromRunId),
          eq(nodeRuns.status, "succeeded"),
          inArray(nodeRuns.nodeId, nodeIds),
        ),
      )
      .orderBy(asc(nodeRuns.iteration));

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
      await tx.insert(nodeRuns).values({
        id: newNodeRunId,
        runId: newRunId,
        nodeId: src.nodeId,
        iteration: src.iteration,
        status: "succeeded",
        error: null,
        startedAt: src.startedAt ?? ts,
        endedAt: src.endedAt ?? ts,
      });

      const srcArts = await tx
        .select()
        .from(artifacts)
        .where(eq(artifacts.nodeRunId, src.id));
      for (const a of srcArts) {
        await tx.insert(artifacts).values({
          id: nanoid(),
          nodeRunId: newNodeRunId,
          format: a.format,
          content: a.content,
          meta: a.meta ?? null,
          createdAt: ts,
        });
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
export async function createBlockDef(input: {
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
}): Promise<BlockDef> {
  const currentUserId = getCurrentUserId();
  const existing =
    input.upsert === false
      ? undefined
      : (
          await getDb()
            .select()
            .from(blockDefs)
            .where(
              and(eq(blockDefs.type, input.type), eq(blockDefs.name, input.name), eq(blockDefs.ownerId, currentUserId)),
            )
            .limit(1)
        )[0];

  if (existing) {
    await getDb()
      .update(blockDefs)
      .set({
        description: input.description ?? null,
        config: input.config,
        origin: input.origin,
        tray: input.tray ?? existing.tray,
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      })
      .where(eq(blockDefs.id, existing.id));
    return (await getBlockDef(existing.id)) as BlockDef;
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
    ownerId: currentUserId,
  };
  await getDb().insert(blockDefs).values(row);
  return toBlockDef(row);
}

/** enabledOnly=true면 팔레트 노출용(enabled 항목)만. tray 상관없이 전부 조회 옵션. */
export async function listBlockDefs(opts?: {
  enabledOnly?: boolean;
}): Promise<BlockDef[]> {
  const rows = opts?.enabledOnly
    ? await getDb().select().from(blockDefs).where(and(eq(blockDefs.enabled, true), eq(blockDefs.ownerId, getCurrentUserId())))
    : await getDb().select().from(blockDefs).where(eq(blockDefs.ownerId, getCurrentUserId()));
  return rows.sort((a, b) => a.createdAt - b.createdAt).map(toBlockDef);
}

export async function getBlockDef(id: string): Promise<BlockDef | null> {
  const row = (await getDb().select().from(blockDefs).where(eq(blockDefs.id, id)).limit(1))[0];
  return row ? toBlockDef(row) : null;
}

export async function setBlockDefEnabled(
  id: string,
  enabled: boolean,
): Promise<BlockDef | null> {
  const res = await getDb().update(blockDefs).set({ enabled })
    .where(and(eq(blockDefs.id, id), eq(blockDefs.ownerId, getCurrentUserId())))
    .returning({ id: blockDefs.id });
  if (res.length === 0) return null;
  return getBlockDef(id);
}

/** 블록 정의 이름 변경. 팔레트 인라인 편집에서 호출. */
export async function setBlockDefName(id: string, name: string): Promise<BlockDef | null> {
  const res = await getDb().update(blockDefs).set({ name })
    .where(and(eq(blockDefs.id, id), eq(blockDefs.ownerId, getCurrentUserId())))
    .returning({ id: blockDefs.id });
  if (res.length === 0) return null;
  return getBlockDef(id);
}

/**
 * 정의 config 전체 교체(참조 시맨틱 결정 1 — 정의를 편집하는 유일한 진입점).
 * PATCH /api/block-defs/[id] { config }에서 호출.
 * 반환: 갱신된 BlockDef, 없으면 null.
 */
export async function updateBlockDefConfig(
  id: string,
  config: NodeConfig,
): Promise<BlockDef | null> {
  const res = await getDb().update(blockDefs).set({ config })
    .where(and(eq(blockDefs.id, id), eq(blockDefs.ownerId, getCurrentUserId())))
    .returning({ id: blockDefs.id });
  if (res.length === 0) return null;
  return getBlockDef(id);
}

/**
 * 트레이 승인(tray:false) 또는 트레이 대기(tray:true) 토글.
 * 챗봇이 add_block으로 트레이에 넣은 블록을 캔버스 드래그로 승인할 때 사용.
 */
export async function setBlockDefTray(id: string, tray: boolean): Promise<BlockDef | null> {
  const res = await getDb().update(blockDefs).set({ tray })
    .where(and(eq(blockDefs.id, id), eq(blockDefs.ownerId, getCurrentUserId())))
    .returning({ id: blockDefs.id });
  if (res.length === 0) return null;
  return getBlockDef(id);
}

export async function deleteBlockDef(id: string): Promise<boolean> {
  const res = await getDb()
    .delete(blockDefs)
    .where(and(eq(blockDefs.id, id), eq(blockDefs.ownerId, getCurrentUserId())))
    .returning({ id: blockDefs.id });
  return res.length > 0;
}

// ===========================================================================
// chat_messages — 파이프라인당 1 스레드(M2는 이벤트 카드만)
// ===========================================================================

/** 카드/메시지 1건 append. payload는 JSON(카드 데이터 또는 텍스트). */
export async function appendChatMessage(
  pipelineId: string,
  kind: ChatMessageKind,
  payload: unknown,
  runId?: string | null,
  nodeRunId?: string | null,
  messageId?: string,
): Promise<ChatMessage> {
  const row = {
    id: messageId ?? nanoid(),
    pipelineId,
    kind,
    payload,
    runId: runId ?? null,
    nodeRunId: nodeRunId ?? null,
    createdAt: now(),
  };
  await getDb().insert(chatMessages).values(row);
  return toChatMessage(row);
}

/** 파이프라인 채팅 스레드(시간 오름차순). */
export async function listChatMessages(pipelineId: string): Promise<ChatMessage[]> {
  const rows = await getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.pipelineId, pipelineId))
    .orderBy(asc(chatMessages.createdAt));
  return rows.map(toChatMessage);
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
    blockDefId: r.blockDefId ?? null,
    config: r.config as Partial<NodeConfig>,
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
    label: r.label ?? null,
    startedAt: r.startedAt,
    endedAt: r.endedAt ?? null,
    ownerId: r.ownerId ?? null,
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
    folderId: r.folderId ?? null,
    createdAt: r.createdAt,
  };
}

type FolderDbRow = typeof folders.$inferSelect;
function toFolder(r: FolderDbRow): Folder {
  return {
    id: r.id,
    name: r.name,
    parentId: r.parentId ?? null,
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
