// 패널 드래그 리사이즈(Q9a) — 폭/높이를 localStorage(`rf.panel.*`)에 보존.
// 최대 55vw 상한(패널)·별도 상한(문서 목록/버전). 재방문 시 복원.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Options {
  /** 초기(저장값 없을 때) 크기 px */
  initial: number;
  min: number;
  /** 최대 크기: vw 비율(0.55 = 55vw) 또는 px */
  maxVw?: number;
  maxPx?: number;
  /** 세로 리사이즈(높이)면 true */
  vertical?: boolean;
  /** 분할선 기준 커지는 방향: 'left'(왼쪽 패널)면 +delta, 'right'면 -delta */
  grow: "left" | "right" | "up";
}

const KEY_PREFIX = "rf.panel.";

function readStored(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(KEY_PREFIX + key);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function usePanelSize(key: string, opts: Options) {
  const { initial, min, maxVw, maxPx, grow } = opts;
  const [size, setSize] = useState<number>(initial);
  const stateRef = useRef({ startPos: 0, startSize: 0 });

  // 초기 복원(SSR 불일치 방지: 마운트 후 1회).
  useEffect(() => {
    setSize(readStored(key, initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const clamp = useCallback(
    (px: number) => {
      let max = maxPx ?? Infinity;
      if (maxVw && typeof window !== "undefined") {
        max = Math.min(max, window.innerWidth * maxVw);
      }
      return Math.max(min, Math.min(px, max));
    },
    [min, maxVw, maxPx],
  );

  const onMouseDown = useCallback(
    (vertical: boolean) => (e: React.MouseEvent) => {
      e.preventDefault();
      stateRef.current = {
        startPos: vertical ? e.clientX : e.clientY,
        startSize: size,
      };
      const dir = grow === "right" ? -1 : grow === "up" ? -1 : 1;

      function move(ev: MouseEvent) {
        const cur = vertical ? ev.clientX : ev.clientY;
        const d = cur - stateRef.current.startPos;
        const next = clamp(stateRef.current.startSize + dir * d);
        setSize(next);
      }
      function up() {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setSize((s) => {
          window.localStorage.setItem(KEY_PREFIX + key, String(s));
          return s;
        });
      }
      document.body.style.cursor = vertical ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    },
    [size, grow, clamp, key],
  );

  return { size, onMouseDown };
}
