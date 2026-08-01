// GET /api/documents/[id]  → DocumentDetail (현재 본문)
// PUT /api/documents/[id]  { content, note? } → DocumentDetail  (새 버전, author='human')
import { NextResponse } from "next/server";
import { addDocumentVersion, getDocument } from "@/lib/db/queries";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const doc = getDocument(id);
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
  const doc = addDocumentVersion(id, body.content, "human", body.note);
  if (!doc) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(doc);
}
