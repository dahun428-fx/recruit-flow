// 장착(mount) 파생 — Agent 노드의 config.mounts를 SDK 번역 대상으로 분류(nodes.md §2, M4 결정 3).
// M4 재설계: skill/rule/tool은 캔버스 독립 노드·mount 엣지가 아니라 Agent config.mounts[] 칩이다.
// 러너는 resolve된 스냅샷을 넘기므로, 각 MountRef는 이미 type·name·override(=완결 config)를
// 담고 있다 → deriveMounts는 DB 조회 0회로 자족(스냅샷 불변성, engine.md §1).

import type {
  AgentConfig,
  Graph,
  MountRef,
  NodeRow,
  RuleConfig,
  SkillConfig,
  ToolConfig,
} from "../types";

export interface MountedTool {
  toolName: "get_document" | "search_documents";
}

export interface AgentMounts {
  /** Rule 정의 content (시스템 프롬프트 뒤 append). */
  rules: { name: string; content: string }[];
  /** Skill 정의 content (시스템 프롬프트 주입). */
  skills: { name: string; content: string }[];
  /** Tool 정의 → 허용 tool 목록. */
  tools: MountedTool[];
}

/**
 * Agent 노드의 config.mounts[]를 skill/rule/tool로 분류해 SDK 번역 대상으로 반환한다.
 * 입력 graph는 **resolve된 스냅샷**을 기대한다(runner가 resolveGraph로 만든 것) —
 * 그 경우 각 MountRef는 type·name·override(완결 config)를 담아 DB 조회가 필요 없다.
 *
 * 방어:
 * - agentNodeId가 없거나 Agent가 아니면 빈 mounts.
 * - MountRef.type이 비어 있으면(미resolve·정의 삭제 경합) override 모양으로 추론:
 *   toolName 있으면 tool, 아니면 rule로 폴백. name 없으면 blockDefId.
 * - 폐기된 mount **엣지**가 스냅샷에 남아 있어도 무시한다(순회 대상 아님).
 */
export function deriveMounts(graph: Graph, agentNodeId: string): AgentMounts {
  const empty: AgentMounts = { rules: [], skills: [], tools: [] };

  const agent: NodeRow | undefined = graph.nodes.find((n) => n.id === agentNodeId);
  if (!agent || agent.type !== "agent") return empty;

  const mounts = (agent.config as Partial<AgentConfig>).mounts;
  if (!mounts || mounts.length === 0) return empty;

  const rules: AgentMounts["rules"] = [];
  const skills: AgentMounts["skills"] = [];
  const tools: MountedTool[] = [];

  for (const m of mounts) {
    const kind = classifyMount(m);
    const name = m.name ?? m.blockDefId;
    const override = (m.override ?? {}) as Partial<
      SkillConfig & RuleConfig & ToolConfig
    >;
    if (kind === "tool") {
      const toolName = (override as ToolConfig).toolName;
      if (toolName === "get_document" || toolName === "search_documents") {
        tools.push({ toolName });
      }
      continue;
    }
    const content = (override as SkillConfig | RuleConfig).content ?? "";
    if (kind === "skill") {
      skills.push({ name, content });
    } else {
      rules.push({ name, content });
    }
  }

  return { rules, skills, tools };
}

/**
 * MountRef의 장착 종류 판정. resolve된 스냅샷이면 type이 채워져 있어 그대로 쓴다.
 * type이 없으면(미resolve·정의 삭제 경합) override 모양으로 추론 — toolName은
 * tool 고유 필드, content는 skill/rule 공유라 폴백은 rule(append로 무해).
 */
function classifyMount(m: MountRef): "skill" | "rule" | "tool" {
  if (m.type === "skill" || m.type === "rule" || m.type === "tool") return m.type;
  const override = m.override ?? {};
  if ("toolName" in override && (override as ToolConfig).toolName) return "tool";
  return "rule";
}

/** 역할 + 장착(Rule append, Skill 주입) → 최종 시스템 프롬프트. */
export function composeSystemPrompt(role: string, mounts: AgentMounts): string {
  let prompt = role;
  for (const skill of mounts.skills) {
    prompt += `\n\n## 스킬: ${skill.name}\n${skill.content.trim()}`;
  }
  for (const rule of mounts.rules) {
    prompt += `\n\n## 규칙: ${rule.name}\n${rule.content.trim()}`;
  }
  return prompt;
}
