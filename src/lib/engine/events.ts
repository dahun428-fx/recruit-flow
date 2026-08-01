// run별 SSE subscriber 버스. 진실은 DB, SSE는 통지(engine.md §3).
// 러너가 상태를 DB에 기록한 뒤 여기로 이벤트를 발행하고, /events 라우트가 구독한다.
// 인메모리 싱글턴 — Next dev HMR 재평가에도 하나만 유지되도록 globalThis 캐시.

import { appendChatMessage } from "../db/queries";
import type {
  ArtifactDeltaEvent,
  ChatMessage,
  ChatMessageKind,
  NodeStatusEvent,
  RunStatusEvent,
  SseEvent,
} from "../types";

type Subscriber = (event: SseEvent) => void;

class RunEventBus {
  /** runId → subscriber 집합. */
  private subscribers = new Map<string, Set<Subscriber>>();

  subscribe(runId: string, fn: Subscriber): () => void {
    let set = this.subscribers.get(runId);
    if (!set) {
      set = new Set();
      this.subscribers.set(runId, set);
    }
    set.add(fn);
    return () => {
      const s = this.subscribers.get(runId);
      if (!s) return;
      s.delete(fn);
      if (s.size === 0) this.subscribers.delete(runId);
    };
  }

  private emit(runId: string, event: SseEvent): void {
    const set = this.subscribers.get(runId);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(event);
      } catch {
        // 개별 구독자 오류는 발행을 막지 않는다.
      }
    }
  }

  emitRunStatus(runId: string, ev: Omit<RunStatusEvent, "type">): void {
    this.emit(runId, { type: "run_status", ...ev });
  }

  emitNodeStatus(runId: string, ev: Omit<NodeStatusEvent, "type">): void {
    this.emit(runId, { type: "node_status", ...ev });
  }

  emitArtifactDelta(runId: string, ev: Omit<ArtifactDeltaEvent, "type">): void {
    this.emit(runId, { type: "artifact_delta", ...ev });
  }

  /**
   * chat_card 발행(A5) — DB(appendChatMessage)에 먼저 쓰고 SSE 통지.
   * 진실은 DB. run 구독으로 relay(카드는 runId를 담아 events 라우트가 relay).
   * @param runId SSE 라우팅 키(발행 대상 run). null이면 통지 생략(DB만).
   */
  emitChatCard(
    pipelineId: string,
    kind: Extract<ChatMessageKind, "card_run" | "card_human">,
    payload: unknown,
    runId: string | null,
    nodeRunId?: string | null,
  ): ChatMessage {
    // DB 먼저(진실의 원천).
    const message = appendChatMessage(pipelineId, kind, payload, runId, nodeRunId);
    // SSE 통지(구독 중인 run으로 relay).
    if (runId) this.emit(runId, { type: "chat_card", message });
    return message;
  }

  /** 구독자 존재 여부(디버그·테스트용). */
  hasSubscribers(runId: string): boolean {
    return (this.subscribers.get(runId)?.size ?? 0) > 0;
  }
}

const globalForBus = globalThis as unknown as {
  __recruitFlowEventBus?: RunEventBus;
};

export const eventBus: RunEventBus =
  globalForBus.__recruitFlowEventBus ?? new RunEventBus();

if (process.env.NODE_ENV !== "production") {
  globalForBus.__recruitFlowEventBus = eventBus;
}
