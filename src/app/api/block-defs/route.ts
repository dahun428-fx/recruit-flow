// GET  /api/block-defs        → BlockDef[]  (기본: enabled 항목만; 팔레트 fetch)
// GET  /api/block-defs?all=1  → BlockDef[]  (enabled 무관 전체, 큐레이션 UI용)
// POST /api/block-defs        → BlockDef    (블록 정의 생성 — 승격/임포터/수동 생성)
import { NextResponse } from "next/server";
import { createBlockDef, listBlockDefs } from "@/lib/db/queries";
import type { NodeConfig, NodeType } from "@/lib/types";

export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  return NextResponse.json(listBlockDefs({ enabledOnly: !all }));
}

export async function POST(req: Request) {
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

  const created = createBlockDef({
    type: body.type,
    name: body.name,
    description: body.description,
    config: body.config,
    origin: body.origin ?? "human",
    enabled: body.enabled,
    tray: body.tray,
  });

  return NextResponse.json(created, { status: 201 });
}
