// POST /api/node-runs/[id]/answer → 갭 인터뷰(ask_human) 답변(engine.md §2).
// body: { answer: string } — 대기 중인 ask_human tool 결과로 전달해 SDK 재개.
// 프로세스 재시작으로 세션이 죽었으면 node_run failed 마감(§8-E 타협).
import { NextResponse } from "next/server";
import { runner } from "@/lib/engine/runner";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let answer = "";
  try {
    const body = (await req.json()) as { answer?: string } | null;
    if (body && typeof body.answer === "string") answer = body.answer;
  } catch {
    // 무시 — answer 빈 문자열로 처리.
  }
  if (!answer.trim()) {
    return NextResponse.json({ error: "answer가 필요합니다" }, { status: 400 });
  }

  const result = await runner.answer(id, answer);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "답변 처리 실패" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
