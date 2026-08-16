// GET /api/artifacts/[id]/download → HTML 파일 다운로드(Content-Disposition).
// Output 노드의 html 아티팩트가 대상. 다른 format도 열람은 되지만 파일명 확장자 조정.
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { nodeRuns } from "@/lib/db/schema";
import { getArtifact, getRun } from "@/lib/db/queries";
import { getCurrentUserId } from "@/lib/auth/context";
import { withUser } from "@/lib/auth/with-user";

export const runtime = "nodejs";

export const GET = withUser(async (
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) => {
  const { id } = await ctx.params;
  const artifact = await getArtifact(id);
  if (!artifact) {
    return new Response("not found", { status: 404 });
  }

  // artifact → node_run → run → 소유권 검증.
  const nrRows = await db.select().from(nodeRuns).where(eq(nodeRuns.id, artifact.nodeRunId)).limit(1);
  if (!nrRows[0]) {
    return new Response("not found", { status: 404 });
  }
  const run = await getRun(nrRows[0].runId);
  if (!run || run.ownerId !== getCurrentUserId()) {
    return new Response("not found", { status: 404 });
  }

  const ext =
    artifact.format === "html"
      ? "html"
      : artifact.format === "json"
        ? "json"
        : "md";
  const contentType =
    artifact.format === "html"
      ? "text/html; charset=utf-8"
      : artifact.format === "json"
        ? "application/json; charset=utf-8"
        : "text/markdown; charset=utf-8";

  const filename = `resume-${id}.${ext}`;

  return new Response(artifact.content, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
