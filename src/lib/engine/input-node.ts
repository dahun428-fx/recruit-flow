// Input 노드 실행 — 문서 최신 버전을 읽어 마크다운 아티팩트 방출(nodes.md §3).
// inlineText 모드 지원. 방출 아티팩트 meta.version에 읽은 문서 버전 기록.

import {
  createArtifact,
  finalizeArtifact,
  getCurrentDocumentVersion,
} from "../db/queries";
import type { Artifact, InputConfig } from "../types";

/**
 * Input 노드 1회 실행. 아티팩트(markdown)를 생성·확정하고 반환.
 * - inlineText가 있으면 그 텍스트를 방출(버전 기록 없음).
 * - 없으면 documentId의 현재 버전 전문을 방출 + meta.version 기록.
 * @throws documentId·inlineText 둘 다 없거나 문서가 없으면.
 */
export async function runInputNode(
  nodeRunId: string,
  config: InputConfig,
): Promise<Artifact> {
  // 인라인 텍스트 모드(고급).
  if (typeof config.inlineText === "string" && config.inlineText.length > 0) {
    const art = await createArtifact(nodeRunId, "markdown", "");
    await finalizeArtifact(art.id, config.inlineText, null);
    return { ...art, content: config.inlineText };
  }

  if (!config.documentId) {
    throw new Error("Input 노드에 documentId 또는 inlineText가 필요합니다");
  }

  const ver = await getCurrentDocumentVersion(config.documentId);
  if (!ver) {
    throw new Error(
      `Input 노드의 문서(${config.documentId})를 찾을 수 없습니다`,
    );
  }

  const art = await createArtifact(nodeRunId, "markdown", "");
  await finalizeArtifact(art.id, ver.content, { version: ver.version });
  return { ...art, content: ver.content, meta: { version: ver.version } };
}
