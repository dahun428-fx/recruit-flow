// 챗봇 tool 7종(M3, 결정 5) — in-process MCP 서버. pipelineId를 클로저로 바인딩.
// 권한 = tool 집합으로 물리적 강제(m3-plan §핵심 구조): 배선/삭제/노드수정 tool은
// **존재 자체를 만들지 않는다**. 챗봇이 그래프에 직접 손댈 방법이 없다.
//
// 읽기 4종: list_block_defs · get_graph(요약만, 결정 G) · list_documents · get_document.
// 쓰기 3종(결정 5=add만): add_block(항상 tray=true) · register_document · trigger_run.
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
  "add_block",
  "register_document",
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

/**
 * 챗봇 tool 7종을 pipelineId·runIdRef 클로저로 바인딩한 in-process MCP 서버.
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
        const defs = listBlockDefs();
        if (defs.length === 0) return textResult("저장된 블록이 없습니다.");
        const lines = defs.map(
          (d) =>
            `- [${d.type}] ${d.name}${d.tray ? " (트레이 대기)" : ""}${
              d.enabled ? "" : " (비활성)"
            }: ${d.description || "(설명 없음)"}`,
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
        const graph = getGraph(pipelineId);
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
        const docs = listDocuments();
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
        const doc = getDocument(args.id);
        if (!doc) return textResult(`문서를 찾을 수 없습니다: ${args.id}`);
        return textResult(`# ${doc.name} (v${doc.currentVersion})\n\n${doc.content}`);
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
        const def: BlockDef = createBlockDef({
          type,
          name: args.name,
          description: args.description ?? "",
          config: validated.config,
          origin: "chatbot",
          tray: true, // 항상 트레이(결정 5).
          enabled: true,
          upsert: false, // 항상 새 트레이 항목 — 기존 승인 블록 덮어쓰기 금지.
        });
        // card_block 발행(payload = 결정 H).
        const payload = {
          blockDefId: def.id,
          type: def.type,
          name: def.name,
          description: def.description,
        };
        const message = appendChatMessage(pipelineId, "card_block", payload);
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
        const existing = listDocuments().find((d) => d.name === args.name);
        if (existing) {
          const updated = addDocumentVersion(existing.id, args.content, "llm", args.note);
          if (!updated) return textResult(`문서 갱신에 실패했습니다: ${args.name}`);
          return textResult(
            `문서 '${updated.name}'을 v${updated.currentVersion}으로 갱신했습니다.`,
          );
        }
        const created = createDocument(args.name, args.content, "llm", args.note);
        return textResult(`문서 '${created.name}'을 새로 등록했습니다(v1).`);
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
        const result = runner.start(pipelineId);
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
