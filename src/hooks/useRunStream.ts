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

/**
 * run이 종결됐는가. **waiting_human은 종결이 아니다** — 승인은 다른 탭이나
 * 채팅 독에서도 일어나므로 그때까지 SSE 구독을 유지해야 재개를 받는다
 * (engine.md §3 재구독 조건).
 */
function isTerminal(status: RunState["run"]["status"]): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
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
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

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

    function connect() {
      if (cancelled) return;

      // 스냅샷 적용 전 도착한 이벤트를 담아둔다(구독 선행 — engine.md §3).
      let pending: Array<() => void> | null = [];
      const apply = (fn: () => void) => {
        if (pending) pending.push(fn);
        else fn();
      };

      const es = new EventSource(`/api/runs/${runId}/events`);
      esRef.current = es;

      es.addEventListener("run_status", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SseEvent,
          { type: "run_status" }
        >;
        apply(() => {
          setRunStatus(d.status, d.progress);
          // 구독을 끊는 것은 종결 상태뿐. waiting_human은 유지해야
          // 다른 탭·채팅 독에서 승인했을 때 재개를 받는다.
          if (isTerminal(d.status)) {
            if (pipelineId) rememberActiveRun(pipelineId, null);
            es.close();
            esRef.current = null;
            void refetchAndFinalize(); // 최종 아티팩트·노드 상태 확정
          }
        });
      });

      es.addEventListener("node_status", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SseEvent,
          { type: "node_status" }
        >;
        apply(() => setNodeStatus(d.nodeId, d.nodeRunId, d.status));
      });

      es.addEventListener("artifact_delta", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SseEvent,
          { type: "artifact_delta" }
        >;
        apply(() => appendArtifactDelta(d.nodeRunId, d.chunk));
      });

      // 연결 끊김 → REST 재조회(진실=DB) 후 재연결.
      // EventSource 기본 재연결은 막고 직접 처리한다.
      es.onerror = () => {
        es.close();
        esRef.current = null;
        pending = null; // 이 연결의 버퍼 폐기 — 재연결이 새 스냅샷을 가져온다.
        if (cancelled) return;
        void loadState().then((state) => {
          if (cancelled || !state) return;
          initRun(toRunView(state));
          // 아직 진행 중이면 다시 붙는다. 종결이면 그대로 끝.
          if (!isTerminal(state.run.status)) {
            retryTimer = setTimeout(connect, 2000);
          } else if (pipelineId) {
            rememberActiveRun(pipelineId, null);
          }
        });
      };

      // 구독을 연 뒤 스냅샷을 받는다. 그 사이 도착분은 pending에 쌓인다.
      void (async () => {
        const state = await loadState();
        if (cancelled || esRef.current !== es) return;
        if (!state) {
          pending = null;
          return;
        }
        initRun(toRunView(state));
        if (pipelineId) {
          rememberActiveRun(pipelineId, isTerminal(state.run.status) ? null : runId);
        }
        // 스냅샷 → 버퍼 순으로 적용. 이후 도착분은 즉시 반영.
        const buffered = pending ?? [];
        pending = null;
        for (const fn of buffered) fn();

        // 이미 종결된 run이면 구독을 유지할 이유가 없다.
        if (isTerminal(state.run.status)) {
          es.close();
          esRef.current = null;
        }
      })();
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      esRef.current?.close();
      esRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, pipelineId]);
}
