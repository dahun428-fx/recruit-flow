// PillNode — 장착 계층(Skill/Rule/Tool) 알약형 노드.
// 목업: .pill — 보라 점선 테두리, 상/하 핸들, 확실히 작게.
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeType } from "@/lib/types";
import styles from "./PillNode.module.css";

export interface PillNodeData {
  type: NodeType;
  name: string;
  [key: string]: unknown;
}

const TYPE_LABEL: Record<string, string> = {
  skill: "SKILL",
  rule: "RULE",
  tool: "TOOL",
};

export function PillNode({ data, selected }: NodeProps) {
  const d = data as PillNodeData;
  const tag = TYPE_LABEL[d.type] ?? d.type.toUpperCase();

  return (
    <div className={`${styles.pill} ${selected ? styles.selected : ""}`}>
      {/* 상단 핸들 — pill → Agent */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={styles.handle}
      />
      <span className={styles.tag}>{tag}</span>
      <span className={styles.name}>{d.name}</span>
      {/* 하단 핸들 — Agent가 연결 수신(pill은 source로 agent top에 연결) */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={styles.handleTop}
      />
    </div>
  );
}
