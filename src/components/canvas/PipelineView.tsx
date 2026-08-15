// 캔버스 탭 본체 — 그래프 로딩 + Canvas 렌더만.
// M4: Palette/SidePanel/Resizer 제거. FileExplorer가 블록 소스, NodeEditor 탭이 속성 편집.
"use client";

import { useCallback, useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { api } from "@/lib/api";
import { useCanvasStore } from "@/store/canvas";
import {
  recallActiveRun,
  useRunStream,
} from "@/hooks/useRunStream";
import { Canvas, addBlockAtDefault } from "./Canvas";
import type { BlockDef, NodeType } from "@/lib/types";
import { makeNode } from "./blocks";
import styles from "./PipelineView.module.css";

interface Props {
  pipelineId: string;
  /** 채팅 독에서 Human 노드 카드로 스크롤 요청 시 호출 */
  onScrollToHumanCard?: (nodeId: string) => void;
  /** M4: 캔버스 노드 클릭 → 노드 에디터 탭 열기 (nodeId, blockDefId | null) */
  onNodeClick?: (nodeId: string, blockDefId: string | null) => void;
}

export function PipelineView({ pipelineId, onScrollToHumanCard, onNodeClick }: Props) {
  const setPipeline = useCanvasStore((s) => s.setPipeline);
  const addNode = useCanvasStore((s) => s.addNode);
  const [loaded, setLoaded] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const snapshotRunId = useCanvasStore((s) => s.snapshotRunId);
  const isSnapshot = !!snapshotRunId;

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

  // M4: FileExplorer에서 addBlock 요청 처리 (addBlockAtDefault로 캔버스 배치)
  const handleAddBlock = useCallback(
    (type: NodeType, blockDef?: BlockDef) => {
      const count = useCanvasStore.getState().nodes.length;
      const node = addBlockAtDefault(pipelineId, type, count);
      if (blockDef) {
        // 참조 노드 — blockDefId 연결, config는 빈 오버라이드.
        addNode({ ...node, name: blockDef.name, blockDefId: blockDef.id, config: {} });
      } else {
        // 빈 블록(정의 없음) — 맨손 노드(blockDefId=null, 기본 config).
        addNode(node);
      }
      // debounce 저장은 Canvas 내부에서 처리하므로 여기서는 직접 저장
      api.saveGraph(pipelineId, useCanvasStore.getState().nodes, useCanvasStore.getState().edges).catch(() => {});
    },
    [pipelineId, addNode],
  );

  // M4: 트레이 항목 드래그 드롭 승인
  const onTrayDrop = useCallback(
    async (blockDefId: string, pos: { x: number; y: number }) => {
      try {
        const res = await fetch(`/api/block-defs?all=1`);
        const defs: BlockDef[] = await res.json();
        const def = defs.find((d) => d.id === blockDefId);
        if (!def) return;
        // tray:false 처리(승인)
        await fetch(`/api/block-defs/${blockDefId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tray: false }),
        });
        // 참조 노드 생성
        const node = makeNode(pipelineId, def.type, pos.x, pos.y);
        addNode({ ...node, name: def.name, blockDefId: def.id, config: {} });
        api.saveGraph(pipelineId, useCanvasStore.getState().nodes, useCanvasStore.getState().edges).catch(() => {});
      } catch {
        // 무시
      }
    },
    [pipelineId, addNode],
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
        <Canvas
          onDownload={onDownload}
          onHumanClick={onHumanClick}
          readOnly={isSnapshot}
          onTrayDrop={onTrayDrop}
          onNodeClick={onNodeClick}
        />
      </div>
    </ReactFlowProvider>
  );
}

export { type Props as PipelineViewProps };
// M4: handleAddBlock은 AppShell에서 FileExplorer onAddBlock 연결 시 사용.
export { addBlockAtDefault };
