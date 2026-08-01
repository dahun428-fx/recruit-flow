// GET /api/runs/[id]/events → SSE 스트림.
// SSE는 통지 — 클라이언트는 접속 시 REST(GET /api/runs/[id])로 상태를 읽고 구독한다.
// 이벤트 이름 = payload.type (run_status/node_status/artifact_delta).
import { getRun } from "@/lib/db/queries";
import { eventBus } from "@/lib/engine/events";
import type { SseEvent } from "@/lib/types";

// DB·러너 싱글턴을 쓰므로 Node 런타임 강제(엣지 아님).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = getRun(id);
  if (!run) {
    return new Response("not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: SseEvent) => {
        if (closed) return;
        const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          closed = true;
        }
      };

      // 초기 코멘트(연결 확인) + 현재 run 상태 1회 통지.
      controller.enqueue(encoder.encode(": connected\n\n"));

      const unsubscribe = eventBus.subscribe(id, send);

      // run이 이미 종결됐으면 마지막 상태를 즉시 통지하고 닫는다.
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
      const keepAlive = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          cleanup();
        }
      }, 15000);

      // 종결 상태면 곧바로 정리(구독자는 재접속 시 REST로 최종 상태 확인).
      // waiting_human은 재개(approve/answer) 대기라 스트림 유지.
      if (run.status !== "running" && run.status !== "waiting_human") {
        cleanup();
      }
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
