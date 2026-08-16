// Claude Agent SDK 래퍼 — auth·모델·스트림·장착 tool을 이 한 곳에 캡슐화.
// - 인증: 로컬 Claude Code 구독 자격 재사용(~/.claude/.credentials.json).
// - 단발 호출(세션 재사용 없음): 매 실행마다 systemPrompt(역할+장착) + user prompt로 재구성.
// - 텍스트 델타 스트림 노출: includePartialMessages로 stream_event의 text_delta만 흘림.
// - M2 Tool 장착(A6): get_document/search_documents/ask_human를 in-process MCP tool로.
// - JSON 출력 강제: 파싱 실패 시 1회 자동 재시도(nodes.md Q12).

import {
  createSdkMcpServer,
  query,
  tool,
  type McpServerConfig,
  type Options,
  type SdkMcpToolDefinition,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { getDocument, listDocuments } from "../db/queries";

/** 엔진 기본 모델(미지정 시). 노드별로 AgentConfig.model로 재정의 가능. */
export const DEFAULT_MODEL = "claude-sonnet-4-6";

/** 파일/실행 계열 내장 tool은 항상 차단(순수 텍스트 생성 + 장착 tool만 허용). */
const DISALLOWED_TOOLS = [
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "WebFetch",
  "WebSearch",
  "Task",
  "TodoWrite",
  "NotebookEdit",
];

/** 장착 tool 이름(mount.ts에서 파생). ask_human은 gapMode==='ask'가 자동 부여. */
export type MountedToolName = "get_document" | "search_documents";

/** ask_human 대기 처리기 — Agent가 ask_human 호출 시 질문을 넘기고 답변을 기다린다. */
export type AskHumanHandler = (question: string) => Promise<string>;

export interface RunAgentParams {
  /** 시스템 프롬프트(역할 + 장착 합성 — 호출자 몫). */
  systemPrompt: string;
  /** 합성된 유저 입력(Q11 입력 섹션). */
  userPrompt: string;
  /** 미지정 시 DEFAULT_MODEL. */
  model?: string;
  /** 취소용. runner가 abort 시 사용. */
  abortController?: AbortController;
  /** 텍스트 델타 콜백(스트리밍 저장·SSE 발행). */
  onDelta?: (chunk: string) => void;
  /** 장착 tool(get_document/search_documents). */
  mountedTools?: MountedToolName[];
  /** gapMode==='ask'면 ask_human 부여. 호출 시 이 핸들러로 대기·답변. */
  askHuman?: AskHumanHandler;
}

export interface RunAgentResult {
  /** 최종 누적 텍스트. */
  text: string;
}

const MCP_SERVER_NAME = "recruit";

/** 장착 tool·ask_human을 in-process MCP 서버로 구성. 없으면 null. */
function buildMcpConfig(
  mountedTools: MountedToolName[] | undefined,
  askHuman: AskHumanHandler | undefined,
): { mcpServers?: Record<string, McpServerConfig>; allowedTools: string[] } {
  // 이질 스키마 tool을 한 배열에 — 서버 옵션은 SdkMcpToolDefinition<any>[] 기대.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: SdkMcpToolDefinition<any>[] = [];
  const allowedTools: string[] = [];

  const has = (name: MountedToolName) => (mountedTools ?? []).includes(name);

  if (has("get_document")) {
    tools.push(
      tool(
        "get_document",
        "문서 라이브러리에서 id로 문서 전문을 읽는다.",
        { id: z.string().describe("문서 id") },
        async (args) => {
          const doc = await getDocument(args.id);
          if (!doc) {
            return {
              content: [{ type: "text", text: `문서를 찾을 수 없습니다: ${args.id}` }],
            };
          }
          return {
            content: [
              { type: "text", text: `# ${doc.name} (v${doc.currentVersion})\n\n${doc.content}` },
            ],
          };
        },
      ),
    );
    allowedTools.push(`mcp__${MCP_SERVER_NAME}__get_document`);
  }

  if (has("search_documents")) {
    tools.push(
      tool(
        "search_documents",
        "문서 이름/본문에서 질의어를 포함하는 문서를 검색해 목록(id·이름)을 반환한다.",
        { query: z.string().describe("검색 질의어") },
        async (args) => {
          const q = args.query.toLowerCase();
          const docs = await listDocuments();
          const details = await Promise.all(docs.map((d) => getDocument(d.id)));
          const matches = details
            .filter(
              (d): d is NonNullable<typeof d> =>
                !!d &&
                (d.name.toLowerCase().includes(q) || d.content.toLowerCase().includes(q)),
            )
            .map((d) => `- ${d.id}: ${d.name}`);
          const text = matches.length
            ? matches.join("\n")
            : "일치하는 문서가 없습니다.";
          return { content: [{ type: "text", text }] };
        },
      ),
    );
    allowedTools.push(`mcp__${MCP_SERVER_NAME}__search_documents`);
  }

  if (askHuman) {
    tools.push(
      tool(
        "ask_human",
        "정보 갭이 있어 진행할 수 없을 때 사람에게 질문한다. 답변이 도착하면 이어서 진행한다.",
        { question: z.string().describe("사람에게 물을 질문") },
        async (args) => {
          const answer = await askHuman(args.question);
          return { content: [{ type: "text", text: answer }] };
        },
      ),
    );
    allowedTools.push(`mcp__${MCP_SERVER_NAME}__ask_human`);
  }

  if (tools.length === 0) return { allowedTools: [] };

  const server = createSdkMcpServer({ name: MCP_SERVER_NAME, version: "1.0.0", tools });
  return {
    mcpServers: { [MCP_SERVER_NAME]: server },
    allowedTools,
  };
}

/**
 * 단발 query() 호출. 텍스트 델타를 onDelta로 흘리고 최종 텍스트를 반환.
 * 인증/네트워크/모델 오류는 throw — 호출자(agent-node)가 노드 실패로 격리한다.
 */
/**
 * 테스트 스텁 seam — globalThis.__recruitFlowAgentStub가 설정돼 있으면
 * 실제 query() 대신 스텁을 호출한다(스모크 테스트용, 프로덕션 영향 없음).
 */
type AgentStub = (params: RunAgentParams) => Promise<RunAgentResult>;
function getStub(): AgentStub | undefined {
  return (globalThis as unknown as { __recruitFlowAgentStub?: AgentStub })
    .__recruitFlowAgentStub;
}

export async function runAgent(params: RunAgentParams): Promise<RunAgentResult> {
  const stub = getStub();
  if (stub) {
    const res = await stub(params);
    if (res.text) params.onDelta?.(res.text);
    return res;
  }
  const {
    systemPrompt,
    userPrompt,
    model,
    abortController,
    onDelta,
    mountedTools,
    askHuman,
  } = params;

  const { mcpServers, allowedTools } = buildMcpConfig(mountedTools, askHuman);
  const hasTools = allowedTools.length > 0;

  const options: Options = {
    systemPrompt,
    model: model || DEFAULT_MODEL,
    includePartialMessages: true,
    // tool 장착 시 tool_use↔tool_result 왕복이 필요해 turn을 넉넉히.
    // tool 없어도 복잡한 role(추론·재정리)이 1턴에 최종 텍스트를 못 내면
    // error_max_turns로 실패하므로 여유를 둔다(상한일 뿐 강제 아님).
    maxTurns: hasTools ? 12 : 4,
    disallowedTools: DISALLOWED_TOOLS,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    ...(hasTools ? { allowedTools, mcpServers } : {}),
    ...(abortController ? { abortController } : {}),
  };

  const stream = query({ prompt: userPrompt, options });

  let deltaText = "";
  let resultText: string | null = null;

  for await (const message of stream) {
    if (message.type === "stream_event") {
      const ev = message.event as {
        type?: string;
        delta?: { type?: string; text?: string };
      };
      if (
        ev?.type === "content_block_delta" &&
        ev.delta?.type === "text_delta" &&
        typeof ev.delta.text === "string"
      ) {
        deltaText += ev.delta.text;
        onDelta?.(ev.delta.text);
      }
      continue;
    }

    if (message.type === "result") {
      if (message.subtype === "success") {
        resultText = message.result;
      } else {
        const subtype = (message as { subtype?: string }).subtype ?? "unknown";
        throw new Error(`SDK query failed: ${subtype}`);
      }
    }

    if (message.type === "assistant" && message.error) {
      throw new Error(`SDK assistant error: ${message.error}`);
    }
  }

  const text = resultText ?? deltaText;
  if (!text) {
    throw new Error("SDK query returned no text output");
  }
  return { text };
}

/**
 * JSON 출력 강제. 스키마를 프롬프트에 명시하고, 파싱 실패 시 파싱 에러를
 * 피드백으로 붙여 1회 재시도. 재실패면 throw(노드 실패, nodes.md Q12).
 */
export async function runAgentJson(
  params: RunAgentParams & { jsonSchema?: string },
): Promise<{ text: string; parsed: unknown }> {
  const { jsonSchema, ...rest } = params;

  const schemaHint = jsonSchema
    ? `\n\n## 출력 형식\n반드시 아래 JSON 스키마를 만족하는 **JSON만** 출력하라(설명·코드펜스 없이 순수 JSON).\n\n\`\`\`json\n${jsonSchema}\n\`\`\``
    : `\n\n## 출력 형식\n반드시 **JSON만** 출력하라(설명·코드펜스 없이 순수 JSON).`;

  const attempt = async (extraFeedback: string) => {
    // JSON 지시를 system + user 말미 양쪽에 배치(recency로 준수율↑).
    // 임포트된 채점자 role이 markdown 점수표를 강하게 지시하는 경우를 눌러준다.
    const res = await runAgent({
      ...rest,
      systemPrompt: rest.systemPrompt + schemaHint,
      userPrompt: rest.userPrompt + schemaHint + extraFeedback,
    });
    return res.text;
  };

  let text = await attempt("");
  try {
    const parsed = parseJsonLoose(text);
    return { text: normalizeJson(parsed), parsed };
  } catch (e1) {
    const feedback = `\n\n## 재시도\n직전 응답을 JSON으로 파싱하지 못했다: ${
      (e1 as Error).message
    }\n순수 JSON만 다시 출력하라.`;
    text = await attempt(feedback);
    const parsed = parseJsonLoose(text);
    return { text: normalizeJson(parsed), parsed };
  }
}

/** 코드펜스(```json ... ```)나 앞뒤 잡텍스트를 관용적으로 벗겨 파싱. */
export function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    const objMatch = candidate.match(/[{[][\s\S]*[}\]]/);
    if (objMatch) return JSON.parse(objMatch[0]);
    throw new Error("응답을 JSON으로 파싱할 수 없습니다");
  }
}

function normalizeJson(parsed: unknown): string {
  return JSON.stringify(parsed, null, 2);
}
