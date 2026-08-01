// GET /api/pipelines/[id]/graph  → { nodes, edges }
// PUT /api/pipelines/[id]/graph  { nodes, edges } → { ok }
import { NextResponse } from "next/server";
import { getGraph, getPipeline, saveGraph } from "@/lib/db/queries";
import type { EdgeRow, NodeRow } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!getPipeline(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(getGraph(id));
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!getPipeline(id)) {
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
  saveGraph(id, { nodes: body.nodes, edges: body.edges });
  return NextResponse.json({ ok: true });
}
