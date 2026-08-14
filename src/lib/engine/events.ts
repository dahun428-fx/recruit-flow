// run별 SSE subscriber 버스. 진실은 DB, SSE는 통지(engine.md §3).
// 러너가 상태를 DB에 기록한 뒤 여기로 이벤트를 발행하고, /events 라우트가 구독한다.
// 인메모리 싱글턴 — Next dev HMR 재평가에도 하나만 유지되도록 globalThis 캐시.

import { appendChatMessage } from "../db/queries";
import type {
  ArtifactDeltaEvent,
  BlockDef,
  ChatMessage,
  ChatMessageKind,
  NodeStatusEvent,
  RunStatusEvent,
  SequencedSseEvent,
  SseEvent,
} from "../types";

type Subscriber = (event: SequencedSseEvent) => void;

class RunEventBus {
  /** runId → subscriber 집합(캔버스·아티팩트 SSE — run 스코프). */
  private subscribers = new Map<string, Set<Subscriber>>();
  /**
   * pipelineId → subscriber 집합(채팅 독 SSE — pipeline 스코프, M3).
   * run 유무와 무관하게 상시 연결. 챗봇 응답·트레이 카드 + card_run/human 미러가
   * 이 채널로 흐른다(engine.md §3 M3 채널 구조).
   */
  private pipelineSubscribers = new Map<string, Set<Subscriber>>();
  private runSequences = new Map<string, number>();
  private pipelineSequences = new Map<string, number>();

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

  /** 파이프라인 스코프 구독(채팅 독, M3). run 유무 무관 상시. */
  subscribePipeline(pipelineId: string, fn: Subscriber): () => void {
    let set = this.pipelineSubscribers.get(pipelineId);
    if (!set) {
      set = new Set();
      this.pipelineSubscribers.set(pipelineId, set);
    }
    set.add(fn);
    return () => {
      const s = this.pipelineSubscribers.get(pipelineId);
      if (!s) return;
      s.delete(fn);
      if (s.size === 0) this.pipelineSubscribers.delete(pipelineId);
    };
  }

  private emit(runId: string, event: SseEvent): void {
    const sequence = (this.runSequences.get(runId) ?? 0) + 1;
    this.runSequences.set(runId, sequence);
    const set = this.subscribers.get(runId);
    if (!set) return;
    for (const fn of set) {
      try {
        fn({ ...event, sequence });
      } catch {
        // 개별 구독자 오류는 발행을 막지 않는다.
      }
    }
  }

  /** 파이프라인 채널 발행(M3). 구독자 오류는 격리. */
  emitToPipeline(pipelineId: string, event: SseEvent): void {
    const sequence = (this.pipelineSequences.get(pipelineId) ?? 0) + 1;
    this.pipelineSequences.set(pipelineId, sequence);
    const set = this.pipelineSubscribers.get(pipelineId);
    if (!set) return;
    for (const fn of set) {
      try {
        fn({ ...event, sequence });
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
   * M3: 카드를 파이프라인 채널로도 **미러** 발행 → ChatDock의 단일 pipeline
   * 구독에 run 이벤트와 챗봇 이벤트가 한 스트림으로 도달(engine.md §3).
   * @param runId SSE 라우팅 키(발행 대상 run). null이면 run 채널 통지 생략(DB·미러만).
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
    const event: SseEvent = { type: "chat_card", message };
    // run 스코프 통지(캔버스 사이드 등 run 구독).
    if (runId) this.emit(runId, event);
    // pipeline 채널 미러(채팅 독).
    this.emitToPipeline(pipelineId, event);
    return message;
  }

  /**
   * 챗봇 응답 스트리밍 델타(M3, 통지 전용). DB엔 완료 시 assistant 1건만 확정되므로
   * 여기서는 파이프라인 채널로만 흘린다(진행 중 델타 유실 허용 — 결정 B).
   */
  emitChatDelta(pipelineId: string, ev: { messageId: string; chunk: string }): void {
    this.emitToPipeline(pipelineId, { type: "chat_delta", ...ev });
  }

  /**
   * 확정된 chat_message(user/assistant/card_block) 통지(M3). DB 저장은 호출자 몫
   * (appendChatMessage) — 여기서는 파이프라인 채널로 통지만 한다.
   */
  emitChatMessage(pipelineId: string, message: ChatMessage): void {
    this.emitToPipeline(pipelineId, { type: "chat_message", message });
  }

  /**
   * 열려 있는 **모든** pipeline 채널에 발행(engine.md §3).
   * block_defs처럼 pipeline_id가 없는 전역 테이블의 변경 통지용 —
   * 특정 채널을 고를 수 없으므로 브로드캐스트가 유일하게 옳은 라우팅이다.
   */
  emitToAllPipelines(event: SseEvent): void {
    for (const [pipelineId, set] of this.pipelineSubscribers) {
      const sequence = (this.pipelineSequences.get(pipelineId) ?? 0) + 1;
      this.pipelineSequences.set(pipelineId, sequence);
      for (const fn of set) {
        try {
          fn({ ...event, sequence });
        } catch {
          // 개별 구독자 오류는 발행을 막지 않는다.
        }
      }
    }
  }

  /** 트레이 변경 통지(block_defs는 전역 → 전 채널 브로드캐스트). */
  emitBlockDef(
    action: "updated" | "deleted",
    blockDefId: string,
    blockDef?: BlockDef,
  ): void {
    this.emitToAllPipelines({ type: "block_def", action, blockDefId, blockDef });
  }

  /** 구독자 존재 여부(디버그·테스트용). */
  hasSubscribers(runId: string): boolean {
    return (this.subscribers.get(runId)?.size ?? 0) > 0;
  }

  /** 파이프라인 구독자 존재 여부(디버그·테스트용). */
  hasPipelineSubscribers(pipelineId: string): boolean {
    return (this.pipelineSubscribers.get(pipelineId)?.size ?? 0) > 0;
  }

  getRunCursor(runId: string): number {
    return this.runSequences.get(runId) ?? 0;
  }

  getPipelineCursor(pipelineId: string): number {
    return this.pipelineSequences.get(pipelineId) ?? 0;
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
