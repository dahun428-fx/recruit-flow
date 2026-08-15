// 채점 에이전트 JSON 카드 렌더러 (M5 워크스트림 B)
// nodes.md §2 채점 에이전트 권장 스키마: total / verdict / passBar / blockers
"use client";

import { useState } from "react";
import type { Artifact, NodeRun } from "@/lib/types";
import styles from "./ScoreCard.module.css";

// ──────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────

export interface ScoringSchema {
  total: number;
  verdict: "PASS" | "FAIL";
  passBar: number;
  blockers: string[];
}

/** 아티팩트 content를 파싱하여 채점 스키마인지 판단한다. */
export function parseScoringJson(content: string): ScoringSchema | null {
  try {
    const obj = JSON.parse(content) as Record<string, unknown>;
    if (
      typeof obj["total"] === "number" &&
      (obj["verdict"] === "PASS" || obj["verdict"] === "FAIL") &&
      typeof obj["passBar"] === "number" &&
      Array.isArray(obj["blockers"])
    ) {
      return {
        total: obj["total"] as number,
        verdict: obj["verdict"] as "PASS" | "FAIL",
        passBar: obj["passBar"] as number,
        blockers: (obj["blockers"] as unknown[]).map(String),
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────
// 회차 추이 유틸
// ──────────────────────────────────────────────────────────

interface IterScore {
  iteration: number;
  score: ScoringSchema | null;
}

/** iterations(NodeRun[]) + artifactsMap(nodeRunId→Artifact)에서 회차별 점수 추출 */
export function buildIterScores(
  iterations: NodeRun[],
  artifactsMap: Record<string, Artifact>,
): IterScore[] {
  return iterations.map((nr) => {
    const art = artifactsMap[nr.id];
    const score = art && art.format === "json" ? parseScoringJson(art.content) : null;
    return { iteration: nr.iteration, score };
  });
}

// ──────────────────────────────────────────────────────────
// 회차 점수 추이 컴포넌트
// ──────────────────────────────────────────────────────────

function ScoreTrend({ iterScores }: { iterScores: IterScore[] }) {
  // 채점 스키마가 있는 회차만 표시
  const valid = iterScores.filter((s) => s.score !== null);
  if (valid.length < 2) return null;

  return (
    <div className={styles.trend}>
      <div className={styles.trendLabel}>점수 추이</div>
      <div className={styles.trendRow}>
        {valid.map((s, idx) => (
          <span key={s.iteration}>
            <span
              className={s.score!.verdict === "PASS" ? styles.trendPass : styles.trendFail}
            >
              {s.iteration}회차&nbsp;{s.score!.total}점
            </span>
            {idx < valid.length - 1 && (
              <span className={styles.trendArrow}>→</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// blockers diff (이전 회차 대비)
// ──────────────────────────────────────────────────────────

function BlockersDiff({
  current,
  prev,
}: {
  current: string[];
  prev: string[] | null;
}) {
  if (!prev || prev.length === 0) return null;

  const fixed = prev.filter((b) => !current.includes(b));
  if (fixed.length === 0) return null;

  return (
    <div className={styles.diff}>
      <div className={styles.diffLabel}>이전 회차에서 해결된 항목</div>
      <ul className={styles.diffList}>
        {fixed.map((b, i) => (
          <li key={i} className={styles.diffFixed}>
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 메인 ScoreCard
// ──────────────────────────────────────────────────────────

interface ScoreCardProps {
  /** 현재 선택 회차 아티팩트 */
  artifact: Artifact;
  /** 전체 회차(NodeRun[]) — 회차 비교에 사용 */
  iterations: NodeRun[];
  /** nodeRunId → Artifact 맵 — 회차별 아티팩트 조회 */
  artifactsMap: Record<string, Artifact>;
  /** 스트리밍 중 여부 */
  streaming?: boolean;
}

export function ScoreCard({
  artifact,
  iterations,
  artifactsMap,
  streaming,
}: ScoreCardProps) {
  const [showRaw, setShowRaw] = useState(false);

  const score = parseScoringJson(artifact.content);

  // 채점 스키마 불일치 → 폴백(범용 JSON 뷰)
  if (!score) {
    return <GenericJsonView content={artifact.content} streaming={streaming} />;
  }

  const isPass = score.verdict === "PASS";

  // 회차 추이
  const iterScores = buildIterScores(iterations, artifactsMap);

  // 이전 회차 blockers (선택 아티팩트 기준 바로 직전)
  const currentNodeRun = iterations.find((nr) => nr.id === artifact.nodeRunId);
  const prevNodeRun = currentNodeRun
    ? iterations.find((nr) => nr.iteration === currentNodeRun.iteration - 1)
    : null;
  const prevArt = prevNodeRun ? artifactsMap[prevNodeRun.id] : undefined;
  const prevScore = prevArt && prevArt.format === "json"
    ? parseScoringJson(prevArt.content)
    : null;

  return (
    <div className={styles.card}>
      {/* 헤더: verdict 뱃지 + 점수 */}
      <div className={styles.header}>
        <span className={isPass ? styles.verdictPass : styles.verdictFail}>
          {isPass ? "PASS" : "FAIL"}
        </span>
        <div className={styles.scoreBlock}>
          <span className={styles.scoreValue}>{score.total}</span>
          <span className={styles.scoreBar}>/ 통과선 {score.passBar}</span>
        </div>
        {streaming && <span className={styles.streamBadge}>스트리밍 중</span>}
      </div>

      {/* 회차 점수 추이 */}
      {iterations.length > 1 && (
        <ScoreTrend iterScores={iterScores} />
      )}

      {/* blockers */}
      {score.blockers.length > 0 ? (
        <div className={styles.blockers}>
          <div className={styles.blockersLabel}>통과하려면 고칠 것</div>
          <ul className={styles.blockerList}>
            {score.blockers.map((b, i) => (
              <li key={i} className={styles.blockerItem}>{b}</li>
            ))}
          </ul>
          {/* 이전 회차 대비 해결 항목 */}
          {prevScore && (
            <BlockersDiff current={score.blockers} prev={prevScore.blockers} />
          )}
        </div>
      ) : isPass ? (
        <div className={styles.noBlockers}>차단 항목 없음 — 통과 완료</div>
      ) : null}

      {/* 원문 JSON 토글 */}
      <div className={styles.rawToggleRow}>
        <button
          className={styles.rawToggle}
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? "원문 숨기기" : "원문 JSON 보기"}
        </button>
      </div>
      {showRaw && (
        <pre className={styles.rawJson}>{formatJson(artifact.content)}</pre>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 폴백: 범용 JSON 뷰 (숫자 필드 강조)
// ──────────────────────────────────────────────────────────

function GenericJsonView({
  content,
  streaming,
}: {
  content: string;
  streaming?: boolean;
}) {
  const formatted = formatJson(content);
  // 숫자 필드 강조를 위해 토큰 분리 렌더
  const tokens = tokenizeJson(formatted);

  return (
    <div>
      <pre className={styles.genericJson}>
        {tokens.map((tok, i) =>
          tok.kind === "number" ? (
            <span key={i} className={styles.numToken}>{tok.text}</span>
          ) : (
            tok.text
          ),
        )}
        {streaming && <span className={styles.cursor} />}
      </pre>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────────────────

function formatJson(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

type JsonToken = { kind: "text" | "number"; text: string };

/** JSON 문자열에서 숫자 리터럴 위치를 찾아 토큰으로 분리 */
function tokenizeJson(text: string): JsonToken[] {
  const result: JsonToken[] = [];
  // JSON 값 위치의 숫자 리터럴: `: 12` 또는 `[12,` 처럼 값 위치
  const numRe = /(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = numRe.exec(text)) !== null) {
    if (m.index > last) {
      result.push({ kind: "text", text: text.slice(last, m.index) });
    }
    result.push({ kind: "number", text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    result.push({ kind: "text", text: text.slice(last) });
  }
  return result;
}
