// GET /api/runs/[id] → RunState (run + node_runs + artifacts) — 새로고침 복원용.
import { NextResponse } from "next/server";
import { getRunState } from "@/lib/db/queries";
import { eventBus } from "@/lib/engine/events";
import type { RunState } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // DB 조회 전에 캡처해야 한다. 이후 번호의 이벤트는 스냅샷과 겹치더라도
  // 클라이언트가 멱등 병합하고, 이 번호 이하의 영속 이벤트는 스냅샷이 덮는다.
  const cursor = eventBus.getRunCursor(id);
  const state = getRunState(id);
  if (!state) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(state satisfies RunState, {
    headers: { "X-Stream-Cursor": String(cursor) },
  });
}
