// GET /api/pipelines/[id]/graph  → { nodes, edges }
// PUT /api/pipelines/[id]/graph  { nodes, edges } → { ok }
import { NextResponse } from "next/server";
import { getGraph, getPipeline, saveGraph } from "@/lib/db/queries";
import { validateGraphPayload } from "@/lib/validation";
import type { EdgeRow, NodeRow } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await getPipeline(id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(await getGraph(id));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await getPipeline(id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as {
    nodes?: NodeRow[];
    edges?: EdgeRow[];
  } | null;
  if (!body || !Array.isArray(body.nodes) || !Array.isArray(body.edges)) {
    return NextResponse.json(
      { error: "nodes and edges arrays are required" },
      { status: 400 },
    );
  }
  // 구조 검증(engine.md §2) — DB 제약 위반이 500으로 새어나가지 않게.
  const errors = validateGraphPayload(body.nodes, body.edges);
  if (errors.length > 0) {
    return NextResponse.json(
      { error: errors[0], errors },
      { status: 400 },
    );
  }
  await saveGraph(id, { nodes: body.nodes, edges: body.edges });
  return NextResponse.json({ ok: true });
}
