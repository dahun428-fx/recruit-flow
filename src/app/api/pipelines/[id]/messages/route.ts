// GET /api/pipelines/[id]/messages → ChatMessage[]  (파이프라인 채팅 스레드)
import { NextResponse } from "next/server";
import { getPipeline, listChatMessages } from "@/lib/db/queries";
import { eventBus } from "@/lib/engine/events";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await getPipeline(id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const cursor = eventBus.getPipelineCursor(id);
  return NextResponse.json(await listChatMessages(id), {
    headers: { "X-Stream-Cursor": String(cursor) },
  });
}
