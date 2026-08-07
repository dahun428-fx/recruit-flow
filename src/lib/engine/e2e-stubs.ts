// e2e 결정론 스텁 — RECRUIT_FLOW_E2E_STUB=1일 때 instrumentation.ts가 설치.
// 기존 globalThis seam(sdk.ts getStub / chat.ts getStub)을 그대로 재사용하므로
// sdk.ts·chat.ts는 무수정. env 미설정 시 이 모듈은 import조차 되지 않음(프로덕션 무영향).
//
// Agent 스텁: 노드 role 안의 [E2E:*] 마커로 결정론 출력.
//  - [E2E:writer]      : 고정 markdown. 입력에 채점 JSON(verdict)이 있으면(=재작성 회차)
//                        "[개선판]" 마커를 붙인다.
//  - [E2E:scorer-*]    : 입력 초안에 "[개선판]" 있으면 PASS, 없으면 FAIL(무상태 fail→pass).
//                        [E2E:scorer-alwaysfail]은 항상 FAIL → gate_failed 시나리오.
//  - [E2E:slow]        : 3.5초 지연 + abort 청취(중단 테스트에서 running 관찰·취소).
//  - [E2E:gap]         : askHuman() 호출(갭 인터뷰).
//  - 그 외            : 고정 텍스트.
// 챗 스텁: userText 패턴 → 챗봇 tool 핸들러 직접 호출(실 tool 로직 경유) + onDelta 스트리밍.

import { buildChatbotMcp, CHATBOT_MCP_SERVER_NAME } from "./chat-tools";
import type { RunChatParams, RunChatResult } from "./chat";
import type { RunAgentParams, RunAgentResult } from "./sdk";

function scoreJson(pass: boolean): string {
  return JSON.stringify(
    {
      total: pass ? 90 : 40,
      verdict: pass ? "PASS" : "FAIL",
      passBar: 80,
      blockers: pass ? [] : ["증거·수치 부족"],
    },
    null,
    2,
  );
}

async function agentStub(params: RunAgentParams): Promise<RunAgentResult> {
  const sp = params.systemPrompt ?? "";
  const up = params.userPrompt ?? "";

  if (sp.includes("[E2E:slow]")) {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, 3500);
      params.abortController?.signal.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new Error("aborted"));
      });
    });
    return { text: "# E2E 이력서\n\n느린 노드 완료.\n" };
  }

  if (sp.includes("[E2E:gap]")) {
    const answer = params.askHuman
      ? await params.askHuman("이 지원자의 목표 직무는 무엇인가요?")
      : "(무응답)";
    return { text: `# E2E 이력서\n\n갭 인터뷰 답변 반영: ${answer}\n` };
  }

  if (sp.includes("[E2E:scorer")) {
    const alwaysFail = sp.includes("alwaysfail");
    const improved = up.includes("[개선판]");
    return { text: scoreJson(improved && !alwaysFail) };
  }

  if (sp.includes("[E2E:writer]")) {
    const isRewrite = up.includes('"verdict"');
    return {
      text: `# E2E 이력서 초안${isRewrite ? " [개선판]" : ""}\n\n## 경력\n- 결제 시스템 재설계, p99 1.2s→180ms\n- 팀 리드 5명\n`,
    };
  }

  return { text: "E2E-STUB-OUTPUT" };
}

type ToolResult = { content: { type: string; text: string }[] };

async function chatStub(params: RunChatParams): Promise<RunChatResult> {
  const { pipelineId, runIdRef, userText, onDelta } = params;
  const { mcpServers } = buildChatbotMcp(pipelineId, runIdRef);
  const server = (
    mcpServers as Record<
      string,
      { instance?: { _registeredTools?: Record<string, { handler: (a: Record<string, unknown>, e: unknown) => Promise<ToolResult> }> } }
    >
  )[CHATBOT_MCP_SERVER_NAME];
  const call = async (name: string, args: Record<string, unknown>): Promise<ToolResult> => {
    const handler = server?.instance?._registeredTools?.[name]?.handler;
    if (!handler) throw new Error(`e2e chat stub: tool 없음 ${name}`);
    return handler(args, {});
  };
  const done = (text: string): RunChatResult => {
    onDelta?.(text);
    return { text };
  };

  const t = userText;

  if (/블록.*(만들|추가|생성)|만들어|추가해/.test(t)) {
    await call("add_block", {
      type: "agent",
      name: "비평가",
      description: "초안을 비평하는 Agent",
      config: { role: "너는 이력서 비평가다.", outputFormat: "markdown" },
    });
    return done("비평가 Agent 블록을 만들어 새 블록 트레이에 담았습니다. 캔버스로 드래그하면 승인됩니다.");
  }

  if (/문서.*등록|등록.*문서|JD.*등록|등록해/.test(t)) {
    await call("register_document", {
      name: "챗봇 등록 JD",
      content: "# JD: 백엔드 시니어\n- 대규모 트랜잭션\n- 리더십 우대",
    });
    return done("문서를 라이브러리에 등록했습니다.");
  }

  if (/작성해줘|실행|돌려줘|만들어줘 이력서/.test(t)) {
    const r = await call("trigger_run", {});
    return done(`실행을 시작했습니다. ${r.content[0]?.text ?? ""}`);
  }

  if (/연결|배선|이어|잇|삭제|지워|엣지|edge/.test(t)) {
    return done(
      "죄송하지만 노드 연결(배선)이나 삭제는 제가 할 수 없어요. 조립은 캔버스에서 직접 해주세요.",
    );
  }

  // default: 델타 2회 분할(스트리밍 검증).
  onDelta?.("안녕하세요. ");
  onDelta?.("무엇을 도와드릴까요?");
  return { text: "안녕하세요. 무엇을 도와드릴까요?" };
}

export function installE2eStubs(): void {
  (globalThis as Record<string, unknown>).__recruitFlowAgentStub = agentStub;
  (globalThis as Record<string, unknown>).__recruitFlowChatStub = chatStub;
  // eslint-disable-next-line no-console
  console.log("[e2e] 결정론 스텁 설치됨 (RECRUIT_FLOW_E2E_STUB=1)");
}
