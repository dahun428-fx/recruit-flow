// M3 챗봇 엔진 스모크(E) — 러너·이벤트버스·챗봇 tool 직접 구동, dev 서버 없이.
// Node 22 + tsx. 격리 DB(RECRUIT_FLOW_DB_PATH)에서 마이그레이션 적용 후 실행.
//
// 검증(prompt 완료 기준):
//  1) pipeline 구독자가 emitChatDelta·emitChatMessage·card_run 미러를 수신
//  2) add_block이 tray=true block_def 생성 + card_block 발행
//  3) trigger_run이 runner.start 호출 · 검증 errors 반환
//  4) 결정 5 회귀: 챗봇 allowedTools에 add_edge/delete/update류가 없음
//  5) runChat 오케스트레이션(스텁으로 tool 호출) 확인
//
// 실행: RECRUIT_FLOW_DB_PATH=... .node22/node .../tsx scripts/smoke-chat.mts

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const DB_PATH = process.env.RECRUIT_FLOW_DB_PATH!;
if (!DB_PATH) throw new Error("RECRUIT_FLOW_DB_PATH 필요");

{
  const raw = new Database(DB_PATH);
  // 모든 마이그레이션을 파일명 순서대로 적용(특정 파일 하드코딩 금지).
  const migDir = path.join(process.cwd(), "drizzle");
  for (const f of readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()) {
    const migration = readFileSync(path.join(migDir, f), "utf8");
    for (const stmt of migration.split("--> statement-breakpoint")) {
      const s = stmt.trim();
      if (s) raw.exec(s);
    }
  }
  raw.close();
}

const {
  createPipeline,
  saveGraph,
  listBlockDefs,
  listChatMessages,
  listDocuments,
  getGraph,
} = await import("../src/lib/db/queries");
const { eventBus } = await import("../src/lib/engine/events");
const { buildChatbotMcp, CHATBOT_TOOL_NAMES, CHATBOT_MCP_SERVER_NAME } =
  await import("../src/lib/engine/chat-tools");
const { runChat } = await import("../src/lib/engine/chat");
const { runner } = await import("../src/lib/engine/runner");

import type { SseEvent, NodeRow, EdgeRow, NodeConfig, Graph } from "../src/lib/types";
import type { RunChatParams } from "../src/lib/engine/chat";

// --- 어설션 -------------------------------------------------------------------
let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    failures.push(`${label}${detail ? " — " + detail : ""}`);
    console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`);
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- 그래프 빌더 헬퍼 ---------------------------------------------------------
let seq = 0;
function node(pipelineId: string, type: NodeRow["type"], name: string, config: NodeConfig): NodeRow {
  return { id: `n_${type}_${++seq}`, pipelineId, type, name, positionX: 0, positionY: 0, config };
}
function edge(pipelineId: string, s: NodeRow, t: NodeRow, opts?: Partial<Pick<EdgeRow, "kind" | "sourceHandle" | "inputOrder">>): EdgeRow {
  return { id: `e_${++seq}`, pipelineId, sourceNodeId: s.id, targetNodeId: t.id, kind: opts?.kind ?? "flow", sourceHandle: opts?.sourceHandle ?? null, inputOrder: opts?.inputOrder ?? 0 };
}

// ===========================================================================
// (1) pipeline 구독자가 delta/message/card_run 미러 수신
// ===========================================================================
async function testPipelineChannel() {
  console.log("\n[1] pipeline 채널: delta·message·card_run 미러 수신");
  const pl = createPipeline("smoke-chat-channel");

  const received: SseEvent[] = [];
  const unsub = eventBus.subscribePipeline(pl.id, "usr_dev_default", (ev) => received.push(ev));
  check("subscribePipeline 후 구독자 존재", eventBus.hasPipelineSubscribers(pl.id));

  // chat_delta
  eventBus.emitChatDelta(pl.id, { messageId: "m1", chunk: "안녕" });
  // chat_message
  const { appendChatMessage } = await import("../src/lib/db/queries");
  const msg = appendChatMessage(pl.id, "assistant", { text: "완료" });
  eventBus.emitChatMessage(pl.id, msg);
  // card_run 미러(run 스코프 발행이 pipeline 채널로도 미러돼야 함)
  eventBus.emitChatCard(pl.id, "card_run", { event: "started", title: "실행 시작" }, "run_x", null);

  const kinds = received.map((e) => e.type);
  check("chat_delta 수신", kinds.includes("chat_delta"), kinds.join(","));
  check("chat_message 수신", kinds.includes("chat_message"), kinds.join(","));
  check("card_run(chat_card) 미러 수신", kinds.includes("chat_card"), kinds.join(","));

  // card_human 미러도 확인.
  eventBus.emitChatCard(pl.id, "card_human", { event: "waiting", nodeName: "검토" }, "run_x", "nr_x");
  check("card_human 미러 수신", received.filter((e) => e.type === "chat_card").length === 2);

  unsub();
  check("unsub 후 구독자 없음", !eventBus.hasPipelineSubscribers(pl.id));
}

// ===========================================================================
// (2) add_block → tray=true block_def + card_block 발행
// ===========================================================================
async function testAddBlock() {
  console.log("\n[2] add_block: tray=true block_def + card_block");
  const pl = createPipeline("smoke-chat-addblock");
  const received: SseEvent[] = [];
  const unsub = eventBus.subscribePipeline(pl.id, "usr_dev_default", (ev) => received.push(ev));

  // MCP 서버에서 add_block tool 핸들러를 꺼내 직접 호출(스텁 없이 tool 로직 검증).
  const { mcpServers } = buildChatbotMcp(pl.id);
  const addBlock = findTool(mcpServers, "add_block");
  check("add_block tool 존재", !!addBlock);

  const res = await addBlock!.handler(
    { type: "agent", name: "이력서 작성자", description: "JD→초안", config: { role: "너는 이력서 작성자다", outputFormat: "markdown" } },
    {},
  );
  check("add_block 성공 응답", /트레이/.test(res.content[0].text));

  const defs = listBlockDefs();
  const created = defs.find((d) => d.name === "이력서 작성자");
  check("block_def 생성됨", !!created);
  check("origin=chatbot", created?.origin === "chatbot");
  check("tray=true(캔버스 미배치)", created?.tray === true, `tray=${created?.tray}`);
  check("enabled=true", created?.enabled === true);

  const cardBlockMsgs = listChatMessages(pl.id).filter((m) => m.kind === "card_block");
  check("card_block chat_message 저장", cardBlockMsgs.length === 1);
  const payload = cardBlockMsgs[0]?.payload as { blockDefId?: string; type?: string; name?: string; description?: string };
  check("card_block payload=결정 H(blockDefId·type·name·description)",
    payload?.blockDefId === created?.id && payload?.type === "agent" && payload?.name === "이력서 작성자" && typeof payload?.description === "string",
    JSON.stringify(payload));
  check("card_block emitChatMessage 발행(pipeline 채널)",
    received.some((e) => e.type === "chat_message" && (e as { message: { kind: string } }).message.kind === "card_block"));

  // 불충분 config는 tool 에러 반환(챗봇 되물음), 블록 생성 안 함.
  const before = listBlockDefs().length;
  const bad = await addBlock!.handler({ type: "agent", name: "불완전", config: { role: "" } }, {});
  check("불충분 config는 에러 반환", /필요합니다/.test(bad.content[0].text));
  check("불충분 config는 블록 생성 안 함", listBlockDefs().length === before);

  unsub();
}

// ===========================================================================
// (3) trigger_run: runner.start 호출 + 검증 errors 반환
// ===========================================================================
async function testTriggerRun() {
  console.log("\n[3] trigger_run: runner.start · 검증 errors 반환");

  // (3a) 검증 실패 그래프(고아 노드) → tool이 errors를 자연어로 반환, run 미시작.
  const plBad = createPipeline("smoke-chat-trigger-bad");
  const jd = node(plBad.id, "input", "JD", { inlineText: "JD" });
  const orphan = node(plBad.id, "agent", "고아", { role: "R", outputFormat: "markdown" });
  saveGraph(plBad.id, { nodes: [jd, orphan], edges: [] } as Graph);
  const { mcpServers: badMcp } = buildChatbotMcp(plBad.id);
  const triggerBad = findTool(badMcp, "trigger_run")!;
  const badRes = await triggerBad.handler({}, {});
  check("검증 실패 시 errors를 tool 결과로 반환", /실행할 수 없습니다|검증/.test(badRes.content[0].text), badRes.content[0].text.slice(0, 80));
  const badHadRun = await hasAnyRun(plBad.id);
  check("검증 실패 시 run 미시작", runner.latestFinishedRunId(plBad.id) === null && !badHadRun);

  // (3b) 유효 그래프 + 스텁 SDK → runner.start 성공, runIdRef 채워짐.
  const plOk = createPipeline("smoke-chat-trigger-ok");
  const jd2 = node(plOk.id, "input", "JD", { inlineText: "JD" });
  const writer = node(plOk.id, "agent", "writer", { role: "ROLE_cwriter", outputFormat: "markdown" });
  const out = node(plOk.id, "output", "OUT", { templateId: "default" });
  saveGraph(plOk.id, { nodes: [jd2, writer, out], edges: [edge(plOk.id, jd2, writer), edge(plOk.id, writer, out)] } as Graph);

  // Agent SDK 스텁(runner가 쓰는 __recruitFlowAgentStub).
  (globalThis as Record<string, unknown>).__recruitFlowAgentStub = async () => ({ text: "# 초안" });

  const runIdRef = { current: null as string | null };
  const { mcpServers: okMcp } = buildChatbotMcp(plOk.id, runIdRef);
  const triggerOk = findTool(okMcp, "trigger_run")!;
  const okRes = await triggerOk.handler({}, {});
  check("유효 그래프 실행 시작 응답", /실행을 시작/.test(okRes.content[0].text), okRes.content[0].text.slice(0, 80));
  check("runIdRef에 runId 기록(A/U가 card_run으로 읽음)", !!runIdRef.current, `ref=${runIdRef.current}`);
  // 러너가 card_run(started) 발행했는지.
  await sleep(50);
  const cards = listChatMessages(plOk.id).filter((m) => m.kind === "card_run");
  check("runner가 card_run(started) 발행", cards.some((c) => (c.payload as { event?: string }).event === "started"));
}

// ===========================================================================
// (2b) edit_document: 0/1/2+ 매치 분기 + register_document/edit document_changed SSE
// ===========================================================================
async function testEditDocument() {
  console.log("\n[2b] edit_document: 0/1/2+ 매치 + document_changed SSE");
  const pl = createPipeline("smoke-chat-editdoc");
  const received: SseEvent[] = [];
  const unsub = eventBus.subscribePipeline(pl.id, "usr_dev_default", (ev) => received.push(ev));

  const { mcpServers } = buildChatbotMcp(pl.id);
  const registerDoc = findTool(mcpServers, "register_document")!;
  const editDoc = findTool(mcpServers, "edit_document");
  check("edit_document tool 존재", !!editDoc);

  // register_document(생성) → created document_changed 발행.
  await registerDoc.handler(
    { name: "가이드", content: "제목\n\n원문 문단 하나. 그리고 유일 토큰 ALPHA.\n\n반복 X 반복 X" },
    {},
  );
  check("register_document created document_changed 발행",
    received.some((e) => e.type === "document_changed" && (e as { action: string }).action === "created"),
    received.map((e) => e.type).join(","));

  const docBefore = listDocuments().find((d) => d.name === "가이드")!;

  // (0곳) 없는 문자열 → 찾을 수 없음 에러.
  received.length = 0;
  const zero = await editDoc!.handler({ name: "가이드", old_string: "존재하지않는문자열", new_string: "X" }, {});
  check("0곳 매치 → 찾을 수 없음", /찾을 수 없습니다/.test(zero.content[0].text), zero.content[0].text.slice(0, 80));
  check("0곳 매치 → 버전 증가 없음", listDocuments().find((d) => d.name === "가이드")!.currentVersion === docBefore.currentVersion);
  check("0곳 매치 → document_changed 미발행", !received.some((e) => e.type === "document_changed"));

  // (2+곳) 여러 곳 일치 → 더 긴 문맥 요구 에러.
  received.length = 0;
  const many = await editDoc!.handler({ name: "가이드", old_string: "반복 X", new_string: "Y" }, {});
  check("2+곳 매치 → 여러 곳 일치 에러", /여러 곳|일치합니다/.test(many.content[0].text), many.content[0].text.slice(0, 80));
  check("2+곳 매치 → 버전 증가 없음", listDocuments().find((d) => d.name === "가이드")!.currentVersion === docBefore.currentVersion);

  // (정확히 1곳) 성공 → 치환 + 새 버전 + updated document_changed.
  received.length = 0;
  const one = await editDoc!.handler({ name: "가이드", old_string: "유일 토큰 ALPHA", new_string: "유일 토큰 BETA" }, {});
  check("1곳 매치 → 편집 성공 응답", /편집했습니다|치환/.test(one.content[0].text), one.content[0].text.slice(0, 80));
  const { getDocument } = await import("../src/lib/db/queries");
  const reloaded = getDocument(docBefore.id)!;
  check("1곳 매치 → 본문 치환됨", reloaded.content.includes("BETA") && !reloaded.content.includes("ALPHA"), reloaded.content);
  check("1곳 매치 → 버전 증가", reloaded.currentVersion === docBefore.currentVersion + 1, `v=${reloaded.currentVersion}`);
  check("1곳 매치 → updated document_changed 발행(version 포함)",
    received.some((e) => e.type === "document_changed" && (e as { action: string; version?: number }).action === "updated" && (e as { version?: number }).version === reloaded.currentVersion),
    received.map((e) => e.type).join(","));

  // 없는 문서 → 문서 없음 에러.
  const missing = await editDoc!.handler({ name: "없는문서", old_string: "a", new_string: "b" }, {});
  check("없는 문서 → 찾을 수 없음", /찾을 수 없습니다/.test(missing.content[0].text));

  unsub();
}

// ===========================================================================
// (4) 결정 5 회귀: 쓰기 tool이 add/register/edit/trigger 외로 안 늘었는지
// ===========================================================================
async function testDecision5() {
  console.log("\n[4] 결정 5 회귀: 배선/삭제/수정 tool 부재");
  const pl = createPipeline("smoke-chat-d5");
  const { allowedTools, mcpServers } = buildChatbotMcp(pl.id);

  // allowedTools 정확히 9종(읽기 5 + 쓰기 4).
  check("allowedTools 정확히 9종", allowedTools.length === 9, `count=${allowedTools.length}: ${allowedTools.join(",")}`);
  const expected = new Set(CHATBOT_TOOL_NAMES.map((n) => `mcp__${CHATBOT_MCP_SERVER_NAME}__${n}`));
  check("allowedTools = 카탈로그 9종과 정확히 일치", allowedTools.length === expected.size && allowedTools.every((t) => expected.has(t)));

  // 금지 tool 이름이 어디에도 없어야(allowedTools + 실제 MCP tool 목록).
  const forbidden = ["add_edge", "wire", "connect", "delete_node", "update_node", "move_node", "delete_edge", "delete", "update"];
  const toolNames = mcpTools(mcpServers).map((t) => t.name);
  for (const f of forbidden) {
    check(`금지 tool 부재: ${f}`,
      !toolNames.some((n) => n === f) && !allowedTools.some((t) => t.endsWith(`__${f}`)),
      `tools=${toolNames.join(",")}`);
  }
  // 쓰기 tool은 정확히 add_block/register_document/trigger_run 3종만.
  const writeTools = ["add_block", "register_document", "trigger_run"];
  const present = toolNames.filter((n) => writeTools.includes(n));
  check("쓰기 tool 정확히 3종(add/register/trigger)", present.length === 3 && writeTools.every((w) => present.includes(w)), present.join(","));
}

// ===========================================================================
// (5) runChat 오케스트레이션 — 스텁으로 tool 호출 경로 확인(비용 0)
// ===========================================================================
async function testRunChatOrchestration() {
  console.log("\n[5] runChat 오케스트레이션(스텁으로 add_block tool 호출)");
  const pl = createPipeline("smoke-chat-orchestrate");

  const received: SseEvent[] = [];
  const unsub = eventBus.subscribePipeline(pl.id, "usr_dev_default", (ev) => received.push(ev));

  // runChat 스텁: onDelta 흘리고, 주입된 tools에서 add_block을 실제 호출한 뒤 최종 텍스트.
  (globalThis as Record<string, unknown>).__recruitFlowChatStub = async (params: RunChatParams) => {
    params.onDelta?.("블록을 ");
    params.onDelta?.("만들게요.");
    const tools = params.tools ?? buildChatbotMcp(params.pipelineId, params.runIdRef);
    const addBlock = findTool(tools.mcpServers, "add_block")!;
    await addBlock.handler({ type: "rule", name: "정량화 규칙", config: { content: "모든 성과를 수치로." } }, {});
    return { text: "정량화 규칙 블록을 트레이에 추가했습니다." };
  };

  const runIdRef = { current: null as string | null };
  const messageId = "assistant-1";
  const res = await runChat({
    pipelineId: pl.id,
    runIdRef,
    history: [],
    userText: "정량화 규칙 블록 만들어줘",
    onDelta: (chunk) => eventBus.emitChatDelta(pl.id, { messageId, chunk }),
  });

  check("runChat 최종 텍스트 반환", /정량화 규칙/.test(res.text), res.text);
  const deltas = received.filter((e) => e.type === "chat_delta");
  check("onDelta → chat_delta 발행됨", deltas.length === 2, `count=${deltas.length}`);
  const created = listBlockDefs().find((d) => d.name === "정량화 규칙");
  check("스텁이 add_block tool 호출 → block_def 생성(tray)", !!created && created.tray === true);

  // history 합성 회귀: 2번째 호출에 이전 대화가 들어가는지(스텁 없이 composeChatPrompt 경로는
  // 실 query라 여기선 스텁으로 대체. history 인자를 그대로 받는지만 확인).
  (globalThis as Record<string, unknown>).__recruitFlowChatStub = async (params: RunChatParams) => {
    check("runChat이 history 인자 수신", params.history.length === 1 && params.userText === "실행해줘");
    return { text: "ok" };
  };
  await runChat({
    pipelineId: pl.id,
    history: [{ id: "h1", pipelineId: pl.id, kind: "user", payload: { text: "정량화 규칙 블록 만들어줘" }, createdAt: Date.now() }],
    userText: "실행해줘",
  });

  delete (globalThis as Record<string, unknown>).__recruitFlowChatStub;
  unsub();
}

// --- MCP 내부 tool 접근 헬퍼 --------------------------------------------------
// createSdkMcpServer 반환: { type, name, instance }. instance._registeredTools는
// { [toolName]: { handler, ... } } 객체. 스모크에서 handler(args, extra)를 직접 호출.
type ToolEntry = { name: string; handler: (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }> };
function mcpTools(mcpServers: Record<string, unknown>): ToolEntry[] {
  const server = mcpServers[CHATBOT_MCP_SERVER_NAME] as { instance?: { _registeredTools?: Record<string, { handler: ToolEntry["handler"] }> } };
  const registered = server?.instance?._registeredTools ?? {};
  return Object.entries(registered).map(([name, t]) => ({ name, handler: t.handler }));
}
function findTool(mcpServers: Record<string, unknown>, name: string): ToolEntry | undefined {
  return mcpTools(mcpServers).find((t) => t.name === name);
}

async function hasAnyRun(pipelineId: string): Promise<boolean> {
  const { getActiveRun, listRuns } = await import("../src/lib/db/queries");
  return !!getActiveRun(pipelineId) || listRuns(pipelineId).length > 0;
}

// ===========================================================================
async function main() {
  await testPipelineChannel();
  await testAddBlock();
  await testEditDocument();
  await testDecision5();
  await testTriggerRun();
  await testRunChatOrchestration();

  console.log(`\n===== 챗봇 스모크 결과: PASS ${pass} / FAIL ${fail} =====`);
  if (fail > 0) {
    console.log("실패 항목:");
    for (const f of failures) console.log("  - " + f);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("챗봇 스모크 크래시:", e);
  process.exit(2);
});
