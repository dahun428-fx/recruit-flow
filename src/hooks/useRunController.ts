// Run 버튼 상태머신(ui.md §7·Q8) — 시작/중단, 검증 경고.
// run 상태·진행은 스토어(SSE/REST 유래)에서 읽는다. 여기선 시작·취소 트리거만.
"use client";

import { useCallback, useState } from "react";
import { api } from "@/lib/api";
import { rememberActiveRun } from "@/hooks/useRunStream";
import { useCanvasStore } from "@/store/canvas";
import type { ValidationError } from "@/lib/types";

export function useRunController() {
  const pipelineId = useCanvasStore((s) => s.pipelineId);
  const run = useCanvasStore((s) => s.run);
  const initRun = useCanvasStore((s) => s.initRun);
  const [errors, setErrors] = useState<ValidationError[] | null>(null);
  const [busy, setBusy] = useState(false);

  const isRunning = run?.status === "running";

  const start = useCallback(async () => {
    if (!pipelineId || busy || isRunning) return;
    setBusy(true);
    setErrors(null);
    try {
      const { status, body } = await api.startRun(pipelineId);
      if (status === 400 && "errors" in body && body.errors) {
        setErrors(body.errors);
        return;
      }
      if (status === 409 && body.runId) {
        // 이미 실행 중 — 그 run을 구독하도록 스토어에 심는다.
        rememberActiveRun(pipelineId, body.runId);
        initRun({
          runId: body.runId,
          status: "running",
          progress: { done: 0, total: 0 },
          nodeStatus: {},
          nodeRunId: {},
          artifacts: {},
        });
        return;
      }
      if ("runId" in body && body.runId) {
        rememberActiveRun(pipelineId, body.runId);
        initRun({
          runId: body.runId,
          status: "running",
          progress: { done: 0, total: 0 },
          nodeStatus: {},
          nodeRunId: {},
          artifacts: {},
        });
      }
    } finally {
      setBusy(false);
    }
  }, [pipelineId, busy, isRunning, initRun]);

  const cancel = useCallback(async () => {
    if (!run || !isRunning) return;
    setBusy(true);
    try {
      await api.cancelRun(run.runId);
    } finally {
      setBusy(false);
    }
  }, [run, isRunning]);

  return {
    isRunning,
    progress: run?.progress ?? null,
    errors,
    clearErrors: () => setErrors(null),
    busy,
    start,
    cancel,
    canRun: !!pipelineId,
  };
}
