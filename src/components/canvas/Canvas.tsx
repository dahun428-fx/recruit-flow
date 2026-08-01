// React Flow 캔버스 — 스토어 nodes/edges를 RF로 투영, 편집을 스토어에 반영.
// M2b: Gate/Human 노드, Pill 노드, 점선 mount 엣지, 배선 제약, 우클릭 부분재실행.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nanoid } from "nanoid";
import { api } from "@/lib/api";
import {
  NODE_COLOR,
  useCanvasStore,
  type NodeVisualStatus,
} from "@/store/canvas";
import type {
  AgentConfig,
  EdgeRow,
  GateConfig,
  InputConfig,
  NodeRow,
} from "@/lib/types";
import { EXEC_NODE_TYPES, MOUNT_NODE_TYPES } from "@/lib/types";
import { FlowNode, type FlowNodeData } from "./FlowNode";
import { PillNode, type PillNodeData } from "./PillNode";
import { MountEdge } from "./MountEdge";
import { DRAG_MIME, TRAY_DRAG_MIME, parseDropType } from "./Palette";
import { makeNode } from "./blocks";
import styles from "./Canvas.module.css";

const nodeTypes: NodeTypes = { rf: FlowNode, pill: PillNode };
const edgeTypes: EdgeTypes = { mount: MountEdge };

/** NodeRow → 한 줄 요약(카드 desc). */
function describe(node: NodeRow): string {
  if (node.type === "agent") {
    const c = node.config as AgentConfig;
    return c.role ? c.role.slice(0, 40) : "역할 미설정";
  }
  if (node.type === "input") {
    const c = node.config as InputConfig;
    if (c.documentId) return `문서: ${c.documentId}`;
    if (c.inlineText) return "인라인 텍스트";
    return "문서 미선택";
  }
  if (node.type === "gate") {
    const c = node.config as GateConfig;
    return c.expr || "조건식 미설정";
  }
  if (node.type === "human") return "사람 검토 대기";
  if (node.type === "skill") return "기술 장착";
  if (node.type === "rule") return "규칙 장착";
  if (node.type === "tool") return "도구 장착";
  return "템플릿: default";
}

interface Props {
  onDownload: (artifactId: string) => void;
  /** Human 노드 waiting_human 클릭 → 채팅 독 스크롤. */
  onHumanClick?: (nodeId: string) => void;
  /** 읽기 전용 스냅샷 모드. */
  readOnly?: boolean;
  /** 트레이 드래그 드롭 승인 시 blockDefId 전달 */
  onTrayDrop?: (blockDefId: string, pos: { x: number; y: number }) => void;
}

interface ContextMenu {
  nodeId: string;
  x: number;
  y: number;
}

export function Canvas({ onDownload, onHumanClick, readOnly, onTrayDrop }: Props) {
  const pipelineId = useCanvasStore((s) => s.pipelineId);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const run = useCanvasStore((s) => s.run);

  const moveNode = useCanvasStore((s) => s.moveNode);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const addNode = useCanvasStore((s) => s.addNode);
  const addEdge = useCanvasStore((s) => s.addEdge);
  const removeEdge = useCanvasStore((s) => s.removeEdge);
  const select = useCanvasStore((s) => s.select);

  const rf = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [partialRunning, setPartialRunning] = useState(false);

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    function onDown() {
      setContextMenu(null);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // ── debounce 저장 ──
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleSave = useCallback(() => {
    if (!pipelineId || readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const s = useCanvasStore.getState();
      if (!s.pipelineId) return;
      api.saveGraph(s.pipelineId, s.nodes, s.edges).catch(() => {});
    }, 600);
  }, [pipelineId, readOnly]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  // 노드 상태(진실=SSE/REST).
  const nodeStatus = run?.nodeStatus ?? {};
  const nodeRunId = run?.nodeRunId ?? {};
  const artifacts = run?.artifacts ?? {};

  // ── 스토어 → RF 노드/엣지 투영 ──
  const rfNodes: Node[] = useMemo(
    () =>
      nodes.map((n) => {
        const isMountNode = (MOUNT_NODE_TYPES as string[]).includes(n.type);
        if (isMountNode) {
          const data: PillNodeData = {
            type: n.type,
            name: n.name,
          };
          return {
            id: n.id,
            type: "pill",
            position: { x: n.positionX, y: n.positionY },
            data,
            selected: n.id === selectedNodeId,
          };
        }
        const status: NodeVisualStatus = nodeStatus[n.id] ?? "idle";
        const nrId = nodeRunId[n.id];
        const art = nrId ? artifacts[nrId] : undefined;
        const data: FlowNodeData = {
          type: n.type,
          name: n.name,
          desc: describe(n),
          status,
          downloadArtifactId:
            n.type === "output" && art && art.format === "html" ? art.id : null,
          onDownload,
          onHumanClick,
          nodeId: n.id,
        };
        return {
          id: n.id,
          type: "rf",
          position: { x: n.positionX, y: n.positionY },
          data,
          selected: n.id === selectedNodeId,
        };
      }),
    [nodes, nodeStatus, nodeRunId, artifacts, selectedNodeId, onDownload, onHumanClick],
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => {
        const isMountEdge = e.kind === "mount";
        if (isMountEdge) {
          return {
            id: e.id,
            source: e.sourceNodeId,
            target: e.targetNodeId,
            sourceHandle: "bottom",
            targetHandle: "top",
            type: "mount",
          };
        }
        // flow 엣지
        const targetStatus = nodeStatus[e.targetNodeId];
        // Gate의 pass/fail 소스 핸들
        const sourceHandle = e.sourceHandle ?? "right";
        return {
          id: e.id,
          source: e.sourceNodeId,
          target: e.targetNodeId,
          sourceHandle,
          targetHandle: "left",
          animated: targetStatus === "running",
          style: { stroke: "#9aa4b5", strokeWidth: 2 },
          label: e.sourceHandle === "pass" ? "pass" : e.sourceHandle === "fail" ? "fail" : undefined,
          labelStyle: { fontSize: 10, fill: "#7a8494" },
        };
      }),
    [edges, nodeStatus],
  );

  // ── RF 변경 → 스토어 반영 ──
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      if (readOnly) return;
      let mutated = false;
      for (const c of changes) {
        if (c.type === "position" && c.position && c.dragging === false) {
          moveNode(c.id, Math.round(c.position.x), Math.round(c.position.y));
          mutated = true;
        } else if (c.type === "position" && c.position && c.dragging) {
          moveNode(c.id, Math.round(c.position.x), Math.round(c.position.y));
        } else if (c.type === "remove") {
          removeNode(c.id);
          mutated = true;
        } else if (c.type === "select") {
          if (c.selected) select(c.id);
        }
      }
      if (mutated) scheduleSave();
    },
    [moveNode, removeNode, select, scheduleSave, readOnly],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (readOnly) return;
      let mutated = false;
      for (const c of changes) {
        if (c.type === "remove") {
          removeEdge(c.id);
          mutated = true;
        }
      }
      if (mutated) scheduleSave();
    },
    [removeEdge, scheduleSave, readOnly],
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (!pipelineId || !conn.source || !conn.target || readOnly) return;
      if (conn.source === conn.target) return;

      const state = useCanvasStore.getState();
      const sourceNode = state.nodes.find((n) => n.id === conn.source);
      const targetNode = state.nodes.find((n) => n.id === conn.target);
      if (!sourceNode || !targetNode) return;

      const srcIsMountType = (MOUNT_NODE_TYPES as string[]).includes(sourceNode.type);
      const tgtIsMountType = (MOUNT_NODE_TYPES as string[]).includes(targetNode.type);
      const srcIsExecType = (EXEC_NODE_TYPES as string[]).includes(sourceNode.type);
      const tgtIsExecType = (EXEC_NODE_TYPES as string[]).includes(targetNode.type);

      // 배선 제약:
      // - 장착 → 장착 금지
      // - 실행 → 장착 금지
      // - 장착은 Agent의 top 핸들에만 연결 가능
      if (srcIsMountType && tgtIsMountType) return;
      if (srcIsExecType && tgtIsMountType) return;
      if (srcIsMountType && !(targetNode.type === "agent" && conn.targetHandle === "top")) return;
      // 실행끼리 실선, Input에 대한 입력 핸들 없음
      if (targetNode.type === "input") return;
      // Output에서 출력 불가
      if (sourceNode.type === "output") return;

      const isMountEdge = srcIsMountType && targetNode.type === "agent";

      // 중복 엣지 방지
      const exists = state.edges.some(
        (e) => e.sourceNodeId === conn.source && e.targetNodeId === conn.target
          && (isMountEdge ? e.kind === "mount" : e.kind === "flow"),
      );
      if (exists) return;

      const order = state.edges.filter((e) => e.targetNodeId === conn.target).length;
      const edge: EdgeRow = {
        id: nanoid(),
        pipelineId,
        sourceNodeId: conn.source,
        targetNodeId: conn.target,
        kind: isMountEdge ? "mount" : "flow",
        sourceHandle: isMountEdge ? null : (conn.sourceHandle === "pass" ? "pass" : conn.sourceHandle === "fail" ? "fail" : null),
        inputOrder: order,
      };
      addEdge(edge);
      scheduleSave();
    },
    [pipelineId, addEdge, scheduleSave, readOnly],
  );

  // ── 드래그&드롭 추가 ──
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!pipelineId || readOnly) return;

      // U3: 트레이 드래그
      const trayId = e.dataTransfer.getData(TRAY_DRAG_MIME);
      if (trayId) {
        const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        onTrayDrop?.(trayId, { x: Math.round(pos.x), y: Math.round(pos.y) });
        return;
      }

      const key = e.dataTransfer.getData(DRAG_MIME);
      if (!key) return;
      const type = parseDropType(key);
      if (!type) return;
      const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const node = makeNode(
        pipelineId,
        type,
        Math.round(pos.x),
        Math.round(pos.y),
      );
      addNode(node);
      scheduleSave();
    },
    [pipelineId, rf, addNode, scheduleSave, readOnly, onTrayDrop],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  // ── 우클릭 → 부분 재실행 컨텍스트 메뉴 ──
  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault();
      const execNode = nodes.find((n) => n.id === node.id);
      if (!execNode) return;
      if ((MOUNT_NODE_TYPES as string[]).includes(execNode.type)) return;
      setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
    },
    [nodes],
  );

  const startPartialRun = useCallback(async () => {
    if (!pipelineId || !contextMenu) return;
    setContextMenu(null);
    setPartialRunning(true);
    try {
      const res = await fetch(`/api/pipelines/${pipelineId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_node_id: contextMenu.nodeId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        alert(err.error ?? "부분 재실행 실패");
      }
    } finally {
      setPartialRunning(false);
    }
  }, [pipelineId, contextMenu]);

  return (
    <div
      className={styles.wrap}
      ref={wrapRef}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {readOnly && (
        <div className={styles.snapshotHint}>
          과거 run 스냅샷 — 읽기 전용
        </div>
      )}
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={() => {
          select(null);
          setContextMenu(null);
        }}
        onNodeClick={(_, n) => {
          select(n.id);
          setContextMenu(null);
        }}
        onNodeContextMenu={readOnly ? undefined : onNodeContextMenu}
        fitView
        deleteKeyCode={readOnly ? [] : ["Backspace", "Delete"]}
        nodesDraggable={!readOnly}
        edgesReconnectable={!readOnly}
        nodesConnectable={!readOnly}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} color="#d6dae2" />
        <Controls showInteractive={false} />
      </ReactFlow>

      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={startPartialRun}
            disabled={partialRunning}
            data-tip="이 노드부터 하류만 재실행. 상류 아티팩트는 직전 완료 run에서 복사합니다"
          >
            {partialRunning ? "재실행 중…" : "이 노드부터 재실행"}
          </button>
        </div>
      )}
    </div>
  );
}

/** 더블클릭 추가 — 캔버스 빈자리(뷰포트 중앙 근처)에 배치. */
export function addBlockAtDefault(
  pipelineId: string,
  type: Parameters<typeof makeNode>[1],
  existingCount: number,
): NodeRow {
  const col = existingCount % 3;
  const row = Math.floor(existingCount / 3);
  return makeNode(pipelineId, type, 120 + col * 200, 80 + row * 130);
}
