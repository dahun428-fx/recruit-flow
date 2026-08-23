// 팔레트 블록 정의(M1) — Agent/Input/Output 빈 블록 3종만 활성.
// Gate/Human/Skill/Rule/Tool은 비활성 카테고리로 표시(추가 불가).
import { nanoid } from "nanoid";
import type { NodeConfig, NodeRow, NodeType } from "@/lib/types";

export interface BlockDef {
  key: string;
  type: NodeType;
  label: string;
  color: string;
  tip: string;
}

/** M1 활성 카테고리 — 빈 블록 1종씩. */
export const ACTIVE_BLOCKS: BlockDef[] = [
  {
    key: "empty-agent",
    type: "agent",
    label: "빈 Agent",
    color: "var(--c-agent)",
    tip: "빈 Agent. 역할 프롬프트를 직접 작성하는 새 에이전트입니다. JD·증거를 받아 마크다운 또는 JSON을 냅니다",
  },
  {
    key: "empty-input",
    type: "input",
    label: "빈 Input",
    color: "var(--c-input)",
    tip: "파이프라인의 시작점. 문서 라이브러리의 JD·증거 문서를 데이터 흐름에 공급합니다",
  },
  {
    key: "empty-output",
    type: "output",
    label: "빈 Output",
    color: "var(--c-output)",
    tip: "최종 마크다운을 HTML 템플릿으로 결정론적 렌더링. 자기완결형 HTML 1파일로 다운로드합니다",
  },
];

/** 타입별 기본 config. */
export function defaultConfig(type: NodeType): NodeConfig {
  switch (type) {
    case "agent":
      return { role: "", outputFormat: "markdown" };
    case "input":
      return {};
    case "output":
      return { templateId: "default" };
    case "gate":
      return { expr: "score >= 80", maxLoops: 3 };
    case "human":
      return { instruction: "", allowEdit: true };
    case "skill":
    case "rule":
      return { content: "" };
    case "tool":
      return { toolName: "get_document" };
  }
}

/** 타입별 기본 이름. */
export function defaultName(type: NodeType): string {
  switch (type) {
    case "agent":
      return "새 Agent";
    case "input":
      return "새 Input";
    case "output":
      return "새 Output";
    case "gate":
      return "새 Gate";
    case "human":
      return "새 Human";
    case "skill":
      return "새 Skill";
    case "rule":
      return "새 Rule";
    case "tool":
      return "새 Tool";
  }
}

/** 팔레트 블록 → 새 NodeRow(캔버스 좌표는 호출부에서 지정). */
export function makeNode(
  pipelineId: string,
  type: NodeType,
  positionX: number,
  positionY: number,
): NodeRow {
  return {
    id: nanoid(),
    pipelineId,
    type,
    name: defaultName(type),
    positionX,
    positionY,
    blockDefId: null,
    config: defaultConfig(type),
  };
}
