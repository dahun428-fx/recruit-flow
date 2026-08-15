// 공유 셸 — 상단 바 + 좌측 탐색기 + 중앙 탭 편집기 + 우측 채팅 패널.
// PR4: 3-zone IDE 레이아웃. children는 Next.js 호환용으로 유지하되 사용 안 함.
// M4: FileExplorer onAddBlock/onApproveTray → useCanvasStore에서 직접 처리.
"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TopBar } from "./TopBar";
import { FileExplorer } from "./FileExplorer";
import { TabEditor } from "./TabEditor";
import { ChatPanel } from "./ChatPanel";
import { Resizer } from "./Resizer";
import { usePanelSize } from "@/hooks/usePanelWidth";
import { useCanvasStore } from "@/store/canvas";
import { api } from "@/lib/api";
import type { BlockDef, NodeType } from "@/lib/types";
import { addBlockAtDefault } from "@/components/canvas/PipelineView";
import styles from "./AppShell.module.css";

export function AppShell({ children: _children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // 현재 열린 파이프라인 ID (URL 기반)
  const pipelineId = pathname?.startsWith("/pipelines/")
    ? pathname.split("/")[2] ?? null
    : null;

  const addNode = useCanvasStore((s) => s.addNode);
  const canvasPipelineId = useCanvasStore((s) => s.pipelineId);

  // 진입 라우팅
  useEffect(() => {
    if (pathname?.startsWith("/pipelines/")) return;
    let cancelled = false;
    (async () => {
      try {
        const pipelines = await api.listPipelines();
        if (cancelled) return;
        const sorted = [...pipelines].sort(
          (a, b) =>
            (b.lastOpenedAt ?? b.createdAt) - (a.lastOpenedAt ?? a.createdAt),
        );
        const target = sorted[0];
        if (target) {
          router.replace(`/pipelines/${target.id}`);
          return;
        }
        const created = await api.createPipeline("이력서 파이프라인 v1");
        if (!cancelled) router.replace(`/pipelines/${created.id}`);
      } catch {
        // 진입 실패 시 빈 셸 유지(치명적 아님).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  const explorer = usePanelSize("explorer", {
    initial: 220,
    min: 160,
    maxVw: 0.35,
    grow: "left",
  });
  const chat = usePanelSize("chatpanel", {
    initial: 320,
    min: 200,
    maxVw: 0.45,
    grow: "right",
  });

  // 문서 탭 열기 요청 상태 (FileExplorer → TabEditor 브릿지)
  const [docRequest, setDocRequest] = useState<{
    docId: string;
    name: string;
  } | null>(null);

  // 블록 정의 탭 열기 요청 상태 (FileExplorer / Canvas 노드 클릭 → TabEditor 브릿지)
  const [blockDefRequest, setBlockDefRequest] = useState<{
    defId: string;
    name: string;
  } | null>(null);

  // M4: FileExplorer에서 블록 추가 요청 — 스토어에 직접 addNode
  const handleAddBlock = useCallback(
    (type: NodeType, blockDef?: BlockDef) => {
      // 캔버스가 이 파이프라인으로 로드 완료된 뒤에만 추가한다. 로드 전
      // (store.pipelineId 미일치)에 추가하면 PipelineView의 그래프 로드
      // (setPipeline)가 스토어를 덮어써 방금 추가한 노드가 유실된다.
      if (!pipelineId || canvasPipelineId !== pipelineId) return;
      const pid = pipelineId;
      const count = useCanvasStore.getState().nodes.length;
      const node = addBlockAtDefault(pid, type, count);
      if (blockDef) {
        // 참조 노드 — blockDefId 연결, config는 빈 오버라이드.
        addNode({ ...node, name: blockDef.name, blockDefId: blockDef.id, config: {} });
      } else {
        // 빈 블록(정의 없음) — 맨손 노드(blockDefId=null, 기본 config).
        addNode(node);
      }
      // 즉시 저장
      const s = useCanvasStore.getState();
      if (s.pipelineId) {
        api.saveGraph(s.pipelineId, s.nodes, s.edges).catch(() => {});
      }
    },
    [canvasPipelineId, pipelineId, addNode],
  );

  // M4: FileExplorer 트레이 승인 — tray:false + 캔버스 기본 위치에 배치
  const handleApproveTray = useCallback(
    (blockDef: BlockDef) => {
      // 캔버스 로드 완료 후에만(위 handleAddBlock과 동일 이유).
      if (!pipelineId || canvasPipelineId !== pipelineId) return;
      const pid = pipelineId;
      const count = useCanvasStore.getState().nodes.length;
      const node = addBlockAtDefault(pid, blockDef.type, count);
      addNode({ ...node, name: blockDef.name, blockDefId: blockDef.id, config: {} });
      const s = useCanvasStore.getState();
      if (s.pipelineId) {
        api.saveGraph(s.pipelineId, s.nodes, s.edges).catch(() => {});
      }
    },
    [canvasPipelineId, pipelineId, addNode],
  );

  return (
    <div className={styles.shell}>
      <TopBar />
      <div className={styles.body}>
        {/* 좌측: 파일 탐색기 */}
        <div style={{ width: explorer.size, flex: "none", display: "flex" }}>
          <FileExplorer
            pipelineId={pipelineId}
            onOpenDocument={(docId, name) => setDocRequest({ docId, name })}
            onOpenBlockDef={(defId, name) => setBlockDefRequest({ defId, name })}
            onAddBlock={handleAddBlock}
            onApproveTray={handleApproveTray}
          />
        </div>
        <Resizer vertical onMouseDown={explorer.onMouseDown(true)} />

        {/* 중앙: 탭 편집기 */}
        <TabEditor
          openDocumentRequest={docRequest}
          onOpenDocumentHandled={() => setDocRequest(null)}
          openBlockDefRequest={blockDefRequest}
          onOpenBlockDefHandled={() => setBlockDefRequest(null)}
          onOpenBlockDef={(defId, name) => setBlockDefRequest({ defId, name })}
        />

        {/* 우측: 채팅 패널 (Resizer는 ChatPanel 내부에서 접힘 여부에 따라 조건부 렌더) */}
        <ChatPanel
          size={chat.size}
          onResizerMouseDown={chat.onMouseDown(true)}
        />
      </div>
    </div>
  );
}
