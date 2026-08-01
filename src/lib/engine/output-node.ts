// Output 노드 실행 — 상류 마크다운 1개 → 결정론적 HTML(nodes.md §4, 결정 10).
// LLM 없음. run 시작 검증에서 마크다운 상류 정확히 1개를 보장하므로 여기선 선택만.

import { createArtifact, finalizeArtifact } from "../db/queries";
import { renderResumeHtml } from "../html/render";
import type { Artifact } from "../types";
import type { UpstreamInput } from "./input-composer";

/**
 * Output 노드 1회 실행. 마크다운 상류 아티팩트를 HTML로 렌더해 아티팩트(html) 방출.
 * @throws 마크다운 상류가 정확히 1개가 아니면(검증을 통과했으면 발생하지 않음).
 */
export function runOutputNode(
  nodeRunId: string,
  inputs: UpstreamInput[],
  title?: string,
): Artifact {
  const markdownInputs = inputs.filter((i) => i.artifact.format === "markdown");
  if (markdownInputs.length !== 1) {
    throw new Error(
      `Output 노드의 마크다운 상류가 ${markdownInputs.length}개입니다(정확히 1개여야 함)`,
    );
  }

  const md = markdownInputs[0].artifact.content;
  const html = renderResumeHtml(md, title);

  const art = createArtifact(nodeRunId, "html", "");
  finalizeArtifact(art.id, html, null);
  return { ...art, content: html };
}
