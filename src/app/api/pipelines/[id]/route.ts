// GET    /api/pipelines/[id]  → Pipeline | 404
// PATCH  /api/pipelines/[id]  { name?, lastOpenedAt? } → Pipeline
// DELETE /api/pipelines/[id]  → { ok }
import { NextResponse } from "next/server";
import { deletePipeline, getPipeline, updatePipeline } from "@/lib/db/queries";
import { withUser } from "@/lib/auth/with-user";

export const GET = withUser(async (
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) => {
  const { id } = await ctx.params;
  const pipeline = await getPipeline(id);
  if (!pipeline) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(pipeline);
});

export const PATCH = withUser(async (
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) => {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    lastOpenedAt?: number;
  };
  const updated = await updatePipeline(id, body);
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
});

export const DELETE = withUser(async (
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) => {
  const { id } = await ctx.params;
  const ok = await deletePipeline(id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
});
