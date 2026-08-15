// GET    /api/block-defs/[id]                          → BlockDef
// PATCH  /api/block-defs/[id]  { tray?, name?, config? } → BlockDef
// DELETE /api/block-defs/[id]                          → { ok }
import { NextResponse } from "next/server";
import {
  deleteBlockDef,
  getBlockDef,
  setBlockDefName,
  setBlockDefTray,
  updateBlockDefConfig,
} from "@/lib/db/queries";
import { eventBus } from "@/lib/engine/events";
import type { NodeConfig } from "@/lib/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const def = getBlockDef(id);
  if (!def) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(def);
}

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
    name?: string;
    config?: NodeConfig;
  };

  const hasTray = typeof body.tray === "boolean";
  const hasName = typeof body.name === "string";
  const hasConfig = body.config !== undefined && body.config !== null;

  if (!hasTray && !hasName && !hasConfig) {
    return NextResponse.json(
      { error: "tray, name, config 중 하나 이상의 필드가 필요합니다." },
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

  // tray 적용(트레이 승인 = tray:false).
  if (hasTray) {
    setBlockDefTray(id, body.tray as boolean);
  }

  // config 적용 — 정의를 편집하는 유일한 진입점(참조 시맨틱 결정 1).
  if (hasConfig) {
    if (typeof body.config !== "object" || Array.isArray(body.config)) {
      return NextResponse.json({ error: "config는 객체여야 합니다." }, { status: 400 });
    }
    updateBlockDefConfig(id, body.config as NodeConfig);
  }

  const updated = getBlockDef(id);
  // 블록 정의 변경 → 열려 있는 모든 pipeline 채널에 브로드캐스트(engine.md §3).
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
