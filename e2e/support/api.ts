// e2e API 헬퍼 — 배선은 API(그래프 PUT)로 세팅, UI는 렌더·실행·상태를 검증(플레이크 격리).
import type { APIRequestContext } from "@playwright/test";

export interface ENode {
  id: string;
  type: string;
  name: string;
  positionX?: number;
  positionY?: number;
  config: Record<string, unknown>;
}
export interface EEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  kind?: "flow" | "mount";
  sourceHandle?: null | "pass" | "fail";
  inputOrder?: number;
}

let seq = 0;
export const nid = (p = "n") => `${p}_${Date.now().toString(36)}_${seq++}`;

export async function createPipeline(
  request: APIRequestContext,
  name: string,
): Promise<string> {
  const res = await request.post("/api/pipelines", { data: { name } });
  if (!res.ok()) throw new Error(`createPipeline ${res.status()}`);
  return (await res.json()).id as string;
}

export async function createDocument(
  request: APIRequestContext,
  name: string,
  content: string,
): Promise<string> {
  const res = await request.post("/api/documents", { data: { name, content } });
  if (!res.ok()) throw new Error(`createDocument ${res.status()}`);
  return (await res.json()).id as string;
}

/** nodes/edges를 그래프로 통째 저장. pipelineId·좌표·기본값은 여기서 채움. */
export async function putGraph(
  request: APIRequestContext,
  pipelineId: string,
  nodes: ENode[],
  edges: EEdge[],
): Promise<void> {
  const fullNodes = nodes.map((n, i) => ({
    id: n.id,
    pipelineId,
    type: n.type,
    name: n.name,
    positionX: n.positionX ?? 60 + (i % 4) * 220,
    positionY: n.positionY ?? 60 + Math.floor(i / 4) * 140,
    config: n.config,
  }));
  const fullEdges = edges.map((e, i) => ({
    id: e.id ?? nid("e"),
    pipelineId,
    sourceNodeId: e.sourceNodeId,
    targetNodeId: e.targetNodeId,
    kind: e.kind ?? "flow",
    sourceHandle: e.sourceHandle ?? null,
    inputOrder: e.inputOrder ?? i,
  }));
  const res = await request.put(`/api/pipelines/${pipelineId}/graph`, {
    data: { nodes: fullNodes, edges: fullEdges },
  });
  if (!res.ok()) throw new Error(`putGraph ${res.status()} ${await res.text()}`);
}

export interface RunStateLite {
  run: { id: string; status: string };
  nodeRuns: { nodeId: string; iteration: number; status: string }[];
  artifacts: { nodeRunId: string; format: string; content: string }[];
}

export async function getRunState(
  request: APIRequestContext,
  runId: string,
): Promise<RunStateLite | null> {
  const res = await request.get(`/api/runs/${runId}`);
  if (!res.ok()) return null;
  return (await res.json()) as RunStateLite;
}

const TERMINAL = new Set(["succeeded", "failed", "cancelled", "gate_failed"]);

export async function waitForRun(
  request: APIRequestContext,
  runId: string,
  opts: { timeoutMs?: number; until?: (s: string) => boolean } = {},
): Promise<RunStateLite> {
  const timeout = opts.timeoutMs ?? 30_000;
  const until = opts.until ?? ((s) => TERMINAL.has(s));
  const start = Date.now();
  let last: RunStateLite | null = null;
  while (Date.now() - start < timeout) {
    last = await getRunState(request, runId);
    if (last && until(last.run.status)) return last;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`waitForRun timeout: ${runId} status=${last?.run.status}`);
}

/** POST /runs → {runId} | {errors}. */
export async function startRun(
  request: APIRequestContext,
  pipelineId: string,
  body: Record<string, unknown> = {},
): Promise<{ runId?: string; errors?: unknown[] }> {
  const res = await request.post(`/api/pipelines/${pipelineId}/runs`, {
    data: body,
  });
  return res.json();
}
