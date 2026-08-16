// 상단 바 — 로고, 파이프라인 드롭다운, run 히스토리 드롭다운, Run 버튼.
// M4: [캔버스]/[문서] 탭 링크 제거 — TabEditor가 탭을 관리하고, 문서는 FileExplorer에서 열림.
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useCanvasStore } from "@/store/canvas";
import { useRunController } from "@/hooks/useRunController";
import type { PipelineSummary, Run } from "@/lib/types";
import styles from "./AppShell.module.css";

function formatTime(ms: number): string {
  const d = new Date(ms);
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${mo}/${day} ${h}:${m}`;
}

function runLabel(r: Run): string {
  const status =
    r.status === "succeeded" ? "성공" :
    r.status === "failed" ? "실패" :
    r.status === "gate_failed" ? "게이트 실패" :
    r.status === "cancelled" ? "취소" :
    r.status === "running" ? "실행 중" :
    r.status === "waiting_human" ? "사람 대기" :
    r.status;
  return `${formatTime(r.startedAt)} · ${status}`;
}

export function TopBar() {
  const router = useRouter();
  const pipelineId = useCanvasStore((s) => s.pipelineId);
  const snapshotRunId = useCanvasStore((s) => s.snapshotRunId);
  const setSnapshotRunId = useCanvasStore((s) => s.setSnapshotRunId);
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [runHistory, setRunHistory] = useState<Run[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const histRef = useRef<HTMLDivElement>(null);

  const currentPipeline = pipelines.find((p) => p.id === pipelineId);

  const run = useRunController();

  // waiting_human 상태 확인
  const storeRun = useCanvasStore((s) => s.run);
  const isWaitingHuman = storeRun?.status === "waiting_human";

  useEffect(() => {
    api.listPipelines().then(setPipelines).catch(() => {});
  }, [pipelineId]);

  useEffect(() => {
    if (!pipelineId) return;
    api.listRuns(pipelineId).then(setRunHistory).catch(() => {});
  }, [pipelineId, storeRun?.status]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (histRef.current && !histRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  async function switchTo(id: string) {
    setMenuOpen(false);
    router.push(`/pipelines/${id}`);
  }

  async function createNew() {
    setMenuOpen(false);
    // 기본명으로 즉시 생성 — 파일탐색기 프로젝트 트리에서 이름 변경 가능
    const p = await api.createPipeline("새 파이프라인");
    setPipelines((prev) => [p, ...prev]);
    router.push(`/pipelines/${p.id}`);
  }

  function selectHistoryRun(r: Run | null) {
    setHistoryOpen(false);
    setSnapshotRunId(r?.id ?? null);
  }

  const historyLabel = snapshotRunId
    ? runHistory.find((r) => r.id === snapshotRunId)
      ? `run · ${runLabel(runHistory.find((r) => r.id === snapshotRunId)!)}`
      : "스냅샷 보기 중"
    : storeRun?.status === "running"
    ? `실행 중 (${storeRun.progress.done}/${storeRun.progress.total})`
    : "run 히스토리";

  return (
    <div className={styles.topbar}>
      <Link href="/" className={styles.logo}>
        recruit-flow
      </Link>

      <div className={styles.dropdownWrap} ref={menuRef}>
        <button
          className={styles.dropdown}
          onClick={() => setMenuOpen((v) => !v)}
          data-tip="파이프라인 전환·새로 만들기. 전환해도 화면 구조는 유지되고 캔버스만 교체됩니다"
        >
          <span>📁</span>
          <span className={styles.name}>
            {currentPipeline?.name ?? "파이프라인 선택"}
          </span>
          <span className={styles.caret}>▾</span>
        </button>
        {menuOpen && (
          <div className={styles.menu}>
            {pipelines.map((p) => (
              <button
                key={p.id}
                className={`${styles.menuItem} ${p.id === pipelineId ? styles.current : ""}`}
                onClick={() => switchTo(p.id)}
              >
                {p.name}
              </button>
            ))}
            <button
              className={`${styles.menuItem} ${styles.menuNew}`}
              onClick={createNew}
            >
              + 새 파이프라인
            </button>
          </div>
        )}
      </div>

      <span className={styles.spacer} />

      {/* run 히스토리 드롭다운 */}
      <div className={styles.dropdownWrap} ref={histRef}>
        <button
          className={`${styles.dropdown} ${snapshotRunId ? styles.snapshotActive : ""}`}
          onClick={() => {
            if (pipelineId) {
              api.listRuns(pipelineId).then(setRunHistory).catch(() => {});
            }
            setHistoryOpen((v) => !v);
          }}
          data-testid="run-history"
          data-tip="과거 run을 선택하면 캔버스가 그 run의 스냅샷을 읽기 전용으로 보여줍니다. '현재로 돌아가기'로 편집 모드 복귀"
        >
          <span>🕘</span>
          <span className={styles.name}>{historyLabel}</span>
          <span className={styles.caret}>▾</span>
        </button>
        {historyOpen && (
          <div className={styles.menu} style={{ right: 0, left: "auto", minWidth: 260 }}>
            {snapshotRunId && (
              <button
                className={`${styles.menuItem} ${styles.menuNew}`}
                onClick={() => selectHistoryRun(null)}
              >
                ← 현재로 돌아가기
              </button>
            )}
            {runHistory.length === 0 && (
              <div className={styles.menuEmpty}>run 기록 없음</div>
            )}
            {runHistory.map((r) => (
              <button
                key={r.id}
                className={`${styles.menuItem} ${r.id === snapshotRunId ? styles.current : ""}`}
                onClick={() => selectHistoryRun(r)}
                data-testid="run-history-item"
              >
                {runLabel(r)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ position: "relative" }}>
        {snapshotRunId ? (
          // 스냅샷 모드: 실행 버튼 비활성
          <button
            className={`${styles.runBtn} ${styles.idle}`}
            disabled
            style={{ opacity: 0.4 }}
            data-tip="스냅샷 보기 중 — '현재로 돌아가기'를 선택하면 실행할 수 있습니다"
          >
            ▶ 실행
          </button>
        ) : isWaitingHuman ? (
          <button
            className={`${styles.runBtn} ${styles.running}`}
            disabled
            data-tip="Human 노드가 사람의 승인을 기다리는 중입니다. 채팅 독 또는 사이드 패널에서 승인하세요"
          >
            ■ 대기
            <span className={styles.runProgress}>사람 대기 중</span>
          </button>
        ) : run.isRunning ? (
          <button
            className={`${styles.runBtn} ${styles.running}`}
            onClick={run.cancel}
            disabled={run.busy}
            data-testid="stop-btn"
            data-tip="실행 중단. 현재 노드의 SDK 호출을 취소하고 지금까지의 아티팩트는 보존됩니다"
          >
            ■ 중단
            {run.progress && (
              <span className={styles.runProgress}>
                {run.progress.done}/{run.progress.total} 노드
              </span>
            )}
          </button>
        ) : (
          <button
            className={`${styles.runBtn} ${styles.idle}`}
            onClick={run.start}
            disabled={!run.canRun || run.busy}
            data-testid="run-btn"
            data-tip="그래프를 검증하고 run을 시작합니다(스냅샷 생성). 고아 노드·사이클·Output 문제가 있으면 경고합니다"
          >
            ▶ 실행
          </button>
        )}

        {run.errors && run.errors.length > 0 && (
          <div className={styles.warnPop}>
            <h4>실행할 수 없습니다</h4>
            <ul>
              {run.errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
            <button className={styles.warnClose} onClick={run.clearErrors}>
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
