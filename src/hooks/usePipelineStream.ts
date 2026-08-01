// usePipelineStream — pipeline 스코프 SSE 구독(M3).
// GET /api/pipelines/[id]/events 상시 연결.
// chat_delta 누적 → 스트리밍 렌더, chat_message 확정, chat_card 수신.
// 접속 시 /messages 로드(진실=DB), 끊기면 재조회.
"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage, SseEvent } from "@/lib/types";

export interface PipelineStreamCallbacks {
  onMessages: (msgs: ChatMessage[]) => void;
  onChatDelta: (messageId: string, chunk: string) => void;
  onChatMessage: (msg: ChatMessage) => void;
  onChatCard: (msg: ChatMessage) => void;
}

/**
 * pipelineId 변경 시 /messages 로드 후 SSE 연결.
 * 끊기면 /messages 재조회.
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

    async function loadMessages() {
      try {
        const res = await fetch(`/api/pipelines/${pipelineId}/messages`);
        if (!res.ok) return;
        const msgs = (await res.json()) as ChatMessage[];
        if (!cancelled) cbRef.current.onMessages(msgs);
      } catch {
        // 네트워크 오류 무시
      }
    }

    function connect() {
      if (cancelled) return;
      const es = new EventSource(`/api/pipelines/${pipelineId}/events`);
      esRef.current = es;

      es.addEventListener("chat_delta", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SseEvent,
          { type: "chat_delta" }
        >;
        cbRef.current.onChatDelta(d.messageId, d.chunk);
      });

      es.addEventListener("chat_message", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SseEvent,
          { type: "chat_message" }
        >;
        cbRef.current.onChatMessage(d.message);
      });

      es.addEventListener("chat_card", (ev) => {
        const d = JSON.parse((ev as MessageEvent).data) as Extract<
          SseEvent,
          { type: "chat_card" }
        >;
        cbRef.current.onChatCard(d.message);
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (!cancelled) {
          // 끊기면 REST 재조회 후 재연결
          void loadMessages().then(() => {
            if (!cancelled) setTimeout(connect, 2000);
          });
        }
      };
    }

    void loadMessages().then(() => {
      if (!cancelled) connect();
    });

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
    };
  }, [pipelineId]);
}
