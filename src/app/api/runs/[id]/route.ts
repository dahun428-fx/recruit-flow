// GET /api/runs/[id] → RunState (run + node_runs + artifacts) — 새로고침 복원용.
import { NextResponse } from "next/server";
import { getRunState } from "@/lib/db/queries";
import type { RunState } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const state = getRunState(id);
  if (!state) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(state satisfies RunState);
}
