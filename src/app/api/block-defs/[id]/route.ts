// PATCH /api/block-defs/[id] → BlockDef  (enabled 토글 등)
import { NextResponse } from "next/server";
import { getBlockDef, setBlockDefEnabled } from "@/lib/db/queries";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!getBlockDef(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { enabled?: boolean };
  if (typeof body.enabled === "boolean") {
    const updated = setBlockDefEnabled(id, body.enabled);
    return NextResponse.json(updated);
  }
  return NextResponse.json({ error: "지원하지 않는 필드" }, { status: 400 });
}
