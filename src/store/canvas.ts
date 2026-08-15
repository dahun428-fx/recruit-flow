// Zustand 캔버스 스토어 — nodes/edges/선택/실행상태/패널폭 (m1-plan §store).
// 그래프 편집은 낙관적 갱신(debounce PUT). run 상태는 SSE/REST가 준 것만 반영.
"use client";

import { create } from "zustand";
import { mergeTextDelta } from "@/lib/stream-reconcile";
import type {
  Artifact,
  AgentConfig,
  EdgeRow,
  MountRef,
  NodeConfig,
  NodeRow,
  NodeRunStatus,
  NodeType,
  RunStatus,
} from "@/lib/types";

/** 노드별 실행 상태(진실=SSE/REST). idle=아직 이 run에 없음. */
export type NodeVisualStatus = NodeRunStatus | "idle";

/** run 실행 상태(클라이언트 표시용). */
export interface RunView {
  runId: string;
  status: RunStatus;
  progress: { done: number; total: number };
  /** nodeId → 최신 상태 */
  nodeStatus: Record<string, NodeVisualStatus>;
  /** nodeId → nodeRunId (최신 iteration) */
  nodeRunId: Record<string, string>;
  /** nodeRunId → 아티팩트(스트리밍 누적) */
  artifacts: Record<string, Artifact>;
}

interface CanvasState {
  pipelineId: string | null;
  nodes: NodeRow[];
  edges: EdgeRow[];
  selectedNodeId: string | null;

  run: RunView | null;

  /** 읽기 전용 스냅샷 모드 — null이면 현재 그래프. */
  snapshotRunId: string | null;

  // ── 그래프 초기화·편집(낙관적) ──
  setPipeline: (pipelineId: string, nodes: NodeRow[], edges: EdgeRow[]) => void;
  setNodes: (nodes: NodeRow[]) => void;
  setEdges: (edges: EdgeRow[]) => void;
  addNode: (node: NodeRow) => void;
  moveNode: (id: string, x: number, y: number) => void;
  updateNodeConfig: (id: string, config: Partial<NodeConfig>) => void;
  /** Agent 노드의 config.mounts 배열 갱신 (장착 칩 추가/제거). */
  updateAgentMounts: (agentNodeId: string, mounts: MountRef[]) => void;
  renameNode: (id: string, name: string) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: EdgeRow) => void;
  removeEdge: (id: string) => void;
  select: (id: string | null) => void;

  setSnapshotRunId: (runId: string | null) => void;

  // ── run 상태(진실=서버) ──
  initRun: (view: RunView | null) => void;
  setRunStatus: (status: RunStatus, progress: { done: number; total: number }) => void;
  setNodeStatus: (nodeId: string, nodeRunId: string, status: NodeRunStatus) => void;
  upsertArtifact: (artifact: Artifact) => void;
  /** offset 델타를 멱등 병합. true면 앞선 chunk 유실(gap). */
  appendArtifactDelta: (nodeRunId: string, offset: number, chunk: string) => boolean;
  clearRun: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  pipelineId: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  run: null,
  snapshotRunId: null,

  setPipeline: (pipelineId, nodes, edges) =>
    set({ pipelineId, nodes, edges, selectedNodeId: null, run: null, snapshotRunId: null }),

  setSnapshotRunId: (runId) => set({ snapshotRunId: runId }),

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node], selectedNodeId: node.id })),

  moveNode: (id, x, y) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, positionX: x, positionY: y } : n,
      ),
    })),

  updateNodeConfig: (id, config: Partial<NodeConfig>) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, config } : n)),
    })),

  updateAgentMounts: (agentNodeId, mounts) =>
    set((s) => ({
      nodes: s.nodes.map((n) => {
        if (n.id !== agentNodeId || n.type !== "agent") return n;
        const prevConfig = n.config as Partial<AgentConfig>;
        return { ...n, config: { ...prevConfig, mounts } };
      }),
    })),

  renameNode: (id, name) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, name } : n)),
    })),

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter(
        (e) => e.sourceNodeId !== id && e.targetNodeId !== id,
      ),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
    })),

  addEdge: (edge) => set((s) => ({ edges: [...s.edges, edge] })),
  removeEdge: (id) => set((s) => ({ edges: s.edges.filter((e) => e.id !== id) })),

  select: (id) => set({ selectedNodeId: id }),

  initRun: (view) => set({ run: view }),

  setRunStatus: (status, progress) =>
    set((s) => (s.run ? { run: { ...s.run, status, progress } } : {})),

  setNodeStatus: (nodeId, nodeRunId, status) =>
    set((s) => {
      if (!s.run) return {};
      return {
        run: {
          ...s.run,
          nodeStatus: { ...s.run.nodeStatus, [nodeId]: status },
          nodeRunId: { ...s.run.nodeRunId, [nodeId]: nodeRunId },
        },
      };
    }),

  upsertArtifact: (artifact) =>
    set((s) => {
      if (!s.run) return {};
      return {
        run: {
          ...s.run,
          artifacts: { ...s.run.artifacts, [artifact.nodeRunId]: artifact },
        },
      };
    }),

  appendArtifactDelta: (nodeRunId, offset, chunk) => {
    let hasGap = false;
    set((s) => {
      if (!s.run) {
        hasGap = offset !== 0;
        return {};
      }
      const prev = s.run.artifacts[nodeRunId];
      const merged = mergeTextDelta(prev?.content ?? "", offset, chunk);
      hasGap = merged.hasGap;
      if (hasGap || merged.content === prev?.content) return {};
      const next: Artifact = prev
        ? { ...prev, content: merged.content }
        : {
            id: `stream-${nodeRunId}`,
            nodeRunId,
            format: "markdown",
            content: merged.content,
            meta: null,
          };
      return {
        run: {
          ...s.run,
          artifacts: { ...s.run.artifacts, [nodeRunId]: next },
        },
      };
    });
    return hasGap;
  },

  clearRun: () => set({ run: null }),
}));

/** 노드 타입 → 헤더 색 CSS 변수. */
export const NODE_COLOR: Record<NodeType, string> = {
  input: "var(--c-input)",
  agent: "var(--c-agent)",
  output: "var(--c-output)",
  gate: "var(--c-gate)",
  human: "var(--c-human)",
  skill: "var(--c-mount)",
  rule: "var(--c-mount)",
  tool: "var(--c-mount)",
};
