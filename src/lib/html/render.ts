// 마크다운 → 결정론적 HTML(marked, LLM 아님 — 결정 10).
// Output 노드가 사용. 자기완결형 1파일 반환.

import { marked } from "marked";
import { wrapDocument } from "./template";

// 결정론·동기 렌더(비동기 확장 미사용).
marked.setOptions({ gfm: true, breaks: false, async: false });

/**
 * 마크다운 본문을 자기완결형 HTML 문서로 변환.
 * @param markdown 상류 마크다운 아티팩트 본문
 * @param title 문서 title(파일명/헤더용). 미지정 시 첫 h1 또는 기본값.
 */
export function renderResumeHtml(markdown: string, title?: string): string {
  const bodyHtml = marked.parse(markdown) as string;
  const docTitle = title || extractTitle(markdown) || "이력서";
  return wrapDocument(bodyHtml, docTitle);
}

/** 마크다운 첫 `# 제목`을 title로 추출. */
function extractTitle(markdown: string): string | null {
  const m = markdown.match(/^\s*#\s+(.+)$/m);
  return m ? m[1].trim() : null;
}
