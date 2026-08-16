// GET /api/documents/[id]/versions → DocumentVersion[] (최신순, 주체 human/llm 포함)
// 문서 탭 버전 히스토리(ui.md §문서 탭). document_versions가 진실.
import { NextResponse } from "next/server";
import { getDocument, listDocumentVersions } from "@/lib/db/queries";
import { withUser } from "@/lib/auth/with-user";

export const GET = withUser(async (
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) => {
  const { id } = await ctx.params;
  if (!(await getDocument(id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(await listDocumentVersions(id));
});
