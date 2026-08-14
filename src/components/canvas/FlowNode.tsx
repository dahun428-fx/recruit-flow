// React Flow 커스텀 노드 5종(Agent/Input/Output/Gate/Human) — 목업 카드 형태.
// Gate: 마름모 느낌 변형 카드 + pass/fail 2출력 핸들.
// Human: 사람 아이콘 + waiting_human 주황 점멸.
// 타입 색 헤더 · 좌우 핸들 · 상단 장착 핸들(Agent) · 상태 색/애니메이션.
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeType } from "@/lib/types";
import type { NodeVisualStatus } from "@/store/canvas";
import styles from "./FlowNode.module.css";

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
  [key: string]: unknown;
}

const HEADER: Record<NodeType, { cls: string; icon: string; label: string }> = {
  input: { cls: styles.hdInput, icon: "📄", label: "INPUT" },
  agent: { cls: styles.hdAgent, icon: "🤖", label: "AGENT" },
  output: { cls: styles.hdOutput, icon: "📦", label: "OUTPUT" },
  gate: { cls: styles.hdGate, icon: "◆", label: "GATE" },
  human: { cls: styles.hdHuman, icon: "🙋", label: "HUMAN" },
  skill: { cls: styles.hdMount, icon: "◇", label: "SKILL" },
  rule: { cls: styles.hdMount, icon: "◇", label: "RULE" },
  tool: { cls: styles.hdMount, icon: "◇", label: "TOOL" },
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

  // Gate: 마름모 느낌 변형 카드
  const nodeClassName = [
    styles.node,
    isGate ? styles.nodeGate : "",
    STATUS_CLASS[d.status],
    selected ? styles.selected : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={nodeClassName}
      data-testid={`node-${d.nodeId ?? rfId}`}
      onClick={
        isHuman && d.status === "waiting_human" && d.onHumanClick
          ? (e) => {
              e.stopPropagation();
              d.onHumanClick!(d.nodeId ?? rfId);
            }
          : undefined
      }
      style={isHuman && d.status === "waiting_human" ? { cursor: "pointer" } : undefined}
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

      {/* Agent 상단 장착 핸들 — pill 연결 수신 */}
      {isAgent && (
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          className={styles.handle}
          style={{
            background: "#fff",
            border: "2px solid #b08fd8",
            top: -6,
          }}
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
