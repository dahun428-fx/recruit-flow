// MountEdge — 장착 계층 점선 엣지(Skill/Rule/Tool → Agent).
// 목업: stroke: #b08fd8, stroke-dasharray: 4 4, strokeWidth: 1.6
"use client";

import { BaseEdge, getStraightPath, type EdgeProps } from "@xyflow/react";

export function MountEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  return (
    <BaseEdge
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: "#b08fd8",
        strokeDasharray: "4 4",
        strokeWidth: 1.6,
        fill: "none",
      }}
    />
  );
}
