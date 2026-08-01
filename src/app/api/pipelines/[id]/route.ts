// PATCH  /api/pipelines/[id]  { name?, lastOpenedAt? } → Pipeline
// DELETE /api/pipelines/[id]  → { ok }
import { NextResponse } from "next/server";
import { deletePipeline, updatePipeline } from "@/lib/db/queries";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    lastOpenedAt?: number;
  };
  const updated = updatePipeline(id, body);
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = deletePipeline(id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
