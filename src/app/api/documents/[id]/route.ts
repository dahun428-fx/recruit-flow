// GET    /api/documents/[id]                    → DocumentDetail (현재 본문)
// PUT    /api/documents/[id]  { content, note? } → DocumentDetail  (새 버전, author='human')
// PATCH  /api/documents/[id]  { folderId }       → { ok: true }   (폴더 이동)
// DELETE /api/documents/[id]                    → { ok: true } | 404
import { NextResponse } from "next/server";
import { addDocumentVersion, deleteDocument, getDocument, moveDocument } from "@/lib/db/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(doc);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    content?: string;
    note?: string;
  };
  if (typeof body.content !== "string") {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 },
    );
  }
  const doc = await addDocumentVersion(id, body.content, "human", body.note);
  if (!doc) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(doc);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    folderId?: string | null;
  };

  if (!("folderId" in body)) {
    return NextResponse.json({ error: "folderId is required" }, { status: 400 });
  }

  // folderId=null → 루트로 이동, folderId=string → 해당 폴더로 이동
  const ok = await moveDocument(id, body.folderId ?? null);
  if (!ok) {
    // moveDocument는 ①문서 없음 ②폴더 없음 모두 false 반환.
    // 문서 존재 여부로 404/400 구분.
    const doc = await getDocument(id);
    if (!doc) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "대상 폴더가 존재하지 않습니다" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = await deleteDocument(id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // document_versions는 FK onDelete:"cascade"로 함께 삭제됨.
  // Input 노드가 config.documentId로 이 문서를 참조 중이었다면
  // 실행 시점에 "문서 없음"으로 실패(JSON 필드라 DB 제약 없음).
  return NextResponse.json({ ok: true });
}
