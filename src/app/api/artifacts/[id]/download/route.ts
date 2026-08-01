// GET /api/artifacts/[id]/download → HTML 파일 다운로드(Content-Disposition).
// Output 노드의 html 아티팩트가 대상. 다른 format도 열람은 되지만 파일명 확장자 조정.
import { getArtifact } from "@/lib/db/queries";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const artifact = getArtifact(id);
  if (!artifact) {
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
}
