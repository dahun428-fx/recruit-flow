// 캔버스 탭 본체 — 팔레트 | React Flow 캔버스 | 사이드 패널 3분할.
// M2b: 스냅샷 모드, Human 클릭 → 채팅 독 스크롤.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { api } from "@/lib/api";
import { useCanvasStore } from "@/store/canvas";
import { usePanelSize } from "@/hooks/usePanelWidth";
import {
  recallActiveRun,
  useRunStream,
} from "@/hooks/useRunStream";
import { useGraphSave } from "@/hooks/useGraphSave";
import { Palette } from "./Palette";
import { Canvas, addBlockAtDefault } from "./Canvas";
import { SidePanel } from "@/components/panel/SidePanel";
import { Resizer } from "@/components/shell/Resizer";
import type { NodeType } from "@/lib/types";
import styles from "./PipelineView.module.css";

interface Props {
  pipelineId: string;
  /** 채팅 독에서 Human 노드 카드로 스크롤 요청 시 호출 */
  onScrollToHumanCard?: (nodeId: string) => void;
}

export function PipelineView({ pipelineId, onScrollToHumanCard }: Props) {
  const setPipeline = useCanvasStore((s) => s.setPipeline);
  const addNode = useCanvasStore((s) => s.addNode);
  const [loaded, setLoaded] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const save = useGraphSave();

  const snapshotRunId = useCanvasStore((s) => s.snapshotRunId);
  const isSnapshot = !!snapshotRunId;

  const palette = usePanelSize("palette", {
    initial: 190,
    min: 150,
    maxVw: 0.55,
    grow: "left",
  });
  const side = usePanelSize("sidepanel", {
    initial: 340,
    min: 260,
    maxVw: 0.55,
    grow: "right",
  });

  // 그래프 로드 + lastOpenedAt 갱신 + 활성 run 복원.
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    (async () => {
      try {
        const graph = await api.getGraph(pipelineId);
        if (cancelled) return;
        setPipeline(pipelineId, graph.nodes, graph.edges);
        setLoaded(true);
        api.touchPipeline(pipelineId).catch(() => {});
        // 새로고침 복원: localStorage에 기억된 활성 run.
        setActiveRunId(recallActiveRun(pipelineId));
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pipelineId, setPipeline]);

  // 스냅샷 run 변경 시 해당 run의 상태 로드
  useEffect(() => {
    if (!snapshotRunId) return;
    // 스냅샷 run의 그래프 스냅샷이 있으면 로드(engine.md §snapshot).
    // 현재 엔진은 graphSnapshot을 저장하나, 여기서는 현재 그래프에 상태색만 표시.
    // RunState 로드 → initRun
    fetch(`/api/runs/${snapshotRunId}`)
      .then((r) => r.json())
      .then((state) => {
        const nodeStatus: Record<string, string> = {};
        const nodeRunId: Record<string, string> = {};
        const artifactByNodeRun: Record<string, unknown> = {};
        for (const nr of state.nodeRuns ?? []) {
          nodeStatus[nr.nodeId] = nr.status;
          nodeRunId[nr.nodeId] = nr.id;
        }
        for (const a of state.artifacts ?? []) {
          artifactByNodeRun[a.nodeRunId] = a;
        }
        const total = (state.nodeRuns ?? []).length;
        const done = (state.nodeRuns ?? []).filter(
          (n: { status: string }) => n.status === "succeeded" || n.status === "skipped",
        ).length;
        useCanvasStore.getState().initRun({
          runId: state.run.id,
          status: state.run.status,
          progress: { done, total },
          nodeStatus: nodeStatus as Record<string, import("@/lib/types").NodeRunStatus>,
          nodeRunId,
          artifacts: artifactByNodeRun as Record<string, import("@/lib/types").Artifact>,
        });
      })
      .catch(() => {});
  }, [snapshotRunId]);

  // 스토어의 run이 갱신되면(실행 시작) 그 runId를 구독 대상으로.
  const storeRunId = useCanvasStore((s) => s.run?.runId ?? null);
  useEffect(() => {
    if (storeRunId && !snapshotRunId) setActiveRunId(storeRunId);
  }, [storeRunId, snapshotRunId]);

  useRunStream(snapshotRunId ? null : activeRunId, pipelineId);

  // 더블클릭 추가 — 기존 노드 수 기준 배치.
  const onAddBlock = useCallback(
    (type: NodeType) => {
      const count = useCanvasStore.getState().nodes.length;
      const node = addBlockAtDefault(pipelineId, type, count);
      addNode(node);
      save();
    },
    [pipelineId, addNode, save],
  );

  // Output 다운로드 — 새 창으로 열어 브라우저 다운로드.
  const onDownload = useCallback((artifactId: string) => {
    window.open(`/api/artifacts/${artifactId}/download`, "_blank");
  }, []);

  // Human 노드 waiting 클릭 → 채팅 독으로 스크롤(전역 이벤트)
  const onHumanClick = useCallback(
    (nodeId: string) => {
      onScrollToHumanCard?.(nodeId);
      window.dispatchEvent(new CustomEvent("rf:humanNodeClick", { detail: { nodeId } }));
    },
    [onScrollToHumanCard],
  );

  if (!loaded) {
    return <div className={styles.loading}>파이프라인을 여는 중…</div>;
  }

  return (
    <ReactFlowProvider>
      <div className={styles.view}>
        {/* 스냅샷 모드일 때 팔레트 숨김 */}
        {!isSnapshot && (
          <>
            <div style={{ width: palette.size, flex: "none" }}>
              <Palette onAddBlock={onAddBlock} />
            </div>
            <Resizer vertical onMouseDown={palette.onMouseDown(true)} />
          </>
        )}

        <Canvas
          onDownload={onDownload}
          onHumanClick={onHumanClick}
          readOnly={isSnapshot}
        />

        <Resizer vertical onMouseDown={side.onMouseDown(true)} />
        <div style={{ width: side.size, flex: "none", display: "flex" }}>
          <SidePanel onDownload={onDownload} />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
