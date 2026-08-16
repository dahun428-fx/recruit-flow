// POST /api/node-runs/[id]/approve → Human 승인(nodes.md Q14).
// body: { editedContent?: string } — 편집본이면 승인본에 반영(meta.editedBy=human).
// 채팅 카드·사이드 패널 공용. 인메모리 대기 없으면 러너가 DB에서 재하이드레이션(§8-E).
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

  let editedContent: string | undefined;
  try {
    const body = (await req.json()) as { editedContent?: string } | null;
    if (body && typeof body.editedContent === "string") {
      editedContent = body.editedContent;
    }
  } catch {
    // 본문 없음 = 승인만(입력 그대로 통과).
  }

  const result = await runner.approve(id, editedContent);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "승인 실패" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
});
