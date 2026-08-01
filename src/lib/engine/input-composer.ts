// Q11 입력 합성 — 상류 아티팩트 → `## 입력: {노드명}` 섹션.
// 마크다운은 본문 그대로, JSON은 코드블록으로. 프롬프트 템플릿 변수 없음.
// 입력 순서는 엣지 inputOrder로 정렬(엣지 클릭 순번 조정, nodes.md Q11).

import type { Artifact } from "../types";

export interface UpstreamInput {
  /** 상류 노드 이름(섹션 라벨). */
  nodeName: string;
  /** 상류 노드 id(주 입력 지정·중복 판정용). 자동 주입 입력은 null. */
  sourceNodeId: string | null;
  /** 상류 노드 실행이 낸 아티팩트. */
  artifact: Artifact;
  /** 엣지 inputOrder(정렬용). */
  order: number;
}

/**
 * 상류 아티팩트들을 유저 메시지로 합성.
 * - 각 상류마다 `## 입력: {노드명}` 헤더.
 * - format === 'json'이면 ```json 코드블록, 아니면 마크다운 본문 그대로.
 * - order 오름차순, 동률이면 안정적(입력 배열 순서 유지).
 */
export function composeInput(inputs: UpstreamInput[]): string {
  const sorted = [...inputs]
    .map((inp, i) => ({ inp, i }))
    .sort((a, b) => a.inp.order - b.inp.order || a.i - b.i)
    .map((x) => x.inp);

  const sections = sorted.map((inp) => {
    const header = `## 입력: ${inp.nodeName}`;
    const { format, content } = inp.artifact;
    if (format === "json") {
      return `${header}\n\n\`\`\`json\n${content.trim()}\n\`\`\``;
    }
    // markdown / html 등은 본문 그대로.
    return `${header}\n\n${content.trim()}`;
  });

  return sections.join("\n\n");
}
