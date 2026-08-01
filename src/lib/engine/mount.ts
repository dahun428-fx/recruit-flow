// 장착(mount) 파생 — Agent 노드에 mount 엣지로 붙은 skill/rule/tool 수집(nodes.md Q12).
// 장착 노드→실행 노드는 kind='mount' 점선. 여기서 Agent별 장착 목록을 그래프에서 파생한다.

import type { EdgeRow, Graph, NodeRow, RuleConfig, SkillConfig, ToolConfig } from "../types";

export interface MountedTool {
  toolName: "get_document" | "search_documents";
}

export interface AgentMounts {
  /** Rule 노드 config.content (시스템 프롬프트 뒤 append). */
  rules: { name: string; content: string }[];
  /** Skill 노드 config.content (시스템 프롬프트 주입). */
  skills: { name: string; content: string }[];
  /** Tool 노드 → 허용 tool 목록. */
  tools: MountedTool[];
}

/**
 * 특정 Agent 노드에 mount 엣지로 장착된 skill/rule/tool을 수집한다.
 * mount 엣지: kind==='mount', target=agentNodeId, source=장착 노드.
 */
export function deriveMounts(graph: Graph, agentNodeId: string): AgentMounts {
  const nodeById = new Map<string, NodeRow>(graph.nodes.map((n) => [n.id, n]));
  const mountEdges: EdgeRow[] = graph.edges.filter(
    (e) => e.kind === "mount" && e.targetNodeId === agentNodeId,
  );

  const rules: AgentMounts["rules"] = [];
  const skills: AgentMounts["skills"] = [];
  const tools: MountedTool[] = [];

  for (const e of mountEdges) {
    const src = nodeById.get(e.sourceNodeId);
    if (!src) continue;
    if (src.type === "rule") {
      rules.push({ name: src.name, content: (src.config as RuleConfig).content ?? "" });
    } else if (src.type === "skill") {
      skills.push({ name: src.name, content: (src.config as SkillConfig).content ?? "" });
    } else if (src.type === "tool") {
      tools.push({ toolName: (src.config as ToolConfig).toolName });
    }
  }

  return { rules, skills, tools };
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
