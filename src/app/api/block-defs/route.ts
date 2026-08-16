// GET  /api/block-defs        → BlockDef[]  (전체 — 팔레트·탐색기 fetch)
// POST /api/block-defs        → BlockDef    (블록 정의 생성 — 승격/임포터/수동 생성)
//
// M4 결정 5(enabled 토글 폐지): enabled로 목록을 거르지 않는다. 토글이 사라져
// enabled=false를 다시 켤 UI가 없으므로, 필터링은 블록을 영구히 숨기는 함정이
// 된다. `all` 파라미터는 하위호환으로 무시하고 항상 전체를 반환한다.
import { NextResponse } from "next/server";
import { createBlockDef, listBlockDefs } from "@/lib/db/queries";
import { getCurrentUserId } from "@/lib/auth/context";
import { eventBus } from "@/lib/engine/events";
import type { NodeConfig, NodeType } from "@/lib/types";
import { withUser } from "@/lib/auth/with-user";

export const GET = withUser(async () => {
  return NextResponse.json(await listBlockDefs());
});

export const POST = withUser(async (req: Request) => {
  const body = (await req.json().catch(() => null)) as {
    type?: NodeType;
    name?: string;
    description?: string;
    config?: NodeConfig;
    origin?: "human" | "chatbot" | "import";
    enabled?: boolean;
    tray?: boolean;
  } | null;

  if (!body || !body.type || !body.name || !body.config) {
    return NextResponse.json(
      { error: "type, name, config 필드가 필요합니다." },
      { status: 400 },
    );
  }

  const created = await createBlockDef({
    type: body.type,
    name: body.name,
    description: body.description,
    config: body.config,
    origin: body.origin ?? "human",
    enabled: body.enabled,
    tray: body.tray,
  });

  // 트레이 통지 — block_defs는 owner_id 보유 → 해당 owner 채널에만(auth.md §6).
  eventBus.emitBlockDef(getCurrentUserId(), "updated", created.id, created);
  return NextResponse.json(created, { status: 201 });
});
