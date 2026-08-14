// POST /api/pipelines/[id]/chat  { text } → 200 { ok }  (fire-and-forget, 결정 C)
// 흐름: user 저장 → SSE 통지 → runChat 백그라운드 실행 → assistant 확정 + SSE 통지.
// 챗봇 델타·확정은 GET /api/pipelines/[id]/events(pipeline SSE)로 흐른다.
import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { appendChatMessage, getPipeline, listChatMessages } from "@/lib/db/queries";
import { eventBus } from "@/lib/engine/events";
import { runChat } from "@/lib/engine/chat";

// DB·엔진 싱글턴을 사용하므로 Node 런타임 강제.
export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: pipelineId } = await params;

  if (!getPipeline(pipelineId)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "text 필드가 필요합니다." }, { status: 400 });
  }

  // 1. user 메시지 즉시 저장 + pipeline SSE 통지.
  const userMsg = appendChatMessage(pipelineId, "user", { text });
  eventBus.emitChatMessage(pipelineId, userMsg);

  // 2. assistant 메시지용 ID 미리 생성(delta 스트리밍에 사용).
  const assistantMessageId = nanoid();

  // 3. runChat 백그라운드(fire-and-forget) — await 하지 않고 200 즉시 반환.
  const runIdRef: { current: string | null } = { current: null };

  void (async () => {
    try {
      const history = listChatMessages(pipelineId);
      // 히스토리에서 방금 저장한 user 메시지는 이미 포함됨 — runChat 내부에서
      // history + userText를 합성하므로 마지막 user 메시지는 history에서 제외한다.
      // (composeChatPrompt는 history에서 user/assistant만 쓰고 userText를 별도 합성)
      const historyWithoutLastUser = history.filter((m) => m.id !== userMsg.id);

      const result = await runChat({
        pipelineId,
        runIdRef,
        history: historyWithoutLastUser,
        userText: text,
        onDelta: (chunk) =>
          eventBus.emitChatDelta(pipelineId, { messageId: assistantMessageId, chunk }),
      });

      // 4. assistant 텍스트 확정: DB 저장 + pipeline SSE 통지.
      const assistantMsg = appendChatMessage(pipelineId, "assistant", {
        text: result.text,
      }, null, null, assistantMessageId);
      eventBus.emitChatMessage(pipelineId, assistantMsg);
    } catch (err) {
      // 챗봇 실패는 로그만(결정 C — 클라이언트는 SSE로 에러 통지 방법이 없음).
      console.error("[chat] runChat 실패:", err);
      // 빈 assistant 메시지로 확정해 채팅 UI에서 실패를 인지할 수 있게 한다.
      const errMsg = appendChatMessage(pipelineId, "assistant", {
        text: "(챗봇 오류가 발생했습니다. 다시 시도해 주세요.)",
      }, null, null, assistantMessageId);
      eventBus.emitChatMessage(pipelineId, errMsg);
    }
  })();

  // 즉시 200 반환(fire-and-forget, 결정 C).
  return NextResponse.json({ ok: true });
}
