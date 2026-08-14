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
import type { ChatMessage, SequencedSseEvent } from "@/lib/types";

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
      let pending: SequencedSseEvent[] | null = [];

      const es = new EventSource(`/api/pipelines/${pipelineId}/events`);
      esRef.current = es;

      const applyEvent = (event: SequencedSseEvent) => {
        if (event.type === "chat_delta") {
          cbRef.current.onChatDelta(event.messageId, event.chunk);
        } else if (event.type === "chat_message") {
          cbRef.current.onChatMessage(event.message);
        } else if (event.type === "chat_card") {
          cbRef.current.onChatCard(event.message);
        } else if (event.type === "block_def") {
          // 트레이는 전역이라 payload를 신뢰하지 않고 재조회를 트리거한다.
          cbRef.current.onBlockDefChanged?.();
        }
      };

      const receive = (event: SequencedSseEvent) => {
        if (pending) pending.push(event);
        else applyEvent(event);
      };

      es.addEventListener("chat_delta", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SequencedSseEvent,
          { type: "chat_delta" }
        >;
        receive(d);
      });

      es.addEventListener("chat_message", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SequencedSseEvent,
          { type: "chat_message" }
        >;
        receive(d);
      });

      es.addEventListener("chat_card", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SequencedSseEvent,
          { type: "chat_card" }
        >;
        receive(d);
      });

      es.addEventListener("block_def", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SequencedSseEvent,
          { type: "block_def" }
        >;
        receive(d);
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        pending = null; // 이 연결의 버퍼 폐기 — 재연결이 새 스냅샷을 가져온다.
        if (!cancelled) {
          retryTimer = setTimeout(connect, 2000);
        }
      };

      // 서버 구독이 확정된 뒤 스냅샷을 요청해야 두 HTTP 연결 사이의
      // 미구독 구간이 생기지 않는다.
      async function applySnapshot() {
        let msgs: ChatMessage[] | null = null;
        let cursor = 0;
        try {
          const res = await fetch(`/api/pipelines/${pipelineId}/messages`);
          if (res.ok) {
            const headerCursor = Number(
              res.headers.get("X-Stream-Cursor") ?? "0",
            );
            cursor = Number.isSafeInteger(headerCursor) ? headerCursor : 0;
            msgs = (await res.json()) as ChatMessage[];
          }
        } catch {
          // 네트워크 오류 — 스냅샷 없이 버퍼만 흘려보낸다(다음 재연결에서 복구).
        }
        if (cancelled || esRef.current !== es) return;
        if (msgs) cbRef.current.onMessages(msgs);
        const snapshotIds = new Set((msgs ?? []).map((message) => message.id));
        // cursor 이하의 영속 메시지는 스냅샷이 이미 포함한다. chat_delta도
        // 확정 메시지와 같은 id면 stale 스트리밍이므로 버린다.
        const buffered = pending ?? [];
        pending = null;
        for (const event of buffered) {
          if (event.type === "block_def") {
            applyEvent(event);
          } else if (
            event.type === "chat_delta" &&
            event.sequence > cursor &&
            !snapshotIds.has(event.messageId)
          ) {
            applyEvent(event);
          } else if (event.sequence > cursor) {
            applyEvent(event);
          }
        }
      }

      let snapshotStarted = false;
      es.onopen = () => {
        if (snapshotStarted) return;
        snapshotStarted = true;
        void applySnapshot();
      };
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
