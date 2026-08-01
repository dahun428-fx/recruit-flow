// POST /api/runs/[id]/cancel → { ok } — 현재 SDK 호출 abort, run cancelled 마감.
import { NextResponse } from "next/server";
import { getRun } from "@/lib/db/queries";
import { runner } from "@/lib/engine/runner";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!getRun(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const result = runner.cancel(id);
  return NextResponse.json(result);
}
