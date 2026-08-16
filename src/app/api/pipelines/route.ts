// GET  /api/pipelines  → PipelineSummary[]
// POST /api/pipelines  { name } → Pipeline
import { NextResponse } from "next/server";
import { createPipeline, listPipelines } from "@/lib/db/queries";
import { withUser } from "@/lib/auth/with-user";

export const GET = withUser(async () => {
  return NextResponse.json(await listPipelines());
});

export const POST = withUser(async (req) => {
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  return NextResponse.json(await createPipeline(name), { status: 201 });
});
