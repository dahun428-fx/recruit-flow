// PATCH  /api/block-defs/[id]  { tray?, enabled?, name? } → BlockDef
// DELETE /api/block-defs/[id]                             → { ok }
import { NextResponse } from "next/server";
import {
  deleteBlockDef,
  getBlockDef,
  setBlockDefEnabled,
  setBlockDefName,
  setBlockDefTray,
} from "@/lib/db/queries";
import { eventBus } from "@/lib/engine/events";

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
    name?: string;
  };

  const hasTray = typeof body.tray === "boolean";
  const hasEnabled = typeof body.enabled === "boolean";
  const hasName = typeof body.name === "string";

  if (!hasTray && !hasEnabled && !hasName) {
    return NextResponse.json(
      { error: "tray, enabled, name 중 하나 이상의 필드가 필요합니다." },
      { status: 400 },
    );
  }

  // name 검증: trim 후 빈 문자열이면 400.
  if (hasName) {
    const trimmed = (body.name as string).trim();
    if (trimmed === "") {
      return NextResponse.json({ error: "이름은 빈 문자열일 수 없습니다." }, { status: 400 });
    }
    setBlockDefName(id, trimmed);
  }

  // tray 먼저 적용(트레이 승인 = tray:false).
  if (hasTray) {
    setBlockDefTray(id, body.tray as boolean);
  }
  // enabled 적용.
  if (hasEnabled) {
    setBlockDefEnabled(id, body.enabled as boolean);
  }

  const updated = getBlockDef(id);
  // 트레이는 전역 → 열려 있는 모든 pipeline 채널에 통지(engine.md §3).
  if (updated) eventBus.emitBlockDef("updated", id, updated);
  return NextResponse.json(updated);
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
  eventBus.emitBlockDef("deleted", id);
  return NextResponse.json({ ok: true });
}
