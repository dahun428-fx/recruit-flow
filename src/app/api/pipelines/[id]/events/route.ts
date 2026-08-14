// GET /api/pipelines/[id]/events → SSE 스트림(파이프라인 스코프, M3).
// 채팅 독 전용 — run 유무 무관 상시 연결.
// 이벤트: chat_delta · chat_message · chat_card(run 미러).
// SSE는 통지, 진실의 원천은 DB(engine.md §3).
import { getPipeline } from "@/lib/db/queries";
import { eventBus } from "@/lib/engine/events";
import type { SequencedSseEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: pipelineId } = await params;

  if (!getPipeline(pipelineId)) {
    return new Response("not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const send = (event: SequencedSseEvent) => {
        if (closed) return;
        const payload = `id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          closed = true;
        }
      };

      // 초기 연결 확인 코멘트.
      controller.enqueue(encoder.encode(": connected\n\n"));

      const unsubscribe = eventBus.subscribePipeline(pipelineId, send);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // keep-alive 코멘트(프록시 타임아웃 방지).
      // 파이프라인 SSE는 종결 조건 없음 — 클라이언트가 연결을 끊을 때까지 유지.
      const keepAlive = setInterval(() => {
        if (closed) {
          clearInterval(keepAlive);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          cleanup();
        }
      }, 15000);

      // 스트림 abort 처리(클라이언트 연결 해제).
      _req.signal?.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
