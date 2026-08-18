// run 스트림 — 접속 시 GET /api/runs/[id]로 상태 로드 후 SSE 구독,
// 끊기면 REST 재조회(진실=DB). run 상태는 서버가 준 것만 스토어에 반영.
"use client";

import { useEffect, useRef } from "react";
import { useCanvasStore, type RunView } from "@/store/canvas";
import type {
  Artifact,
  NodeRun,
  RunState,
  SequencedSseEvent,
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

    // 404는 "이 run은 없어졌다"(DB 리셋·owner 불일치)는 영구 신호 → 재시도 없이
    // 활성 run을 비우고 루프를 끊는다. null은 일시적 실패(오프라인 등) → 재시도.
    type Snapshot = { state: RunState; cursor: number };
    async function loadState(): Promise<Snapshot | "gone" | null> {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (res.status === 404) return "gone";
        if (!res.ok) return null;
        const cursor = Number(res.headers.get("X-Stream-Cursor") ?? "0");
        return {
          state: (await res.json()) as RunState,
          cursor: Number.isSafeInteger(cursor) ? cursor : 0,
        };
      } catch {
        return null;
      }
    }

    // run이 영구히 사라졌을 때: 재연결 타이머를 끊고 구독을 닫고
    // localStorage의 활성 run을 비운다. cancelled로 표시해 이후 async 콜백도 정지.
    function giveUp() {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      esRef.current?.close();
      esRef.current = null;
      if (pipelineId) rememberActiveRun(pipelineId, null);
    }

    async function refetchAndFinalize() {
      const snapshot = await loadState();
      if (cancelled) return;
      if (snapshot === "gone") {
        giveUp();
        return;
      }
      if (!snapshot) return;
      initRun(toRunView(snapshot.state));
    }

    function connect() {
      if (cancelled) return;

      // 스냅샷 적용 전 도착한 이벤트를 담아둔다(구독 선행 — engine.md §3).
      let pending: SequencedSseEvent[] | null = [];

      const es = new EventSource(`/api/runs/${runId}/events`);
      esRef.current = es;

      const applyEvent = (event: SequencedSseEvent) => {
        if (event.type === "run_status") {
          setRunStatus(event.status, event.progress);
          // 구독을 끊는 것은 종결 상태뿐. waiting_human은 유지해야
          // 다른 탭·채팅 독에서 승인했을 때 재개를 받는다.
          if (isTerminal(event.status)) {
            if (pipelineId) rememberActiveRun(pipelineId, null);
            if (retryTimer) {
              clearTimeout(retryTimer);
              retryTimer = null;
            }
            es.close();
            esRef.current = null;
            void refetchAndFinalize(); // 최종 아티팩트·노드 상태 확정
          }
          return;
        }
        if (event.type === "node_status") {
          setNodeStatus(event.nodeId, event.nodeRunId, event.status);
          return;
        }
        if (event.type === "artifact_delta") {
          // offset 병합이라 스냅샷과 겹치는 chunk를 다시 받아도 중복되지 않는다.
          const hasGap = appendArtifactDelta(
            event.nodeRunId,
            event.offset,
            event.chunk,
          );
          if (hasGap && esRef.current === es) {
            // 앞선 delta가 유실됐으면 추측해 이어 붙이지 않는다. 주기 flush가
            // DB에 반영될 시간을 준 뒤 새 구독+스냅샷 프로토콜로 복원한다.
            es.close();
            esRef.current = null;
            pending = null;
            retryTimer = setTimeout(connect, 1200);
          }
        }
      };

      const receive = (event: SequencedSseEvent) => {
        if (pending) pending.push(event);
        else applyEvent(event);
      };

      es.addEventListener("run_status", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SequencedSseEvent,
          { type: "run_status" }
        >;
        receive(d);
      });

      es.addEventListener("node_status", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SequencedSseEvent,
          { type: "node_status" }
        >;
        receive(d);
      });

      es.addEventListener("artifact_delta", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SequencedSseEvent,
          { type: "artifact_delta" }
        >;
        receive(d);
      });

      // 연결 끊김 → REST 재조회(진실=DB) 후 재연결.
      // EventSource 기본 재연결은 막고 직접 처리한다.
      es.onerror = () => {
        es.close();
        esRef.current = null;
        pending = null; // 이 연결의 버퍼 폐기 — 재연결이 새 스냅샷을 가져온다.
        if (cancelled) return;
        void loadState().then((snapshot) => {
          if (cancelled) return;
          // run이 사라졌으면(404) 무한 재연결하지 않고 정리한다.
          if (snapshot === "gone") {
            giveUp();
            return;
          }
          // 완전 오프라인이면 REST도 함께 실패한다. 이 경우에도 재시도해야
          // 네트워크 복구 뒤 새 SSE + 스냅샷으로 돌아올 수 있다.
          if (!snapshot) {
            retryTimer = setTimeout(connect, 2000);
            return;
          }
          initRun(toRunView(snapshot.state));
          // 아직 진행 중이면 다시 붙는다. 종결이면 그대로 끝.
          if (!isTerminal(snapshot.state.run.status)) {
            retryTimer = setTimeout(connect, 2000);
          } else if (pipelineId) {
            rememberActiveRun(pipelineId, null);
          }
        });
      };

      // 서버가 구독을 확정해 `open`을 보낸 뒤에만 스냅샷을 요청한다.
      // EventSource 생성 직후 fetch하면 SSE HTTP 연결이 아직 서버에 닿기 전일 수 있다.
      async function applySnapshot() {
        const snapshot = await loadState();
        if (cancelled || esRef.current !== es) return;
        if (snapshot === "gone") {
          giveUp();
          return;
        }
        if (!snapshot) {
          const buffered = pending ?? [];
          pending = null;
          for (const event of buffered) applyEvent(event);
          return;
        }
        const { state, cursor } = snapshot;
        initRun(toRunView(state));
        if (pipelineId) {
          rememberActiveRun(
            pipelineId,
            isTerminal(state.run.status) ? null : runId,
          );
        }
        // 스냅샷 이후 번호의 상태 이벤트만 적용한다. artifact_delta는 별도의
        // offset 병합을 쓰므로 cursor와 무관하게 안전하게 겹침을 제거한다.
        const buffered = pending ?? [];
        pending = null;
        for (const event of buffered) {
          if (event.type === "artifact_delta" || event.sequence > cursor) {
            applyEvent(event);
          }
        }

        // 이미 종결된 run이면 구독을 유지할 이유가 없다.
        if (isTerminal(state.run.status)) {
          if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
          }
          es.close();
          esRef.current = null;
        }
      }

      let snapshotStarted = false;
      es.onopen = () => {
        if (snapshotStarted) return;
        snapshotStarted = true;
        void applySnapshot();
      };
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
