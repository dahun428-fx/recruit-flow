// GET  /api/documents  → Document[]
// POST /api/documents  { name, content?, note? } → DocumentDetail  (author='human')
import { NextResponse } from "next/server";
import { createDocument, listDocuments } from "@/lib/db/queries";

export async function GET() {
  return NextResponse.json(listDocuments());
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    content?: string;
    note?: string;
  };
  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const doc = createDocument(name, body.content ?? "", "human", body.note);
  return NextResponse.json(doc, { status: 201 });
}
