// usePipelineStream — pipeline 스코프 SSE 구독(M3).
// GET /api/pipelines/[id]/events 상시 연결.
// chat_delta 누적 → 스트리밍 렌더, chat_message 확정, chat_card 수신.
//
// ★ 구독 선행(engine.md §3): 스냅샷(/messages)을 먼저 받고 그 뒤에 구독하면
//   두 동작 사이에 발행된 이벤트가 유실된다. 반드시 구독을 먼저 열고 도착
//   이벤트를 버퍼에 쌓으면서 스냅샷을 받은 뒤 `스냅샷 → 버퍼` 순으로 적용한다.
//   메시지 id로 중복 제거하므로 스냅샷과 버퍼가 겹쳐도 안전하다.
"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage, SseEvent } from "@/lib/types";

export interface PipelineStreamCallbacks {
  onMessages: (msgs: ChatMessage[]) => void;
  onChatDelta: (messageId: string, chunk: string) => void;
  onChatMessage: (msg: ChatMessage) => void;
  onChatCard: (msg: ChatMessage) => void;
  /** 트레이(block_defs) 변경 통지 — 전역 브로드캐스트(engine.md §3) */
  onBlockDefChanged?: () => void;
}

/**
 * pipelineId 변경 시 SSE를 먼저 열고 /messages 스냅샷을 받아 병합.
 * 끊기면 같은 순서로 재연결.
 */
export function usePipelineStream(
  pipelineId: string | null,
  callbacks: PipelineStreamCallbacks,
) {
  // 콜백 최신화 — effect 재실행 없이 최신 함수 참조 유지.
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!pipelineId) return;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (cancelled) return;

      // 스냅샷이 적용되기 전 도착한 이벤트를 담아둔다.
      // null이 되면 "스냅샷 적용 완료 = 이제 즉시 반영" 상태.
      let pending: Array<() => void> | null = [];
      const apply = (fn: () => void) => {
        if (pending) pending.push(fn);
        else fn();
      };

      const es = new EventSource(`/api/pipelines/${pipelineId}/events`);
      esRef.current = es;

      es.addEventListener("chat_delta", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SseEvent,
          { type: "chat_delta" }
        >;
        apply(() => cbRef.current.onChatDelta(d.messageId, d.chunk));
      });

      es.addEventListener("chat_message", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SseEvent,
          { type: "chat_message" }
        >;
        apply(() => cbRef.current.onChatMessage(d.message));
      });

      es.addEventListener("chat_card", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SseEvent,
          { type: "chat_card" }
        >;
        apply(() => cbRef.current.onChatCard(d.message));
      });

      es.addEventListener("block_def", () => {
        // 트레이는 전역이라 payload를 신뢰하지 않고 재조회를 트리거한다.
        apply(() => cbRef.current.onBlockDefChanged?.());
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        pending = null; // 이 연결의 버퍼 폐기 — 재연결이 새 스냅샷을 가져온다.
        if (!cancelled) {
          retryTimer = setTimeout(connect, 2000);
        }
      };

      // 구독을 연 뒤 스냅샷을 받는다. 그 사이 도착분은 pending에 쌓인다.
      void (async () => {
        let msgs: ChatMessage[] | null = null;
        try {
          const res = await fetch(`/api/pipelines/${pipelineId}/messages`);
          if (res.ok) msgs = (await res.json()) as ChatMessage[];
        } catch {
          // 네트워크 오류 — 스냅샷 없이 버퍼만 흘려보낸다(다음 재연결에서 복구).
        }
        if (cancelled || esRef.current !== es) return;
        if (msgs) cbRef.current.onMessages(msgs);
        // 스냅샷 → 버퍼 순으로 적용. 이후 도착분은 즉시 반영.
        const buffered = pending ?? [];
        pending = null;
        for (const fn of buffered) fn();
      })();
    }

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [pipelineId]);
}
