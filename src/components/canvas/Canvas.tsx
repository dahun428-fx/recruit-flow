// React Flow 캔버스 — 스토어 nodes/edges를 RF로 투영, 편집을 스토어에 반영.
// M4: PillNode/MountEdge 폐기, 팔레트 skill/rule/tool → Agent 드래그 장착.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Panel,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
  useReactFlow,
  useNodesInitialized,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nanoid } from "nanoid";
import { api } from "@/lib/api";
import {
  useCanvasStore,
  type NodeVisualStatus,
} from "@/store/canvas";
import type {
  AgentConfig,
  BlockDef,
  EdgeRow,
  GateConfig,
  InputConfig,
  MountRef,
  NodeRow,
} from "@/lib/types";
import { MOUNT_NODE_TYPES } from "@/lib/types";
import { FlowNode, type FlowNodeData } from "./FlowNode";
import { DRAG_MIME, TRAY_DRAG_MIME, parseDropType } from "@/lib/drag";
import { makeNode } from "./blocks";
import styles from "./Canvas.module.css";

const nodeTypes: NodeTypes = { rf: FlowNode };
const edgeTypes: EdgeTypes = {};

/** NodeRow → 한 줄 요약(카드 desc).
 * 참조 노드(blockDefId≠null)는 정의 config와 인스턴스 config를 merge해 표시한다(결정 1).
 */
function describe(
  node: NodeRow,
  defConfigMap?: Record<string, import("@/lib/types").NodeConfig>,
): string {
  // 참조 노드: 정의 config를 베이스로 인스턴스 오버라이드를 병합.
  const resolvedConfig =
    node.blockDefId && defConfigMap?.[node.blockDefId]
      ? { ...defConfigMap[node.blockDefId], ...node.config }
      : node.config;

  if (node.type === "agent") {
    const c = resolvedConfig as AgentConfig;
    return c.role ? c.role.slice(0, 40) : "역할 미설정";
  }
  if (node.type === "input") {
    const c = resolvedConfig as InputConfig;
    if (c.documentId) return `문서: ${c.documentId}`;
    if (c.inlineText) return "인라인 텍스트";
    return "문서 미선택";
  }
  if (node.type === "gate") {
    const c = resolvedConfig as GateConfig;
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
  /** M4: 노드 클릭 → 정의 파일 탭 열기 (nodeId, blockDefId | null) */
  onNodeClick?: (nodeId: string, blockDefId: string | null) => void;
}

interface ContextMenu {
  nodeId: string;
  x: number;
  y: number;
}

interface EdgeContextMenu {
  edgeId: string;
  x: number;
  y: number;
}

export function Canvas({ onDownload, onHumanClick, readOnly, onTrayDrop, onNodeClick }: Props) {
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
  const updateAgentMounts = useCanvasStore((s) => s.updateAgentMounts);

  const rf = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);

  // 초기 진입 시 노드를 뷰에 맞춘다. ReactFlow의 `fitView` prop은 초기 1회만
  // 실행돼, 스토어 노드가 비동기로 채워지면 빈 노드셋에 fitView가 걸려 노드가
  // 뷰 밖(hidden)에 남는 레이스가 있었다(e2e ~25% flake). 노드 "측정 완료"
  // (useNodesInitialized) 시점에 한 번 더 맞춰 안정화한다. 이후 사용자의 추가
  // 배치는 didFit 가드로 뷰를 흔들지 않는다.
  const nodesInitialized = useNodesInitialized();
  const didFitRef = useRef(false);
  useEffect(() => {
    if (didFitRef.current || !nodesInitialized) return;
    if (rf.getNodes().length === 0) return;
    didFitRef.current = true;
    rf.fitView({ padding: 0.2 });
  }, [nodesInitialized, rf]);

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<EdgeContextMenu | null>(null);
  const [partialRunning, setPartialRunning] = useState(false);
  const [partialError, setPartialError] = useState<string | null>(null);

  // M4: blockDef 캐시(장착 칩 라벨용 + 참조 노드 config resolve용).
  const [blockDefMap, setBlockDefMap] = useState<Record<string, { name: string; type: string }>>({});
  // 참조 노드 config resolve용: blockDefId → 정의 config
  const [defConfigMap, setDefConfigMap] = useState<Record<string, import("@/lib/types").NodeConfig>>({});

  const loadBlockDefs = useCallback(() => {
    fetch("/api/block-defs?all=1")
      .then((r) => r.json())
      .then((defs: BlockDef[]) => {
        const m: Record<string, { name: string; type: string }> = {};
        const cm: Record<string, import("@/lib/types").NodeConfig> = {};
        for (const d of defs) {
          m[d.id] = { name: d.name, type: d.type };
          cm[d.id] = d.config;
        }
        setBlockDefMap(m);
        setDefConfigMap(cm);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadBlockDefs();
  }, [loadBlockDefs]);

  // block_def 변경 이벤트 → 재조회(정의 수정 → 캔버스 참조 노드 재렌더).
  useEffect(() => {
    window.addEventListener("rf:blockDefsChanged", loadBlockDefs);
    return () => window.removeEventListener("rf:blockDefsChanged", loadBlockDefs);
  }, [loadBlockDefs]);

  // 컨텍스트 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    function onDown() {
      setContextMenu(null);
      setEdgeContextMenu(null);
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

  // M4: Agent 장착 해제 핸들러
  const handleRemoveMount = useCallback(
    (agentNodeId: string, blockDefId: string) => {
      if (readOnly) return;
      const agentNode = useCanvasStore.getState().nodes.find((n) => n.id === agentNodeId);
      if (!agentNode || agentNode.type !== "agent") return;
      const prevConfig = agentNode.config as Partial<AgentConfig>;
      const prevMounts = prevConfig.mounts ?? [];
      const nextMounts = prevMounts.filter((m) => m.blockDefId !== blockDefId);
      updateAgentMounts(agentNodeId, nextMounts);
      scheduleSave();
    },
    [readOnly, updateAgentMounts, scheduleSave],
  );

  // ── 스토어 → RF 노드/엣지 투영 ──
  const rfNodes: Node[] = useMemo(
    () =>
      nodes
        // M4: skill/rule/tool 독립 캔버스 노드는 렌더하지 않음
        .filter((n) => !(MOUNT_NODE_TYPES as string[]).includes(n.type))
        .map((n) => {
          const status: NodeVisualStatus = nodeStatus[n.id] ?? "idle";
          const nrId = nodeRunId[n.id];
          const art = nrId ? artifacts[nrId] : undefined;
          const agentConfig = n.type === "agent" ? (n.config as Partial<AgentConfig>) : null;
          const data: FlowNodeData = {
            type: n.type,
            name: n.name,
            desc: describe(n, defConfigMap),
            status,
            downloadArtifactId:
              n.type === "output" && art && art.format === "html" ? art.id : null,
            onDownload,
            onHumanClick,
            nodeId: n.id,
            mounts: agentConfig?.mounts,
            mountDefMap: blockDefMap,
            onRemoveMount: handleRemoveMount,
            onNodeClick,
            blockDefId: n.blockDefId,
          };
          return {
            id: n.id,
            type: "rf",
            position: { x: n.positionX, y: n.positionY },
            data,
            selected: n.id === selectedNodeId,
          };
        }),
    [nodes, nodeStatus, nodeRunId, artifacts, selectedNodeId, onDownload, onHumanClick, blockDefMap, defConfigMap, handleRemoveMount, onNodeClick],
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      edges
        // M4: mount 엣지는 칩으로 대체 — 렌더하지 않음
        .filter((e) => e.kind !== "mount")
        .map((e) => {
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

      // M4: 장착 계층 노드는 캔버스에 독립 배치하지 않으므로 연결 불가
      if ((MOUNT_NODE_TYPES as string[]).includes(sourceNode.type)) return;
      if ((MOUNT_NODE_TYPES as string[]).includes(targetNode.type)) return;

      // 실행 계층 배선 제약
      if (targetNode.type === "input") return;
      if (sourceNode.type === "output") return;

      // 중복 엣지 방지
      const exists = state.edges.some(
        (e) => e.sourceNodeId === conn.source && e.targetNodeId === conn.target && e.kind === "flow",
      );
      if (exists) return;

      const order = state.edges.filter((e) => e.targetNodeId === conn.target).length;
      const edge: EdgeRow = {
        id: nanoid(),
        pipelineId,
        sourceNodeId: conn.source,
        targetNodeId: conn.target,
        kind: "flow",
        sourceHandle: conn.sourceHandle === "pass" ? "pass" : conn.sourceHandle === "fail" ? "fail" : null,
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

      // M4 결정 3: skill/rule/tool은 캔버스 단독 배치 불가 → 드롭 대상 Agent에 장착
      if ((MOUNT_NODE_TYPES as string[]).includes(type)) {
        // 드롭 좌표 근처 Agent 노드 탐색(RF 좌표계)
        const dropPos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        const state = useCanvasStore.getState();
        // 반경 120px 내 가장 가까운 Agent 노드
        let closest: NodeRow | null = null;
        let minDist = Infinity;
        for (const n of state.nodes) {
          if (n.type !== "agent") continue;
          const dx = n.positionX - dropPos.x;
          const dy = n.positionY - dropPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120 && dist < minDist) {
            minDist = dist;
            closest = n;
          }
        }
        if (!closest) return; // Agent가 아닌 곳 드롭 → 무시
        // blockDefId: DRAG_MIME에 "type:key" 형태 — blockDef가 있으면 id 별도 MIME
        const blockDefId = e.dataTransfer.getData("application/x-rf-blockdef-id");
        if (!blockDefId) return; // 빈 블록(blockDef 없음)은 장착 불가
        const agentConfig = closest.config as Partial<AgentConfig>;
        const prevMounts: MountRef[] = agentConfig.mounts ?? [];
        if (prevMounts.some((m) => m.blockDefId === blockDefId)) return; // 중복 방지
        const nextMounts: MountRef[] = [...prevMounts, { blockDefId }];
        updateAgentMounts(closest.id, nextMounts);
        scheduleSave();
        return;
      }

      const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const node = makeNode(
        pipelineId,
        type,
        Math.round(pos.x),
        Math.round(pos.y),
      );
      // 저장된 정의를 끌어온 경우 참조 노드(결정 1) — blockDefId 연결 +
      // config는 빈 오버라이드. 이름만 인스턴스 소유로 복사. 빈 블록은 맨손.
      const droppedDefId = e.dataTransfer.getData("application/x-rf-blockdef-id");
      const droppedDef = droppedDefId ? blockDefMap[droppedDefId] : undefined;
      if (droppedDefId && droppedDef) {
        addNode({ ...node, name: droppedDef.name, blockDefId: droppedDefId, config: {} });
      } else {
        addNode(node);
      }
      scheduleSave();
    },
    [pipelineId, rf, addNode, updateAgentMounts, scheduleSave, readOnly, onTrayDrop, blockDefMap],
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
      setEdgeContextMenu(null); // 엣지 메뉴 닫기
      setContextMenu({ nodeId: node.id, x: e.clientX, y: e.clientY });
    },
    [nodes],
  );

  // ── 엣지 우클릭 → "선 삭제" 컨텍스트 메뉴 ──
  const onEdgeContextMenu = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      e.preventDefault();
      setContextMenu(null); // 노드 메뉴 닫기
      setEdgeContextMenu({ edgeId: edge.id, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleDeleteEdge = useCallback(() => {
    if (!edgeContextMenu) return;
    removeEdge(edgeContextMenu.edgeId);
    setEdgeContextMenu(null);
    scheduleSave();
  }, [edgeContextMenu, removeEdge, scheduleSave]);

  // ── 자동정렬 ──
  const handleAutoLayout = useCallback(() => {
    if (readOnly) return;
    const state = useCanvasStore.getState();
    const allNodes = state.nodes.filter(
      (n) => !(MOUNT_NODE_TYPES as string[]).includes(n.type),
    );
    const flowEdges = state.edges.filter((e) => e.kind === "flow");

    // 인접 리스트 구성
    const children: Record<string, string[]> = {};
    const parents: Record<string, string[]> = {};
    for (const n of allNodes) {
      children[n.id] = [];
      parents[n.id] = [];
    }
    for (const e of flowEdges) {
      if (children[e.sourceNodeId] !== undefined) {
        children[e.sourceNodeId].push(e.targetNodeId);
      }
      if (parents[e.targetNodeId] !== undefined) {
        parents[e.targetNodeId].push(e.sourceNodeId);
      }
    }

    // BFS로 depth(column) 계산 — longest path semantics
    const depth: Record<string, number> = {};
    const inDegree: Record<string, number> = {};
    for (const n of allNodes) {
      inDegree[n.id] = parents[n.id].length;
    }
    const queue: string[] = allNodes
      .filter((n) => inDegree[n.id] === 0)
      .map((n) => n.id);
    for (const id of queue) {
      depth[id] = 0;
    }
    const visited = new Set<string>(queue);
    let qi = 0;
    while (qi < queue.length) {
      const cur = queue[qi++];
      for (const child of children[cur]) {
        const newDepth = (depth[cur] ?? 0) + 1;
        if (depth[child] === undefined || depth[child] < newDepth) {
          depth[child] = newDepth;
        }
        if (!visited.has(child)) {
          visited.add(child);
          queue.push(child);
        }
      }
    }

    // 고립 노드(방문 안된 노드) → max_depth + 1 열에 배치
    const maxDepth = Object.values(depth).reduce((m, d) => Math.max(m, d), -1);
    for (const n of allNodes) {
      if (depth[n.id] === undefined) {
        depth[n.id] = maxDepth + 1;
      }
    }

    // depth별 노드 그룹핑
    const byDepth: Record<number, string[]> = {};
    for (const n of allNodes) {
      const d = depth[n.id];
      if (!byDepth[d]) byDepth[d] = [];
      byDepth[d].push(n.id);
    }

    // 레이아웃 상수
    const X_GAP = 260;
    const Y_GAP = 130;
    const START_X = 80;
    const START_Y = 80;

    // 좌표 계산 및 노드 이동
    for (const [dStr, ids] of Object.entries(byDepth)) {
      const d = Number(dStr);
      const x = START_X + d * X_GAP;
      ids.forEach((id, idx) => {
        const y = START_Y + idx * Y_GAP;
        moveNode(id, x, y);
      });
    }

    scheduleSave();
    rf.fitView({ padding: 0.2 });
  }, [readOnly, moveNode, scheduleSave, rf]);

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
        setPartialError(err.error ?? "부분 재실행 실패");
        setTimeout(() => setPartialError(null), 4000);
      }
    } finally {
      setPartialRunning(false);
    }
  }, [pipelineId, contextMenu]);

  return (
    <div
      className={styles.wrap}
      ref={wrapRef}
      data-testid="canvas-ready"
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {readOnly && (
        <div className={styles.snapshotHint}>
          과거 run 스냅샷 — 읽기 전용
        </div>
      )}
      {partialError && (
        <div className={styles.partialErrorBanner}>
          {partialError}
          <button
            className={styles.partialErrorClose}
            onClick={() => setPartialError(null)}
            aria-label="닫기"
          >
            ×
          </button>
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
        onEdgeContextMenu={readOnly ? undefined : onEdgeContextMenu}
        fitView
        deleteKeyCode={readOnly ? [] : ["Backspace", "Delete"]}
        nodesDraggable={!readOnly}
        edgesReconnectable={!readOnly}
        nodesConnectable={!readOnly}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} color="#d6dae2" />
        <Controls showInteractive={false} />
        {!readOnly && (
          <Panel position="bottom-left" className={styles.layoutPanel}>
            <button
              className={styles.layoutBtn}
              onClick={handleAutoLayout}
              disabled={readOnly}
              title="노드를 흐름 순서대로 자동 정렬합니다"
            >
              자동정렬
            </button>
          </Panel>
        )}
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

      {edgeContextMenu && (
        <div
          className={styles.contextMenu}
          style={{ left: edgeContextMenu.x, top: edgeContextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleDeleteEdge}
            data-tip="이 연결선을 삭제합니다"
          >
            선 삭제
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
