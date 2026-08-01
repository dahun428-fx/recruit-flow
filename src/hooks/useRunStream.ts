// run 스트림 — 접속 시 GET /api/runs/[id]로 상태 로드 후 SSE 구독,
// 끊기면 REST 재조회(진실=DB). run 상태는 서버가 준 것만 스토어에 반영.
"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore, type RunView } from "@/store/canvas";
import type {
  Artifact,
  NodeRun,
  RunState,
  SseEvent,
} from "@/lib/types";

/** RunState(REST) → 스토어 RunView 형태로 접기. */
function toRunView(state: RunState): RunView {
  const nodeStatus: RunView["nodeStatus"] = {};
  const nodeRunId: RunView["nodeRunId"] = {};
  const artifactByNodeRun: Record<string, Artifact> = {};

  // node_run은 startedAt asc 정렬 → 뒤가 최신 iteration.
  for (const nr of state.nodeRuns as NodeRun[]) {
    nodeStatus[nr.nodeId] = nr.status;
    nodeRunId[nr.nodeId] = nr.id;
  }
  for (const a of state.artifacts) {
    artifactByNodeRun[a.nodeRunId] = a;
  }

  const total = state.nodeRuns.length;
  const done = state.nodeRuns.filter(
    (n) => n.status === "succeeded" || n.status === "skipped",
  ).length;

  return {
    runId: state.run.id,
    status: state.run.status,
    progress: { done, total },
    nodeStatus,
    nodeRunId,
    artifacts: artifactByNodeRun,
  };
}

const LS_ACTIVE_RUN = "rf.activeRun.";

/** 파이프라인의 활성 run id를 localStorage에 보존(새로고침 복원용). */
export function rememberActiveRun(pipelineId: string, runId: string | null) {
  if (typeof window === "undefined") return;
  if (runId) window.localStorage.setItem(LS_ACTIVE_RUN + pipelineId, runId);
  else window.localStorage.removeItem(LS_ACTIVE_RUN + pipelineId);
}

export function recallActiveRun(pipelineId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LS_ACTIVE_RUN + pipelineId);
}

/**
 * runId를 구독. runId 변경 시 REST 로드 → SSE 연결.
 * run이 종결(succeeded/failed/cancelled)되면 REST 재조회로 최종 상태 확정.
 */
export function useRunStream(runId: string | null, pipelineId: string | null) {
  const initRun = useCanvasStore((s) => s.initRun);
  const setRunStatus = useCanvasStore((s) => s.setRunStatus);
  const setNodeStatus = useCanvasStore((s) => s.setNodeStatus);
  const appendArtifactDelta = useCanvasStore((s) => s.appendArtifactDelta);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;

    async function loadState(): Promise<RunState | null> {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (!res.ok) return null;
        return (await res.json()) as RunState;
      } catch {
        return null;
      }
    }

    async function refetchAndFinalize() {
      const state = await loadState();
      if (cancelled || !state) return;
      initRun(toRunView(state));
    }

    (async () => {
      const state = await loadState();
      if (cancelled) return;
      if (!state) return;
      initRun(toRunView(state));
      if (pipelineId) {
        if (state.run.status === "running") rememberActiveRun(pipelineId, runId);
        else rememberActiveRun(pipelineId, null);
      }
      if (state.run.status !== "running") return; // 종결 → 구독 불필요

      const es = new EventSource(`/api/runs/${runId}/events`);
      esRef.current = es;

      es.addEventListener("run_status", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SseEvent,
          { type: "run_status" }
        >;
        setRunStatus(d.status, d.progress);
        if (d.status !== "running") {
          if (pipelineId) rememberActiveRun(pipelineId, null);
          es.close();
          // 최종 아티팩트·노드 상태 확정.
          void refetchAndFinalize();
        }
      });

      es.addEventListener("node_status", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SseEvent,
          { type: "node_status" }
        >;
        setNodeStatus(d.nodeId, d.nodeRunId, d.status);
      });

      es.addEventListener("artifact_delta", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SseEvent,
          { type: "artifact_delta" }
        >;
        appendArtifactDelta(d.nodeRunId, d.chunk);
      });

      // 연결 끊김 → REST 재조회(진실=DB). EventSource 기본 재연결은 막고 직접 처리.
      es.onerror = () => {
        es.close();
        esRef.current = null;
        void refetchAndFinalize();
      };
    })();

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, pipelineId]);
}
