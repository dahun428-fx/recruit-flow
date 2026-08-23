// GET  /api/documents  → Document[]
// POST /api/documents  { name, content?, note? } → DocumentDetail  (author='human')
import { NextResponse } from "next/server";
import { createDocument, listDocuments } from "@/lib/db/queries";
import { getCurrentUserId } from "@/lib/auth/context";
import { eventBus } from "@/lib/engine/events";
import { withUser } from "@/lib/auth/with-user";

export const GET = withUser(async () => {
  return NextResponse.json(await listDocuments());
});

export const POST = withUser(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    content?: string;
    note?: string;
  };
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const doc = await createDocument(name, body.content ?? "", "human", body.note);
  // 사람 경로도 챗봇 register_document와 동일하게 SSE 통지(engine.md §3) —
  // 탐색기·열린 탭이 실시간 갱신된다.
  eventBus.emitDocumentChanged(getCurrentUserId(), "created", doc.id, doc.currentVersion);
  return NextResponse.json(doc, { status: 201 });
});
