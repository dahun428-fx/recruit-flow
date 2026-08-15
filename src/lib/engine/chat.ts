// 챗봇 다회전 진입점(M3, E2+E4) — 사령탑 시스템 프롬프트 + tool 7종 MCP + 다회전 query().
// 파이프라인당 1 영속 스레드: 매 호출 시 chat_messages(user/assistant) 시간순 로드 →
// user prompt에 대화 로그로 합성. tool 결과는 DB 상태에 반영되므로 read tool로 재조회
// (별도 tool-result 히스토리 저장 불요, m3-plan §runChat).
//
// A2 라우트(POST /api/pipelines/[id]/chat)가 이 함수를 호출한다:
//   user 메시지 저장 → runChat({...}) → onDelta로 pipeline SSE 델타 → 최종 텍스트를
//   assistant chat_message로 확정(결정 B: 완료 시 1건만).

import {
  query,
  type McpServerConfig,
  type Options,
} from "@anthropic-ai/claude-agent-sdk";
import type { ChatMessage } from "../types";
import { buildChatbotMcp } from "./chat-tools";
import { DEFAULT_MODEL } from "./sdk";

/** 챗봇 사령탑 시스템 프롬프트(E4, 결정 5 명문화). */
export const CHATBOT_SYSTEM_PROMPT = `당신은 recruit-flow의 **사령탑 챗봇**이다. 사용자가 이력서 생성
파이프라인(레고처럼 조립하는 블록 그래프)을 만들도록 돕는다.

## 당신의 역할
- 사용자의 의도를 이해하고, 필요한 **블록을 만들어 트레이에 넣고**, 문서를 등록하고,
  준비가 되면 파이프라인 **실행을 트리거**한다.
- 그래프의 현재 상태(노드·배선)와 저장된 블록·문서를 읽어 상황을 파악한다.

## ★ 절대 규칙(권한 경계 — 결정 5)
- 당신이 만든 블록은 **항상 트레이(대기 구획)로만** 들어간다. 캔버스에 직접 배치되지 않는다.
- **배선(연결), 삭제, 노드 이동·수정은 전적으로 사람의 몫**이다. 당신에게는 그럴 tool이
  아예 없다 — 당신은 캔버스에 직접 손댈 수 없다.
- 사용자가 "이 노드를 저 노드에 연결해줘 / 이 노드 지워줘 / 위치를 옮겨줘 / 이 노드의
  설정을 바꿔줘"라고 하면, **정중히 거절**하고 그 작업은 캔버스에서 직접 드래그·우클릭으로
  해야 한다고 안내하라. 없는 능력을 있는 척하지 마라.

## 사용 가능한 도구
- 읽기: list_block_defs, get_graph, list_documents, get_document
- 쓰기: add_block(트레이에 블록 추가), register_document(문서 등록/갱신),
  edit_document(기존 문서를 부분 치환으로 수정 — 전문 재작성 불필요), trigger_run(실행)

## 문서 편집 규칙
- 기존 문서의 일부만 고칠 때는 register_document로 전문을 다시 쓰지 말고 **edit_document**로
  old_string→new_string 부분 치환을 하라. old_string은 문서 안에서 정확히 한 곳에만 일치해야 하며,
  여러 곳에 걸리면 앞뒤 문맥을 더 길게 포함해 다시 시도하라.
- 문서를 편집(edit_document/register_document)한 뒤에는 **반드시 응답에 무엇을 어떻게 바꿨는지
  요지를 1~2줄로 명시**하라. 사용자는 diff를 볼 수 없으므로, 어느 문서의 어떤 부분을 어떻게
  바꿨는지 자연어로 요약해줘야 한다.

## 노드 8종 config 요지(add_block에 넘길 config)
- **agent**: role(시스템 프롬프트 역할, 필수) · outputFormat("markdown"|"json", 필수) ·
  model?(선택) · jsonSchema?(json일 때) · gapMode?("ask"=멈추고 질문 / "annotate"=[확인 필요] 표기).
- **input**: documentId?(문서 참조) 또는 inlineText?(인라인 텍스트) 중 하나 필수.
- **output**: templateId(기본 "default"). 상류 마크다운 1개 → 자기완결 HTML.
- **gate**: expr(조건식, 필수. 예 "recruiter.total >= 80 && tech.total >= 80") · maxLoops?(기본 3).
  JSON 채점 상류로 판정, pass/fail 라우팅. 조건식은 상류 노드 "이름"으로 필드 참조.
- **human**: instruction(안내문, 필수) · allowEdit?(편집 허용). 사람 승인 통과 노드.
- **skill**: content(방법론 마크다운, 필수). Agent에 장착.
- **rule**: content(제약 마크다운, 필수). Agent 시스템 프롬프트 뒤 append.
- **tool**: toolName("get_document"|"search_documents"). Agent가 실행 중 호출.

## 실행 의도
사용자가 "작성해줘 / 실행해줘 / 돌려줘" 같은 실행 의도를 보이면 trigger_run을 호출한다.
검증에 실패하면 tool이 오류 목록을 돌려주니, 그 원인을 사용자에게 자연어로 친절히 설명하고
어떻게 고칠지(어떤 블록을 배치·배선해야 하는지) 안내하라 — 이때도 배선은 사람이 한다.

한국어로, 간결하고 실용적으로 답하라.`;

export interface RunChatParams {
  pipelineId: string;
  /** trigger_run이 시작한 runId를 담을 참조(A2/A3가 card_run으로 읽음). */
  runIdRef?: { current: string | null };
  /** 시간순 대화 히스토리(user/assistant). 이번 userText는 여기 미포함. */
  history: ChatMessage[];
  /** 이번 사용자 입력. */
  userText: string;
  /** assistant 텍스트 델타 스트리밍(pipeline SSE 발행용). */
  onDelta?: (chunk: string) => void;
  /** 테스트/커스텀 tool 주입(미지정 시 buildChatbotMcp 기본 7종). */
  tools?: { mcpServers: Record<string, McpServerConfig>; allowedTools: string[] };
}

export interface RunChatResult {
  /** 최종 assistant 텍스트(A2가 chat_message로 확정). */
  text: string;
}

/** 대화 히스토리 + 이번 입력을 user prompt로 합성(파이프라인당 1 영속 스레드). */
function composeChatPrompt(history: ChatMessage[], userText: string): string {
  const turns: string[] = [];
  for (const m of history) {
    if (m.kind === "user") {
      turns.push(`사용자: ${asText(m.payload)}`);
    } else if (m.kind === "assistant") {
      turns.push(`당신(챗봇): ${asText(m.payload)}`);
    }
    // 카드(card_block/card_run/card_human)는 히스토리 로그에 넣지 않는다 —
    // tool 결과·실행 상태는 read tool로 재조회한다(m3-plan).
  }
  const log = turns.length ? `## 지금까지의 대화\n${turns.join("\n\n")}\n\n` : "";
  return `${log}## 새 사용자 메시지\n${userText}`;
}

function asText(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object" && "text" in payload) {
    const t = (payload as { text?: unknown }).text;
    if (typeof t === "string") return t;
  }
  return JSON.stringify(payload);
}

/**
 * 테스트 스텁 seam — globalThis.__recruitFlowChatStub가 있으면 실제 query() 대신 스텁.
 * 스텁은 tools를 직접 호출할 수 있게 params를 그대로 받는다(스모크용).
 */
type ChatStub = (params: RunChatParams) => Promise<RunChatResult>;
function getStub(): ChatStub | undefined {
  return (globalThis as unknown as { __recruitFlowChatStub?: ChatStub })
    .__recruitFlowChatStub;
}

/**
 * 챗봇 다회전 호출. onDelta로 assistant 텍스트 델타를 흘리고 최종 텍스트를 반환한다.
 * 모델 = DEFAULT_MODEL(sonnet). 인증/네트워크 오류는 throw(호출자 A2가 격리).
 */
export async function runChat(params: RunChatParams): Promise<RunChatResult> {
  const stub = getStub();
  if (stub) return stub(params);

  const { pipelineId, runIdRef, history, userText, onDelta } = params;

  const { mcpServers, allowedTools } =
    params.tools ?? buildChatbotMcp(pipelineId, runIdRef);

  const userPrompt = composeChatPrompt(history, userText);

  const options: Options = {
    systemPrompt: CHATBOT_SYSTEM_PROMPT,
    model: DEFAULT_MODEL,
    includePartialMessages: true,
    // tool 왕복(다회전) — 넉넉히.
    maxTurns: 12,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    allowedTools,
    mcpServers,
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
        throw new Error(`챗봇 query 실패: ${subtype}`);
      }
    }

    if (message.type === "assistant" && message.error) {
      throw new Error(`챗봇 assistant 오류: ${message.error}`);
    }
  }

  const text = resultText ?? deltaText;
  return { text: text || "" };
}
