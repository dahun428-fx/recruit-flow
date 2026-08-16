// 챗봇 tool 9종(M3+M5, 결정 5) — in-process MCP 서버. pipelineId를 클로저로 바인딩.
// 권한 = tool 집합으로 물리적 강제(m3-plan §핵심 구조): 배선/삭제/노드수정 tool은
// **존재 자체를 만들지 않는다**. 챗봇이 그래프에 직접 손댈 방법이 없다.
//
// 읽기 5종: list_block_defs · get_graph(요약만, 결정 G) · list_documents · get_document · check_jd_coverage(M5).
// 쓰기 4종: add_block(항상 tray=true) · register_document · edit_document(부분 치환) · trigger_run.
// **금지(미제공)**: add_edge/wire/connect/delete_node/update_node/move_node/delete_edge.

import {
  createSdkMcpServer,
  tool,
  type McpServerConfig,
  type SdkMcpToolDefinition,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import {
  addDocumentVersion,
  appendChatMessage,
  createBlockDef,
  createDocument,
  getDocument,
  getGraph,
  listBlockDefs,
  listDocuments,
} from "../db/queries";
import type { AgentConfig, BlockDef, NodeConfig, NodeType } from "../types";
import { eventBus } from "./events";
import { runner } from "./runner";

const MCP_SERVER_NAME = "chatbot";

/** 챗봇에게 허용되는 tool 이름(결정 5 회귀 검증에 노출). 이 목록이 권한의 전부다. */
export const CHATBOT_TOOL_NAMES = [
  "list_block_defs",
  "get_graph",
  "list_documents",
  "get_document",
  "check_jd_coverage",
  "add_block",
  "register_document",
  "edit_document",
  "trigger_run",
] as const;

export type ChatbotToolName = (typeof CHATBOT_TOOL_NAMES)[number];

const NODE_TYPES: NodeType[] = [
  "agent",
  "input",
  "output",
  "gate",
  "human",
  "skill",
  "rule",
  "tool",
];

/**
 * add_block config 최소 필드 검증(결정 5). 불충분하면 에러 메시지를 반환 →
 * tool 결과로 챗봇에 전달되어 챗봇이 되묻는다(진행 안 함).
 */
function validateBlockConfig(
  type: NodeType,
  config: unknown,
): { ok: true; config: NodeConfig } | { ok: false; error: string } {
  const c = (config ?? {}) as Record<string, unknown>;
  switch (type) {
    case "agent": {
      const role = typeof c.role === "string" ? c.role.trim() : "";
      const outputFormat = c.outputFormat;
      if (!role) {
        return { ok: false, error: "Agent 블록은 config.role(시스템 프롬프트 역할)이 필요합니다." };
      }
      if (outputFormat !== "markdown" && outputFormat !== "json") {
        return {
          ok: false,
          error: "Agent 블록은 config.outputFormat이 'markdown' 또는 'json'이어야 합니다.",
        };
      }
      const out: AgentConfig = {
        role,
        outputFormat,
        ...(typeof c.model === "string" ? { model: c.model } : {}),
        ...(typeof c.jsonSchema === "string" ? { jsonSchema: c.jsonSchema } : {}),
        ...(c.gapMode === "ask" || c.gapMode === "annotate"
          ? { gapMode: c.gapMode }
          : {}),
      };
      return { ok: true, config: out };
    }
    case "skill":
    case "rule": {
      const content = typeof c.content === "string" ? c.content.trim() : "";
      if (!content) {
        return { ok: false, error: `${type} 블록은 config.content(마크다운 본문)가 필요합니다.` };
      }
      return { ok: true, config: { content } as NodeConfig };
    }
    case "tool": {
      const toolName = c.toolName;
      if (toolName !== "get_document" && toolName !== "search_documents") {
        return {
          ok: false,
          error: "Tool 블록은 config.toolName이 'get_document' 또는 'search_documents'여야 합니다.",
        };
      }
      return { ok: true, config: { toolName } as NodeConfig };
    }
    case "input": {
      // 문서 참조 또는 인라인 텍스트. 최소 하나.
      const documentId = typeof c.documentId === "string" ? c.documentId : undefined;
      const inlineText = typeof c.inlineText === "string" ? c.inlineText : undefined;
      if (!documentId && !inlineText) {
        return {
          ok: false,
          error: "Input 블록은 config.documentId 또는 config.inlineText가 필요합니다.",
        };
      }
      return {
        ok: true,
        config: {
          ...(documentId ? { documentId } : {}),
          ...(inlineText ? { inlineText } : {}),
        } as NodeConfig,
      };
    }
    case "output": {
      const templateId = typeof c.templateId === "string" ? c.templateId : "default";
      return { ok: true, config: { templateId } as NodeConfig };
    }
    case "gate": {
      const expr = typeof c.expr === "string" ? c.expr.trim() : "";
      if (!expr) {
        return { ok: false, error: "Gate 블록은 config.expr(조건식)이 필요합니다." };
      }
      const maxLoops = typeof c.maxLoops === "number" ? c.maxLoops : 3;
      return { ok: true, config: { expr, maxLoops } as NodeConfig };
    }
    case "human": {
      const instruction = typeof c.instruction === "string" ? c.instruction.trim() : "";
      if (!instruction) {
        return { ok: false, error: "Human 블록은 config.instruction(안내문)이 필요합니다." };
      }
      const allowEdit = c.allowEdit === true;
      return { ok: true, config: { instruction, allowEdit } as NodeConfig };
    }
    default:
      return { ok: false, error: `알 수 없는 블록 타입: ${type}` };
  }
}

const textResult = (text: string) => ({ content: [{ type: "text" as const, text }] });

// ---- check_jd_coverage 결정론 매칭 헬퍼 ------------------------------------
// LLM 판단 없이 순수 문자열 처리로 JD 요건을 뽑고 증거 본문과 대조한다.
// 챗봇(LLM)이 이 결과를 받아 자연어로 경고/판단한다.

/** JD 본문에서 요건성 라인을 추출. 자격요건/필수/우대/requirements 섹션의 불릿 우선,
 *  없으면 문서 전체의 불릿·번호 목록을 요건으로 간주. */
function extractRequirements(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const reqSectionRe =
    /(자격\s*요건|지원\s*자격|필수|필수\s*요건|우대|우대\s*사항|requirements?|qualifications?|responsibilities?)/i;
  const headingRe = /^\s{0,3}(#{1,6}\s+|\*\*|[0-9]+[.)]\s*\*\*)?/; // 마크다운 헤딩 감지 보조
  const bulletRe = /^\s*(?:[-*+•]|\d+[.)])\s+(.*\S)/;

  const inSectionReqs: string[] = [];
  const allBullets: string[] = [];
  let inReqSection = false;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const isHeading = /^\s{0,3}#{1,6}\s+/.test(line) || /^\s*\*\*.+\*\*\s*:?\s*$/.test(line);
    if (isHeading) {
      inReqSection = reqSectionRe.test(line);
      // 헤딩 자체는 요건 라인으로 넣지 않는다.
      continue;
    }
    const m = bulletRe.exec(line);
    if (m) {
      const text = m[1].trim();
      if (text) {
        allBullets.push(text);
        if (inReqSection) inSectionReqs.push(text);
      }
    }
  }

  let reqs = inSectionReqs.length > 0 ? inSectionReqs : allBullets;
  if (reqs.length === 0) {
    // 불릿이 전혀 없으면 핵심 토큰(길이 있는 명사구 후보)으로 대체.
    reqs = extractCoreTokens(content).map((tok) => tok);
  }
  // 중복 제거(대소문자·공백 무시).
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of reqs) {
    const key = normalize(r);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  // 폭주 방지: 상위 40개까지만.
  return out.slice(0, 40);
}

/** 불릿이 없는 JD를 위한 폴백: 흔한 기술/직무 키워드성 토큰 추출(결정론). */
function extractCoreTokens(content: string): string[] {
  const words = content
    .split(/[^0-9A-Za-z가-힣+.#/]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
  const stop = new Set(STOPWORDS);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    const key = w.toLowerCase();
    if (stop.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(w);
    if (out.length >= 20) break;
  }
  return out;
}

const STOPWORDS = [
  "the", "and", "for", "with", "you", "your", "our", "are", "will", "have",
  "및", "또는", "그리고", "등", "이상", "관련", "경험", "능력", "우대", "필수",
  "대한", "있는", "있음", "합니다", "하는", "대해",
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** 요건 라인에서 매칭용 키워드(2자 이상 토큰)를 뽑는다. */
function keywordsOf(req: string): string[] {
  const toks = req
    .split(/[^0-9A-Za-z가-힣+.#/]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.includes(t.toLowerCase()));
  // 중복 제거.
  return Array.from(new Set(toks.map((t) => t)));
}

/** 요건이 증거 본문(정규화 텍스트)에 커버되는지 판정. 요건 키워드의 과반이
 *  증거에 등장하면 커버로 본다(결정론). 키워드가 없으면 요건 전체 문자열로 판정. */
function isCovered(req: string, evidenceNorm: string): boolean {
  const kws = keywordsOf(req);
  if (kws.length === 0) {
    return evidenceNorm.includes(normalize(req));
  }
  let hit = 0;
  for (const kw of kws) {
    if (evidenceNorm.includes(kw.toLowerCase())) hit++;
  }
  // 과반(내림) 이상 등장 시 커버. 키워드 1개면 그 1개가 있어야 함.
  return hit * 2 >= kws.length && hit > 0;
}

/**
 * 챗봇 tool 9종을 pipelineId·runIdRef 클로저로 바인딩한 in-process MCP 서버.
 * @param runIdRef trigger_run이 시작한 runId를 담을 참조(A/U가 card_run으로 읽음).
 */
export function buildChatbotMcp(
  pipelineId: string,
  runIdRef?: { current: string | null },
): {
  mcpServers: Record<string, McpServerConfig>;
  allowedTools: string[];
} {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: SdkMcpToolDefinition<any>[] = [];

  // ---- 읽기 tool ----------------------------------------------------------
  tools.push(
    tool(
      "list_block_defs",
      "저장된 블록 정의(팔레트·트레이) 목록을 반환한다. 이름·타입·설명·트레이 여부.",
      {},
      async () => {
        const defs = await listBlockDefs();
        if (defs.length === 0) return textResult("저장된 블록이 없습니다.");
        const lines = defs.map(
          (d) =>
            `- [${d.type}] ${d.name}${d.tray ? " (트레이 대기)" : ""}: ${
              d.description || "(설명 없음)"
            }`,
        );
        return textResult(lines.join("\n"));
      },
    ),
  );

  tools.push(
    tool(
      "get_graph",
      "현재 파이프라인 그래프의 요약(노드 이름·타입, 엣지 배선)을 반환한다. config 전문은 제외.",
      {},
      async () => {
        const graph = await getGraph(pipelineId);
        if (graph.nodes.length === 0) return textResult("그래프가 비어 있습니다(노드 없음).");
        const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
        const nodeLines = graph.nodes.map((n) => `- ${n.name} [${n.type}]`);
        const edgeLines = graph.edges.map((e) => {
          const s = nodeById.get(e.sourceNodeId)?.name ?? e.sourceNodeId;
          const t = nodeById.get(e.targetNodeId)?.name ?? e.targetNodeId;
          const kind = e.kind === "mount" ? "장착" : "흐름";
          const handle = e.sourceHandle ? `(${e.sourceHandle})` : "";
          return `- ${s}${handle} --${kind}--> ${t}`;
        });
        return textResult(
          `## 노드\n${nodeLines.join("\n")}\n\n## 배선\n${
            edgeLines.length ? edgeLines.join("\n") : "(엣지 없음)"
          }`,
        );
      },
    ),
  );

  tools.push(
    tool(
      "list_documents",
      "문서 라이브러리의 문서 목록(id·이름·현재 버전)을 반환한다.",
      {},
      async () => {
        const docs = await listDocuments();
        if (docs.length === 0) return textResult("문서가 없습니다.");
        return textResult(
          docs.map((d) => `- ${d.id}: ${d.name} (v${d.currentVersion})`).join("\n"),
        );
      },
    ),
  );

  tools.push(
    tool(
      "get_document",
      "문서 id로 문서 전문을 읽는다.",
      { id: z.string().describe("문서 id") },
      async (args) => {
        const doc = await getDocument(args.id);
        if (!doc) return textResult(`문서를 찾을 수 없습니다: ${args.id}`);
        return textResult(`# ${doc.name} (v${doc.currentVersion})\n\n${doc.content}`);
      },
    ),
  );

  tools.push(
    tool(
      "check_jd_coverage",
      "JD와 증거베이스(경력·프로필 등 문서)를 **읽어** 필수 요건 커버리지를 결정론적으로 요약한다. " +
        "JD 요건 목록·커버된 요건·누락 요건·대략적 커버리지 비율을 돌려주니, " +
        "그 요약을 근거로 직군 불일치(예: 백엔드 이력에 프론트엔드 JD)를 '작성해줘' 전에 사용자에게 경고하라. " +
        "**읽기 전용** — 그래프·문서·DB를 전혀 바꾸지 않는다.",
      {
        jdDocName: z
          .string()
          .optional()
          .describe("JD 문서 이름(기본 '현재 JD')"),
        evidenceDocNames: z
          .array(z.string())
          .optional()
          .describe("증거로 볼 문서 이름 목록(생략 시 JD·'현재 JD'를 제외한 문서 전체)"),
      },
      async (args) => {
        const jdName = (args.jdDocName ?? "현재 JD").trim() || "현재 JD";
        const docs = await listDocuments();
        const jdMeta = docs.find((d) => d.name === jdName);
        if (!jdMeta) {
          return textResult(
            `JD 문서 '${jdName}'을 찾을 수 없습니다. list_documents로 문서 이름을 확인하거나 ` +
              `register_document(name="현재 JD", ...)로 JD를 먼저 등록하세요.`,
          );
        }
        const jdDoc = await getDocument(jdMeta.id);
        if (!jdDoc) return textResult(`JD 문서를 읽을 수 없습니다: ${jdName}`);

        // 증거 문서 결정: 지정되면 그 이름들, 아니면 JD·'현재 JD' 제외 전체.
        let evidenceMetas;
        if (args.evidenceDocNames && args.evidenceDocNames.length > 0) {
          const wanted = new Set(args.evidenceDocNames.map((n) => n.trim()));
          evidenceMetas = docs.filter((d) => wanted.has(d.name));
        } else {
          evidenceMetas = docs.filter((d) => d.name !== jdName && d.name !== "현재 JD");
        }
        if (evidenceMetas.length === 0) {
          return textResult(
            `증거로 삼을 문서가 없습니다(JD '${jdName}' 외 문서 없음). ` +
              `경력·프로필 등 증거 문서를 register_document로 먼저 등록하세요.`,
          );
        }

        const evidenceContents: { name: string; content: string }[] = [];
        for (const m of evidenceMetas) {
          const d = await getDocument(m.id);
          if (d) evidenceContents.push({ name: d.name, content: d.content });
        }
        const evidenceNorm = normalize(
          evidenceContents.map((e) => e.content).join("\n"),
        );

        const requirements = extractRequirements(jdDoc.content);
        if (requirements.length === 0) {
          return textResult(
            `JD '${jdName}'에서 요건 라인을 추출하지 못했습니다. ` +
              `자격요건/필수/우대 섹션이나 불릿 목록이 있는지 확인하세요.`,
          );
        }

        const covered: string[] = [];
        const missing: string[] = [];
        for (const req of requirements) {
          if (isCovered(req, evidenceNorm)) covered.push(req);
          else missing.push(req);
        }
        const ratio =
          requirements.length > 0
            ? Math.round((covered.length / requirements.length) * 100)
            : 0;

        const fmt = (arr: string[]) =>
          arr.length ? arr.map((r) => `- ${r}`).join("\n") : "- (없음)";

        return textResult(
          [
            `# JD 커버리지 요약: ${jdDoc.name} (v${jdDoc.currentVersion})`,
            ``,
            `참조 증거 문서: ${evidenceContents.map((e) => e.name).join(", ")}`,
            `대략적 커버리지: ${ratio}% (${covered.length}/${requirements.length} 요건 매칭)`,
            ``,
            `## 커버된 요건 (${covered.length})`,
            fmt(covered),
            ``,
            `## 누락 요건 (${missing.length})`,
            fmt(missing),
            ``,
            `> 이 수치는 문자열 매칭 기반의 대략치입니다. 직군 자체가 다르면 커버리지가 크게 낮으니, ` +
              `그럴 경우 실행 전에 사용자에게 불일치를 짚어 주세요.`,
          ].join("\n"),
        );
      },
    ),
  );

  // ---- 쓰기 tool(결정 5 = add만) -----------------------------------------
  tools.push(
    tool(
      "add_block",
      "새 블록 정의를 만든다. **항상 트레이(tray)로만 들어가며 캔버스에 배치되지 않는다** — " +
        "배선·배치는 사람 몫이다. type과 config(타입별 필수 필드)를 지정하라.",
      {
        type: z.enum(NODE_TYPES as [NodeType, ...NodeType[]]).describe("블록 타입(8종)"),
        name: z.string().describe("블록 이름"),
        description: z.string().optional().describe("블록 설명"),
        config: z
          .record(z.string(), z.unknown())
          .describe("타입별 config(Agent면 role·outputFormat 필수 등)"),
      },
      async (args) => {
        const type = args.type as NodeType;
        const validated = validateBlockConfig(type, args.config);
        if (!validated.ok) {
          return textResult(`블록을 만들 수 없습니다: ${validated.error}`);
        }
        const def: BlockDef = await createBlockDef({
          type,
          name: args.name,
          description: args.description ?? "",
          config: validated.config,
          origin: "chatbot",
          tray: true, // 항상 트레이(결정 5).
          enabled: true,
          upsert: false, // 항상 새 트레이 항목 — 기존 승인 블록 덮어쓰기 금지.
        });
        // card_block 발행(payload = 결정 H). DB 먼저(진실) → SSE 통지(R1).
        const payload = {
          blockDefId: def.id,
          type: def.type,
          name: def.name,
          description: def.description,
        };
        const message = await appendChatMessage(pipelineId, "card_block", payload);
        eventBus.emitChatMessage(pipelineId, message);
        // 트레이 갱신 통지 — 카드가 가리키는 항목이 팔레트에도 즉시 보이도록.
        eventBus.emitBlockDef("updated", def.id, def);
        return textResult(
          `블록 '${def.name}'(${def.type})을 트레이에 추가했습니다. ` +
            `팔레트의 '새 블록' 트레이에서 캔버스로 드래그해 배치·배선하세요.`,
        );
      },
    ),
  );

  tools.push(
    tool(
      "register_document",
      "문서를 라이브러리에 등록한다. 같은 이름이 있으면 새 버전으로 갱신, 없으면 새 문서로 생성한다(author=llm).",
      {
        name: z.string().describe("문서 이름"),
        content: z.string().describe("문서 본문(마크다운)"),
        note: z.string().optional().describe("버전 노트"),
      },
      async (args) => {
        const existing = (await listDocuments()).find((d) => d.name === args.name);
        if (existing) {
          const updated = await addDocumentVersion(existing.id, args.content, "llm", args.note);
          if (!updated) return textResult(`문서 갱신에 실패했습니다: ${args.name}`);
          eventBus.emitDocumentChanged("updated", updated.id, updated.currentVersion);
          return textResult(
            `문서 '${updated.name}'을 v${updated.currentVersion}으로 갱신했습니다.`,
          );
        }
        const created = await createDocument(args.name, args.content, "llm", args.note);
        eventBus.emitDocumentChanged("created", created.id, created.currentVersion);
        return textResult(`문서 '${created.name}'을 새로 등록했습니다(v1).`);
      },
    ),
  );

  tools.push(
    tool(
      "edit_document",
      "기존 문서의 일부를 부분 치환한다. 전문 재작성이 필요 없다 — old_string(바꿀 원문)과 " +
        "new_string(대체 텍스트)만 넘긴다. old_string은 문서 안에서 **정확히 한 곳**에만 " +
        "일치해야 한다; 여러 곳에 걸리면 더 긴 문맥을 포함해 다시 시도하라. 치환 후 새 버전이 저장된다.",
      {
        name: z.string().describe("편집할 문서 이름"),
        old_string: z.string().describe("바꿀 원문(문서 안에서 정확히 1곳에만 일치해야 함)"),
        new_string: z.string().describe("대체 텍스트"),
        note: z.string().optional().describe("버전 노트"),
      },
      async (args) => {
        const existing = (await listDocuments()).find((d) => d.name === args.name);
        if (!existing) return textResult(`문서를 찾을 수 없습니다: ${args.name}`);
        const doc = await getDocument(existing.id);
        if (!doc) return textResult(`문서를 찾을 수 없습니다: ${args.name}`);
        if (args.old_string === "") {
          return textResult("old_string이 비어 있습니다. 바꿀 원문을 지정하세요.");
        }
        // 정확히 1곳만 성공(0곳=찾을 수 없음, 2곳+=더 긴 문맥 필요).
        const parts = doc.content.split(args.old_string);
        const matches = parts.length - 1;
        if (matches === 0) {
          return textResult(
            `old_string을 문서 '${args.name}'에서 찾을 수 없습니다. 원문을 정확히 복사했는지 확인하세요.`,
          );
        }
        if (matches > 1) {
          return textResult(
            `old_string이 문서 '${args.name}'의 ${matches}곳에 일치합니다. ` +
              `정확히 한 곳만 지목하도록 앞뒤 문맥을 더 길게 포함해 다시 시도하세요.`,
          );
        }
        const newContent = parts.join(args.new_string);
        const updated = await addDocumentVersion(existing.id, newContent, "llm", args.note);
        if (!updated) return textResult(`문서 갱신에 실패했습니다: ${args.name}`);
        eventBus.emitDocumentChanged("updated", updated.id, updated.currentVersion);
        return textResult(
          `문서 '${updated.name}'을 v${updated.currentVersion}으로 편집했습니다. ` +
            `1곳을 치환했습니다.`,
        );
      },
    ),
  );

  tools.push(
    tool(
      "trigger_run",
      "현재 파이프라인을 실행한다. 그래프 검증에 실패하면 실행하지 않고 오류 목록을 반환하니 " +
        "그 내용을 사용자에게 자연어로 설명하라.",
      {},
      async () => {
        const result = await runner.start(pipelineId);
        if ("errors" in result) {
          const lines = result.errors.map((e) => `- (${e.code}) ${e.message}`);
          return textResult(
            `실행할 수 없습니다. 그래프 검증에서 다음 문제가 발견되었습니다:\n${lines.join("\n")}`,
          );
        }
        if (runIdRef) runIdRef.current = result.runId;
        return textResult(
          `파이프라인 실행을 시작했습니다(run ${result.runId}). 진행 상황은 실행 카드로 확인됩니다.`,
        );
      },
    ),
  );

  const server = createSdkMcpServer({
    name: MCP_SERVER_NAME,
    version: "1.0.0",
    tools,
  });
  const allowedTools = CHATBOT_TOOL_NAMES.map(
    (n) => `mcp__${MCP_SERVER_NAME}__${n}`,
  );
  return { mcpServers: { [MCP_SERVER_NAME]: server }, allowedTools };
}

/** MCP 서버 이름(결정 5 회귀 검증에 노출). */
export const CHATBOT_MCP_SERVER_NAME = MCP_SERVER_NAME;
