// 그래프 debounce 저장 — 편집(config/이동/배선)이 있을 때 PUT /graph.
// Canvas·SidePanel이 공유. 진실은 DB지만 편집은 낙관적 갱신 후 저장.
"use client";

import { useCallback, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { useCanvasStore } from "@/store/canvas";

export function useGraphSave(delay = 600) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const s = useCanvasStore.getState();
      if (!s.pipelineId) return;
      api.saveGraph(s.pipelineId, s.nodes, s.edges).catch(() => {});
    }, delay);
  }, [delay]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return schedule;
}
