// React Flow 커스텀 노드 5종(Agent/Input/Output/Gate/Human) — 목업 카드 형태.
// Gate: 마름모 느낌 변형 카드 + pass/fail 2출력 핸들.
// Human: 사람 아이콘 + waiting_human 주황 점멸.
// 타입 색 헤더 · 좌우 핸들 · 상태 색/애니메이션.
// M4: Agent 카드 하단 장착 칩(MountRef 배열), 칩 X 해제 → onRemoveMount 콜백.
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { MountRef, NodeType } from "@/lib/types";
import type { NodeVisualStatus } from "@/store/canvas";
import styles from "./FlowNode.module.css";

// 노드 수동 더블클릭 감지(모듈 스코프 — 노드 인스턴스 간 공유). ReactFlow가 native
// dblclick·onNodeDoubleClick을 삼키므로, 확실히 발화하는 DOM onClick의 시각차로
// 더블클릭을 감지한다. 물리 더블클릭·연속 두 번 클릭 모두 500ms 내면 상세를 연다.
let lastNodeClick: { id: string; t: number } = { id: "", t: 0 };
const DOUBLE_CLICK_MS = 500;

export interface FlowNodeData {
  type: NodeType;
  name: string;
  desc: string;
  status: NodeVisualStatus;
  /** Output 성공 시 다운로드 버튼(아티팩트 id 존재). */
  downloadArtifactId?: string | null;
  onDownload?: (artifactId: string) => void;
  /** Human 노드 클릭 → 채팅 독 스크롤(nodeRunId 기준). */
  onHumanClick?: (nodeId: string) => void;
  nodeId?: string;
  /** M4: Agent 장착 칩 목록 */
  mounts?: MountRef[];
  /** M4: blockDefId → { name, type } 조회 맵 (칩 라벨용) */
  mountDefMap?: Record<string, { name: string; type: string }>;
  /** M4: 칩 X 버튼 → blockDefId 전달 */
  onRemoveMount?: (nodeId: string, blockDefId: string) => void;
  /** M4: 노드 클릭 → 정의 파일 탭 열기 */
  onNodeClick?: (nodeId: string, blockDefId: string | null) => void;
  blockDefId?: string | null;
  [key: string]: unknown;
}

const HEADER: Record<NodeType, { cls: string; icon: string; label: string }> = {
  input: { cls: styles.hdInput, icon: "📄", label: "자료" },
  agent: { cls: styles.hdAgent, icon: "🤖", label: "에이전트" },
  output: { cls: styles.hdOutput, icon: "📦", label: "완성본" },
  gate: { cls: styles.hdGate, icon: "◆", label: "관문" },
  human: { cls: styles.hdHuman, icon: "🙋", label: "내 검토" },
  skill: { cls: styles.hdMount, icon: "◇", label: "기술" },
  rule: { cls: styles.hdMount, icon: "◇", label: "규칙" },
  tool: { cls: styles.hdMount, icon: "◇", label: "도구" },
};

/** 장착 칩 색 (결정 3: 기술/규칙/도구 색 구분). */
const MOUNT_CHIP_COLOR: Record<string, string> = {
  skill: "var(--c-mount)",
  rule: "#e6a817",
  tool: "#2ea2a2",
};

const MOUNT_CHIP_LABEL: Record<string, string> = {
  skill: "기술",
  rule: "규칙",
  tool: "도구",
};

const STATUS_LABEL: Record<NodeVisualStatus, string> = {
  idle: "● 대기",
  queued: "● 큐 대기",
  running: "● 실행 중…",
  waiting_human: "● 사람 대기 중",
  succeeded: "● 성공",
  failed: "● 실패",
  skipped: "● 건너뜀",
};

const STATUS_CLASS: Record<NodeVisualStatus, string> = {
  idle: styles["st-idle"],
  queued: styles["st-queued"],
  running: styles["st-running"],
  waiting_human: styles["st-waiting"],
  succeeded: styles["st-succeeded"],
  failed: styles["st-failed"],
  skipped: styles["st-skipped"],
};

export function FlowNode({ data, selected, id: rfId }: NodeProps) {
  const d = data as FlowNodeData;
  const head = HEADER[d.type];
  const showDownload =
    d.type === "output" &&
    d.status === "succeeded" &&
    !!d.downloadArtifactId;

  const isGate = d.type === "gate";
  const isHuman = d.type === "human";
  const isAgent = d.type === "agent";
  const nodeId = d.nodeId ?? rfId;

  // Gate: 마름모 느낌 변형 카드
  const nodeClassName = [
    styles.node,
    isGate ? styles.nodeGate : "",
    STATUS_CLASS[d.status],
    selected ? styles.selected : "",
  ]
    .filter(Boolean)
    .join(" ");

  function handleClick(e: React.MouseEvent) {
    if (isHuman && d.status === "waiting_human" && d.onHumanClick) {
      e.stopPropagation();
      d.onHumanClick!(nodeId);
      return;
    }
    // 같은 노드를 500ms 내 두 번 클릭 = 더블클릭 → 상세(정의 탭) 열기. 단일 클릭은 선택만.
    const t = e.timeStamp;
    if (lastNodeClick.id === nodeId && t - lastNodeClick.t < DOUBLE_CLICK_MS) {
      lastNodeClick = { id: "", t: 0 };
      if (d.onNodeClick) {
        e.stopPropagation();
        d.onNodeClick(nodeId, d.blockDefId ?? null);
      }
    } else {
      lastNodeClick = { id: nodeId, t };
    }
  }

  const mounts = isAgent ? (d.mounts ?? []) : [];

  return (
    <div
      className={nodeClassName}
      data-testid={`node-${nodeId}`}
      onClick={handleClick}
      style={
        isHuman && d.status === "waiting_human"
          ? { cursor: "pointer" }
          : d.onNodeClick
          ? { cursor: "pointer" }
          : undefined
      }
    >
      {/* 좌측 입력 핸들 — Input에는 없음, Gate/Human 포함 */}
      {d.type !== "input" && (
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className={styles.handle}
        />
      )}

      <div className={`${styles.header} ${head.cls}`}>
        <span>{head.icon}</span>
        {head.label}
      </div>
      <div className={styles.body}>
        <div className={styles.name}>{d.name}</div>
        <div className={styles.desc}>{d.desc}</div>
        <div className={styles.status} data-testid="node-status">{STATUS_LABEL[d.status]}</div>
        {showDownload && (
          <button
            className={styles.dlBtn}
            onClick={(e) => {
              e.stopPropagation();
              d.onDownload?.(d.downloadArtifactId!);
            }}
            data-testid="download-html-node"
            data-tip="완성된 이력서를 자기완결형 HTML 1파일로 다운로드"
          >
            ⬇ HTML
          </button>
        )}

        {/* M4: Agent 장착 칩 영역 */}
        {isAgent && mounts.length > 0 && (
          <div className={styles.mountChips} data-testid={`mount-chips-${nodeId}`}>
            {mounts.map((m) => {
              const defInfo = d.mountDefMap?.[m.blockDefId];
              const defType = defInfo?.type ?? "skill";
              const chipLabel = defInfo?.name
                ? `${MOUNT_CHIP_LABEL[defType] ?? "장착"}: ${defInfo.name}`
                : MOUNT_CHIP_LABEL[defType] ?? "장착";
              const color = MOUNT_CHIP_COLOR[defType] ?? "var(--c-mount)";
              return (
                <span
                  key={m.blockDefId}
                  className={styles.mountChip}
                  style={{ background: color }}
                  data-testid={`mount-chip-${nodeId}-${m.blockDefId}`}
                  title={chipLabel}
                >
                  <span className={styles.mountChipLabel}>{chipLabel}</span>
                  <button
                    className={styles.mountChipRemove}
                    onClick={(e) => {
                      e.stopPropagation();
                      d.onRemoveMount?.(nodeId, m.blockDefId);
                    }}
                    aria-label="장착 해제"
                    title="장착 해제"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* 우측 출력 핸들 */}
      {d.type !== "output" && !isGate && (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className={styles.handle}
        />
      )}

      {/* Gate: pass(위) + fail(아래) 두 출력 핸들 */}
      {isGate && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="pass"
            className={styles.handle}
            style={{ top: "35%" }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="fail"
            className={styles.handle}
            style={{ top: "65%" }}
          />
        </>
      )}
    </div>
  );
}
