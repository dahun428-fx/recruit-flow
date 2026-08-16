// GET  /api/folders         → Folder[]
// POST /api/folders  { name, parentId? } → Folder
import { NextResponse } from "next/server";
import { createFolder, listFolders } from "@/lib/db/queries";
import { withUser } from "@/lib/auth/with-user";

export const GET = withUser(async () => {
  const data = await listFolders();
  return NextResponse.json(data);
});

export const POST = withUser(async (req: Request) => {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    parentId?: string | null;
  };
  if (typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const folder = await createFolder(body.name.trim(), body.parentId ?? null);
  return NextResponse.json(folder, { status: 201 });
});
