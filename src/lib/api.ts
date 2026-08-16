// 클라이언트 API 헬퍼 — fetch 얇은 래퍼. 서버 계약(types.ts)만 사용.
"use client";

import type {
  BlockDef,
  Document,
  DocumentDetail,
  EdgeRow,
  Folder,
  Graph,
  NodeConfig,
  NodeRow,
  NodeType,
  Pipeline,
  PipelineSummary,
  Run,
  RunStartResult,
} from "@/lib/types";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error((body as { error?: string }).error ?? res.statusText), {
      status: res.status,
      body,
    });
  }
  return (await res.json()) as T;
}

export const api = {
  listPipelines: () =>
    fetch("/api/pipelines").then((r) => json<PipelineSummary[]>(r)),
  createPipeline: (name: string) =>
    fetch("/api/pipelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => json<Pipeline>(r)),
  renamePipeline: (id: string, name: string) =>
    fetch(`/api/pipelines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => json<Pipeline>(r)),
  touchPipeline: (id: string) =>
    fetch(`/api/pipelines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastOpenedAt: Date.now() }),
    }).then((r) => json<Pipeline>(r)),

  getGraph: (id: string) =>
    fetch(`/api/pipelines/${id}/graph`).then((r) => json<Graph>(r)),
  saveGraph: (id: string, nodes: NodeRow[], edges: EdgeRow[]) =>
    fetch(`/api/pipelines/${id}/graph`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes, edges }),
    }).then((r) => json<{ ok: boolean }>(r)),

  listRuns: (pipelineId: string) =>
    fetch(`/api/pipelines/${pipelineId}/runs`).then((r) => json<Run[]>(r)),

  startRun: (pipelineId: string) =>
    fetch(`/api/pipelines/${pipelineId}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).then(async (r) => {
      // 400=검증실패(errors), 409=이미 실행중(runId 포함).
      const body = (await r.json().catch(() => ({}))) as RunStartResult & {
        error?: string;
        runId?: string;
      };
      return { status: r.status, body };
    }),
  cancelRun: (runId: string) =>
    fetch(`/api/runs/${runId}/cancel`, { method: "POST" }).then((r) =>
      json<{ ok: boolean }>(r),
    ),

  createBlockDef: (params: {
    type: NodeType;
    name: string;
    description: string;
    config: NodeConfig;
    origin: "human" | "chatbot" | "import";
    tray: boolean;
  }) =>
    fetch("/api/block-defs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }).then((r) => json<BlockDef>(r)),

  getPipeline: (id: string) =>
    fetch(`/api/pipelines/${id}`).then((r) => json<Pipeline>(r)),

  listDocuments: () =>
    fetch("/api/documents").then((r) => json<Document[]>(r)),
  createDocument: (name: string, content: string, note?: string) =>
    fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, content, note }),
    }).then((r) => json<DocumentDetail>(r)),
  getDocument: (id: string) =>
    fetch(`/api/documents/${id}`).then((r) => json<DocumentDetail>(r)),
  saveDocument: (id: string, content: string, note?: string) =>
    fetch(`/api/documents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, note }),
    }).then((r) => json<DocumentDetail>(r)),
  deleteDocument: (id: string) =>
    fetch(`/api/documents/${id}`, { method: "DELETE" }).then((r) =>
      json<{ ok: boolean }>(r),
    ),
  /** 문서를 지정 폴더로 이동. folderId=null이면 루트로 이동. */
  moveDocument: (id: string, folderId: string | null) =>
    fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    }).then((r) => json<{ ok: boolean }>(r)),

  // -------------------------------------------------------------------------
  // 폴더
  // -------------------------------------------------------------------------
  listFolders: () =>
    fetch("/api/folders").then((r) => json<Folder[]>(r)),
  createFolder: (name: string, parentId?: string | null) =>
    fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId }),
    }).then((r) => json<Folder>(r)),
  renameFolder: (id: string, name: string) =>
    fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => json<Folder>(r)),
  deleteFolder: (id: string) =>
    fetch(`/api/folders/${id}`, { method: "DELETE" }).then((r) =>
      json<{ ok: boolean }>(r),
    ),
  moveFolder: (id: string, parentId: string | null) =>
    fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId }),
    }).then((r) => json<Folder>(r)),
};
