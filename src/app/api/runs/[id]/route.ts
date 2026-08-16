// GET /api/runs/[id] → RunState (run + node_runs + artifacts) — 새로고침 복원용.
import { NextResponse } from "next/server";
import { getRun, getRunState } from "@/lib/db/queries";
import { getCurrentUserId } from "@/lib/auth/context";
import { eventBus } from "@/lib/engine/events";
import type { RunState } from "@/lib/types";
import { withUser } from "@/lib/auth/with-user";

export const GET = withUser(async (
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) => {
  const { id } = await ctx.params;
  // DB 조회 전에 캡처해야 한다. 이후 번호의 이벤트는 스냅샷과 겹치더라도
  // 클라이언트가 멱등 병합하고, 이 번호 이하의 영속 이벤트는 스냅샷이 덮는다.
  const cursor = eventBus.getRunCursor(id);
  // getRun은 owner-agnostic(group B) — 라우트에서 직접 소유권 검증(createRun이 항상 각인).
  const run = await getRun(id);
  if (!run || run.ownerId !== getCurrentUserId()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const state = await getRunState(id);
  if (!state) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(state satisfies RunState, {
    headers: { "X-Stream-Cursor": String(cursor) },
  });
});
