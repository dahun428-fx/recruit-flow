// POST /api/runs/[id]/cancel → { ok } — 현재 SDK 호출 abort, run cancelled 마감.
import { NextResponse } from "next/server";
import { getRun } from "@/lib/db/queries";
import { getCurrentUserId } from "@/lib/auth/context";
import { runner } from "@/lib/engine/runner";
import { withUser } from "@/lib/auth/with-user";

export const POST = withUser(async (
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) => {
  const { id } = await ctx.params;
  // getRun은 owner-agnostic(group B) — 라우트에서 직접 소유권 검증(createRun이 항상 각인).
  const run = await getRun(id);
  if (!run || run.ownerId !== getCurrentUserId()) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const result = await runner.cancel(id);
  return NextResponse.json(result);
});
