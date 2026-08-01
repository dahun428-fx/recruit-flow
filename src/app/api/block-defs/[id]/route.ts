// PATCH  /api/block-defs/[id]  { tray?, enabled? } → BlockDef
// DELETE /api/block-defs/[id]                      → { ok }
import { NextResponse } from "next/server";
import {
  deleteBlockDef,
  getBlockDef,
  setBlockDefEnabled,
  setBlockDefTray,
} from "@/lib/db/queries";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!getBlockDef(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    tray?: boolean;
    enabled?: boolean;
  };

  // tray와 enabled를 각각 또는 동시에 처리.
  const hasTray = typeof body.tray === "boolean";
  const hasEnabled = typeof body.enabled === "boolean";

  if (!hasTray && !hasEnabled) {
    return NextResponse.json({ error: "tray 또는 enabled 필드가 필요합니다." }, { status: 400 });
  }

  // tray 먼저 적용(트레이 승인 = tray:false).
  if (hasTray) {
    setBlockDefTray(id, body.tray as boolean);
  }
  // enabled 적용.
  if (hasEnabled) {
    setBlockDefEnabled(id, body.enabled as boolean);
  }

  return NextResponse.json(getBlockDef(id));
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = deleteBlockDef(id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
