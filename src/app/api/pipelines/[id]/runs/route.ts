// GET  /api/pipelines/[id]/runs → Run[]  (run 히스토리 목록, 최신순)
// POST /api/pipelines/[id]/runs → RunStartResult ({ runId } | { errors })
// 검증 실패 시 400 + { errors }. 같은 파이프라인 활성 run 1개 제한(nodes.md §8).
import { NextResponse } from "next/server";
import { getActiveRun, getPipeline, listRuns } from "@/lib/db/queries";
import { runner } from "@/lib/engine/runner";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await getPipeline(id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(await listRuns(id));
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await getPipeline(id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // 같은 파이프라인 동시 run 1개(v1).
  const active = await getActiveRun(id);
  if (active) {
    return NextResponse.json(
      { error: "이미 실행 중인 run이 있습니다", runId: active.id },
      { status: 409 },
    );
  }

  // body.from_node_id = 부분 재실행(§8-B). 직전 완료 run에서 상류 아티팩트 복사.
  let fromNodeId: string | undefined;
  try {
    const body = (await req.json()) as { from_node_id?: string } | null;
    if (body && typeof body.from_node_id === "string") fromNodeId = body.from_node_id;
  } catch {
    // 본문 없음 = 전체 실행.
  }

  let result;
  if (fromNodeId) {
    const upstreamRunId = await runner.latestFinishedRunId(id);
    if (!upstreamRunId) {
      return NextResponse.json(
        { error: "부분 재실행할 이전 완료 run이 없습니다" },
        { status: 400 },
      );
    }
    result = await runner.startFrom(id, fromNodeId, upstreamRunId);
  } else {
    result = await runner.start(id);
  }

  if ("errors" in result) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result, { status: 201 });
}
