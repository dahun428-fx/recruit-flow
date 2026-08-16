// PATCH  /api/folders/[id]  { name? } | { parentId? }  → Folder  (rename 또는 move)
// DELETE /api/folders/[id]                              → { ok: true } | 404
//
// PATCH 수용 필드:
//   name     — 폴더 이름 변경
//   parentId — 상위 폴더 이동(null=루트로). 순환 이동 또는 대상 없음은 400.
//   둘 다 한 요청에 제공 시 name 먼저 처리 후 이동.
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { deleteFolder, moveFolder, renameFolder } from "@/lib/db/queries";
import { folders } from "@/lib/db/schema";
import type { Folder } from "@/lib/types";

function getFolder(id: string): Folder | null {
  const row = db.select().from(folders).where(eq(folders.id, id)).get();
  return row ? { id: row.id, name: row.name, parentId: row.parentId ?? null, createdAt: row.createdAt } : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    parentId?: string | null;
  };

  const hasName = typeof body.name === "string";
  const hasParentId = "parentId" in body;

  if (!hasName && !hasParentId) {
    return NextResponse.json({ error: "name 또는 parentId 중 하나는 필수" }, { status: 400 });
  }

  // 이름 변경
  if (hasName) {
    const trimmed = (body.name as string).trim();
    if (trimmed === "") {
      return NextResponse.json({ error: "name must not be empty" }, { status: 400 });
    }
    const renamed = renameFolder(id, trimmed);
    if (!renamed) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
  }

  // 이동(parentId 키가 명시적으로 존재할 때 — undefined 아닌 null 포함)
  if (hasParentId) {
    const parentId = body.parentId ?? null;
    const ok = moveFolder(id, parentId);
    if (!ok) {
      // moveFolder는 ①폴더 없음 ②대상 폴더 없음 ③순환 모두 false 반환.
      // 폴더 존재 여부를 재확인해 404/400 구분.
      const exists = getFolder(id);
      if (!exists) {
        return NextResponse.json({ error: "not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "순환 이동 또는 대상 폴더가 존재하지 않습니다" },
        { status: 400 },
      );
    }
  }

  const result = getFolder(id);
  if (!result) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ok = deleteFolder(id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
