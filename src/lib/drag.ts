// 드래그 MIME 상수 — Palette → FileExplorer 이관 후 Canvas가 참조하도록.
export const DRAG_MIME = "application/x-rf-block";
export const TRAY_DRAG_MIME = "application/x-rf-tray";

import type { NodeType } from "./types";

/** 팔레트/탐색기 항목에서 드래그로 떨어뜨릴 때 타입 추출. */
export function parseDropType(key: string): NodeType | null {
  const [type] = key.split(":");
  const validTypes: NodeType[] = [
    "agent",
    "input",
    "output",
    "gate",
    "human",
    "skill",
    "rule",
    "tool",
  ];
  if (validTypes.includes(type as NodeType)) return type as NodeType;
  return null;
}
