// GET /api/documents/[id]/versions → DocumentVersion[] (최신순, 주체 human/llm 포함)
// 문서 탭 버전 히스토리(ui.md §문서 탭). document_versions가 진실.
import { NextResponse } from "next/server";
import { getDocument, listDocumentVersions } from "@/lib/db/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await getDocument(id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(await listDocumentVersions(id));
}
