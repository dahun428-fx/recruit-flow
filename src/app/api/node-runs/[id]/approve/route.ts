// POST /api/node-runs/[id]/approve → Human 승인(nodes.md Q14).
// body: { editedContent?: string } — 편집본이면 승인본에 반영(meta.editedBy=human).
// 채팅 카드·사이드 패널 공용. 인메모리 대기 없으면 러너가 DB에서 재하이드레이션(§8-E).
import { NextResponse } from "next/server";
import { runner } from "@/lib/engine/runner";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let editedContent: string | undefined;
  try {
    const body = (await req.json()) as { editedContent?: string } | null;
    if (body && typeof body.editedContent === "string") {
      editedContent = body.editedContent;
    }
  } catch {
    // 본문 없음 = 승인만(입력 그대로 통과).
  }

  const result = await runner.approve(id, editedContent);
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "승인 실패" }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
