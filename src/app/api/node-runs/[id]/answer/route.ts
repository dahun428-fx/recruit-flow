// POST /api/node-runs/[id]/answer → 갭 인터뷰(ask_human) 답변(engine.md §2).
// body: { answer: string } — 대기 중인 ask_human tool 결과로 전달해 SDK 재개.
// 프로세스 재시작으로 세션이 죽었으면 node_run failed 마감(§8-E 타협).
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nodeRuns } from "@/lib/db/schema";
import { getRun } from "@/lib/db/queries";
import { getCurrentUserId, getDb } from "@/lib/auth/context";
import { runner } from "@/lib/engine/runner";
import { withUser } from "@/lib/auth/with-user";

export const POST = withUser(async (
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) => {
  const { id } = await ctx.params;

  // node_run → run → 소유권 검증.
  const nrRows = await getDb().select().from(nodeRuns).where(eq(nodeRuns.id, id)).limit(1);
  if (!nrRows[0]) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const run = await getRun(nrRows[0].runId);
  if (!run || run.ownerId !== getCurrentUserId()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let answer = "";
  try {
    const body = (await req.json()) as { answer?: string } | null;
    if (body && typeof body.answer === "string") answer = body.answer;
  } catch {
    // 무시 — answer 빈 문자열로 처리.
  }
  if (!answer.trim()) {
    return NextResponse.json({ error: "answer가 필요합니다" }, { status: 400 });
  }

  const result = await runner.answer(id, answer);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "답변 처리 실패" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
});
