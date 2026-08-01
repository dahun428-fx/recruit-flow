// GET /api/block-defs        → BlockDef[]  (기본: enabled 항목만; 팔레트 fetch)
// GET /api/block-defs?all=1  → BlockDef[]  (enabled 무관 전체, 큐레이션 UI용)
import { NextResponse } from "next/server";
import { listBlockDefs } from "@/lib/db/queries";

export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  return NextResponse.json(listBlockDefs({ enabledOnly: !all }));
}
