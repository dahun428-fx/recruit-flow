// 엔진 스모크 스위트(M2a 검증) — 러너 직접 구동, dev 서버 없이.
// Node 22 + tsx. 격리 DB(RECRUIT_FLOW_DB_PATH)에서 마이그레이션 적용 후 실행.
// SDK는 __recruitFlowAgentStub로 스텁(고정 출력) — Gate/병렬/루프/Human/부분재실행 로직만 검증.
//
// 실행: RECRUIT_FLOW_DB_PATH=... node .node22 tsx scripts/smoke-engine.ts

import { readFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

// --- 격리 DB 준비(러너·queries import 전에 스키마를 만들어 둔다) ---------------
const DB_PATH = process.env.RECRUIT_FLOW_DB_PATH!;
if (!DB_PATH) throw new Error("RECRUIT_FLOW_DB_PATH 필요");

{
  const raw = new Database(DB_PATH);
  const migration = readFileSync(
    path.join(process.cwd(), "drizzle", "0000_mighty_invisible_woman.sql"),
    "utf8",
  );
  for (const stmt of migration.split("--> statement-breakpoint")) {
    const s = stmt.trim();
    if (s) raw.exec(s);
  }
  raw.close();
}

// 스키마 생성 후에야 client(싱글턴 커넥션) import.
const {
  createPipeline,
  saveGraph,
  createDocument,
  getRunState,
  getArtifactByNodeRun,
  listChatMessages,
} = await import("../src/lib/db/queries");
const { runner } = await import("../src/lib/engine/runner");
const { evaluateGate, buildGateContext } = await import("../src/lib/engine/gate");
const { db } = await import("../src/lib/db/client");
const { nodeRuns: nodeRunsTable, runs: runsTable, artifacts: artifactsTable } =
  await import("../src/lib/db/schema");
const { eq } = await import("drizzle-orm");

import type { RunAgentParams, RunAgentResult } from "../src/lib/engine/sdk";
import type { Graph, NodeRow, EdgeRow, NodeConfig } from "../src/lib/types";

// --- 스텁 레지스트리 ----------------------------------------------------------
// 노드 role 텍스트(systemPrompt 시작부)로 어떤 노드인지 식별해 고정 출력을 낸다.
type StubFn = (p: RunAgentParams) => Promise<RunAgentResult> | RunAgentResult;
let stubTable: { match: (p: RunAgentParams) => boolean; fn: StubFn }[] = [];
(globalThis as Record<string, unknown>).__recruitFlowAgentStub = async (
  p: RunAgentParams,
): Promise<RunAgentResult> => {
  for (const e of stubTable) if (e.match(p)) return await e.fn(p);
  return { text: "STUB-DEFAULT" };
};

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

/** run이 종결 상태(또는 waiting_human)에 도달할 때까지 폴링. */
async function waitFor(
  runId: string,
  predicate: (status: string) => boolean,
  timeoutMs = 15000,
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const st = getRunState(runId);
    if (st && predicate(st.run.status)) return st.run.status;
    await sleep(25);
  }
  const st = getRunState(runId);
  throw new Error(
    `waitFor 타임아웃: run ${runId} status=${st?.run.status ?? "?"}`,
  );
}

const TERMINAL = (s: string) =>
  ["succeeded", "failed", "gate_failed", "cancelled"].includes(s);

// --- 그래프 빌더 헬퍼 ---------------------------------------------------------
let seq = 0;
function node(pipelineId: string, type: NodeRow["type"], name: string, config: NodeConfig): NodeRow {
  return {
    id: `n_${type}_${++seq}`,
    pipelineId,
    type,
    name,
    positionX: 0,
    positionY: 0,
    config,
  };
}
function edge(
  pipelineId: string,
  source: NodeRow,
  target: NodeRow,
  opts?: Partial<Pick<EdgeRow, "kind" | "sourceHandle" | "inputOrder">>,
): EdgeRow {
  return {
    id: `e_${++seq}`,
    pipelineId,
    sourceNodeId: source.id,
    targetNodeId: target.id,
    kind: opts?.kind ?? "flow",
    sourceHandle: opts?.sourceHandle ?? null,
    inputOrder: opts?.inputOrder ?? 0,
  };
}

function nodeRunsOf(runId: string) {
  return db.select().from(nodeRunsTable).where(eq(nodeRunsTable.runId, runId)).all();
}
function artifactOf(nodeRunId: string) {
  return getArtifactByNodeRun(nodeRunId);
}

// ===========================================================================
// (f) Gate 조건식 파서 단위 검증 — eval 미사용
// ===========================================================================
async function testGateParser() {
  console.log("\n[f] Gate 조건식 파서 단위 검증");
  const two = buildGateContext([
    { nodeName: "a", artifact: { id: "x", nodeRunId: "x", format: "json", content: JSON.stringify({ total: 85, verdict: "PASS", issues: [] }) } },
    { nodeName: "b", artifact: { id: "y", nodeRunId: "y", format: "json", content: JSON.stringify({ total: 90, verdict: "PASS", issues: ["x"] }) } },
  ]);
  const single = buildGateContext([
    { nodeName: "only", artifact: { id: "z", nodeRunId: "z", format: "json", content: JSON.stringify({ score: 70, verdict: "FAIL", issues: ["a", "b"] }) } },
  ]);

  check("a.total >= 80 && b.total >= 80 → true", evaluateGate("a.total >= 80 && b.total >= 80", two) === true);
  check("a.total >= 80 && b.total >= 95 → false", evaluateGate("a.total >= 80 && b.total >= 95", two) === false);
  check('verdict == "PASS" (single, FAIL) → false', evaluateGate('verdict == "PASS"', single) === false);
  const singlePass = buildGateContext([
    { nodeName: "only", artifact: { id: "z2", nodeRunId: "z2", format: "json", content: JSON.stringify({ verdict: "PASS" }) } },
  ]);
  check('verdict == "PASS" (single, PASS) → true', evaluateGate('verdict == "PASS"', singlePass) === true);
  check("issues.length == 0 (single, 2 issues) → false", evaluateGate("issues.length == 0", single) === false);
  const noIssues = buildGateContext([
    { nodeName: "only", artifact: { id: "z3", nodeRunId: "z3", format: "json", content: JSON.stringify({ issues: [] }) } },
  ]);
  check("issues.length == 0 (empty) → true", evaluateGate("issues.length == 0", noIssues) === true);
  check("괄호+부정 !(a.total < 80) → true", evaluateGate("!(a.total < 80)", two) === true);
  check("|| 단락: a.total>=99 || b.total>=80 → true", evaluateGate("a.total >= 99 || b.total >= 80", two) === true);
  check("문자열 접근 verdict != \"FAIL\" (b) → true", evaluateGate('b.verdict != "FAIL"', two) === true);
  check("single score >= 80 → false (70)", evaluateGate("score >= 80", single) === false);

  // eval 미사용 증명: 소스에 eval/Function 생성자 없음 + 위험 표현이 파서 에러.
  const gateSrc = readFileSync(path.join(process.cwd(), "src", "lib", "engine", "gate.ts"), "utf8");
  const noEval = !/[^A-Za-z_.]eval\s*\(/.test(gateSrc) && !/new\s+Function/.test(gateSrc);
  check("gate.ts에 eval()/new Function 없음", noEval);
  let threw = false;
  try { evaluateGate("process.exit(1)", two); } catch { threw = true; }
  check("위험 표현(process.exit)은 파서 에러로 격리", threw);
}

// ===========================================================================
// (a) 분기 그래프 동시 실행(한도 2, 3번째 대기)
// ===========================================================================
async function testParallel() {
  console.log("\n[a] 병렬 실행(한도 2, 3번째 대기)");
  const pl = createPipeline("smoke-parallel");
  const inNode = node(pl.id, "input", "JD", { inlineText: "JD 본문" });
  // 3개의 병렬 agent(같은 상류) — 동시성 관찰용.
  let peak = 0;
  let active = 0;
  const mkAgent = (nm: string) =>
    node(pl.id, "agent", nm, { role: `ROLE_${nm}`, outputFormat: "markdown" });
  const a1 = mkAgent("A1");
  const a2 = mkAgent("A2");
  const a3 = mkAgent("A3");
  const out = node(pl.id, "output", "OUT", { templateId: "default" });
  // out은 마크다운 상류 정확히 1개여야 하므로 a1만 연결.
  const graph: Graph = {
    nodes: [inNode, a1, a2, a3, out],
    edges: [
      edge(pl.id, inNode, a1),
      edge(pl.id, inNode, a2),
      edge(pl.id, inNode, a3),
      edge(pl.id, a1, out),
    ],
  };
  saveGraph(pl.id, graph);

  stubTable = [
    {
      match: (p) => /^ROLE_A[123]/.test(p.systemPrompt),
      fn: async () => {
        active++;
        peak = Math.max(peak, active);
        await sleep(200);
        active--;
        return { text: "draft" };
      },
    },
  ];

  const res = runner.start(pl.id);
  if ("errors" in res) throw new Error("검증 실패: " + JSON.stringify(res.errors));
  const status = await waitFor(res.runId, TERMINAL);

  check("run 성공", status === "succeeded", `status=${status}`);
  check("동시 실행 최대 2 (한도 준수)", peak === 2, `peak=${peak}`);
  check("3번째는 대기했다가 실행(peak<3)", peak < 3, `peak=${peak}`);
  const nrs = nodeRunsOf(res.runId);
  const succeeded = nrs.filter((n) => n.status === "succeeded").length;
  check("모든 노드 succeeded(입력1+agent3+output1=5)", succeeded === 5, `succeeded=${succeeded}`);
}

// ===========================================================================
// (b) Gate score>=80: fail→재실행(회차2·직전 JSON 포함), pass→통과
// ===========================================================================
async function buildGatePipeline(name: string, maxLoops: number) {
  const pl = createPipeline(name);
  const jd = node(pl.id, "input", "JD", { inlineText: "JD 본문" });
  const writer = node(pl.id, "agent", "writer", { role: "ROLE_writer", outputFormat: "markdown" });
  const screen = node(pl.id, "agent", "screen", { role: "ROLE_screen", outputFormat: "json", jsonSchema: "{total:number}" });
  const gate = node(pl.id, "gate", "gate", { expr: "screen.total >= 80", maxLoops, failTargetNodeId: writer.id });
  const out = node(pl.id, "output", "OUT", { templateId: "default" });
  const graph: Graph = {
    nodes: [jd, writer, screen, gate, out],
    edges: [
      edge(pl.id, jd, writer),
      edge(pl.id, writer, screen),
      edge(pl.id, writer, gate, { inputOrder: 0 }),
      edge(pl.id, screen, gate, { inputOrder: 1 }),
      edge(pl.id, gate, out, { sourceHandle: "pass" }),
      edge(pl.id, gate, writer, { sourceHandle: "fail" }),
    ],
  };
  saveGraph(pl.id, graph);
  return { pl, jd, writer, screen, gate, out };
}

async function testGateFailThenPass() {
  console.log("\n[b] Gate fail→재실행(직전 JSON 포함)→pass");
  const { pl, writer, screen } = await buildGatePipeline("smoke-gate-pass", 3);

  let writerIter = 0;
  let writerSawPriorScore = false;
  stubTable = [
    {
      match: (p) => p.systemPrompt.startsWith("ROLE_writer"),
      fn: async (p) => {
        writerIter++;
        if (writerIter >= 2 && /직전 회차 채점|"total": 70|total.*70/.test(p.userPrompt)) {
          writerSawPriorScore = true;
        }
        return { text: `# 이력서 초안 회차${writerIter}` };
      },
    },
    {
      match: (p) => p.systemPrompt.startsWith("ROLE_screen"),
      // 1회차 70(fail), 2회차 85(pass).
      fn: async () => ({ text: JSON.stringify({ total: writerIter >= 2 ? 85 : 70 }) }),
    },
  ];

  const res = runner.start(pl.id);
  if ("errors" in res) throw new Error("검증 실패: " + JSON.stringify(res.errors));
  const status = await waitFor(res.runId, TERMINAL);

  check("run 성공(pass 후 Output까지)", status === "succeeded", `status=${status}`);
  const nrs = nodeRunsOf(res.runId);
  const writerRuns = nrs.filter((n) => n.nodeId === writer.id);
  check("writer 2회 실행(iteration 1,2)", writerRuns.length === 2 && writerRuns.some((r) => r.iteration === 2), `runs=${writerRuns.map((r) => r.iteration)}`);
  const gateRuns = nrs.filter((n) => n.nodeId === screen.id);
  check("screen도 재실행(회차2 존재)", gateRuns.some((r) => r.iteration === 2));
  check("재실행 writer 입력에 직전 채점 JSON(total 70) 포함", writerSawPriorScore);
  // 회차2 writer 아티팩트가 Gate 통과로 Output까지 흘렀는지(라우터 pass 통과).
  const outNrAll = nrs.filter((n) => n.nodeId.includes("output"));
  // [수정1 회귀] fail 회차마다 Output의 유령 iteration+1 node_run이 생기면 안 됨 —
  // Output은 최종 pass 회차에만 정확히 1회 실행되어야 한다.
  check("Output node_run 정확히 1개(fail 회차 유령 없음)", outNrAll.length === 1, `count=${outNrAll.length}, iters=${outNrAll.map((n) => n.iteration)}`);
  const outNr = outNrAll.find((n) => n.status === "succeeded");
  check("Output 노드 succeeded", !!outNr);
  check("Output은 최종 회차(iteration=1)에만 실행", !!outNr && outNr.iteration === 1, `iter=${outNr?.iteration}`);
  const outArt = outNr ? artifactOf(outNr.id) : null;
  check("Output이 회차2 초안을 Gate 통과로 수신", !!outArt && /회차2/.test(outArt.content), outArt?.content.slice(0, 60));

  // [수정1 회귀] 모든 node_run이 최종 상태로 마감(queued/running 잔존 없음).
  const dangling = nrs.filter((n) => n.status === "queued" || n.status === "running" || n.status === "waiting_human");
  check("잔존 node_run 없음(전부 succeeded/failed/skipped)", dangling.length === 0, `dangling=${dangling.map((n) => n.nodeId + "#" + n.iteration + ":" + n.status)}`);
}

// canonical: writer→[recruiter∥tech]→gate→output, fail→재작성→pass.
// [수정1] fail 회차에 pass-하류(Output)의 유령 queued node_run이 없어야 한다.
async function testGateParallelFailThenPass() {
  console.log("\n[b3] canonical 병렬 채점 Gate: writer→[recruiter∥tech]→gate→output (fail→pass)");
  const pl = createPipeline("smoke-gate-parallel");
  const jd = node(pl.id, "input", "JD", { inlineText: "JD 본문" });
  const writer = node(pl.id, "agent", "writer", { role: "ROLE_cwriter", outputFormat: "markdown" });
  // Gate 조건식은 상류 노드 "이름"으로 출처를 참조(buildGateContext) — 이름을 expr에 맞춘다.
  const recruiter = node(pl.id, "agent", "recruiter", { role: "ROLE_recruiter", outputFormat: "json", jsonSchema: "{total:number}" });
  const tech = node(pl.id, "agent", "tech", { role: "ROLE_tech", outputFormat: "json", jsonSchema: "{total:number}" });
  const gate = node(pl.id, "gate", "gate", { expr: "recruiter.total >= 80 && tech.total >= 80", maxLoops: 3, failTargetNodeId: writer.id });
  const out = node(pl.id, "output", "OUT", { templateId: "default" });
  saveGraph(pl.id, {
    nodes: [jd, writer, recruiter, tech, gate, out],
    edges: [
      edge(pl.id, jd, writer),
      edge(pl.id, writer, recruiter),
      edge(pl.id, writer, tech),
      edge(pl.id, writer, gate, { inputOrder: 0 }),
      edge(pl.id, recruiter, gate, { inputOrder: 1 }),
      edge(pl.id, tech, gate, { inputOrder: 2 }),
      edge(pl.id, gate, out, { sourceHandle: "pass" }),
      edge(pl.id, gate, writer, { sourceHandle: "fail" }),
    ],
  });

  let writerIter = 0;
  stubTable = [
    { match: (p) => p.systemPrompt.startsWith("ROLE_cwriter"), fn: async () => { writerIter++; return { text: `# 이력서 회차${writerIter}` }; } },
    // 1회차: recruiter 70(fail), 2회차: 85(pass). tech는 항상 90.
    { match: (p) => p.systemPrompt.startsWith("ROLE_recruiter"), fn: async () => ({ text: JSON.stringify({ total: writerIter >= 2 ? 85 : 70 }) }) },
    { match: (p) => p.systemPrompt.startsWith("ROLE_tech"), fn: async () => ({ text: JSON.stringify({ total: 90 }) }) },
  ];

  const res = runner.start(pl.id);
  if ("errors" in res) throw new Error(JSON.stringify(res.errors));
  const status = await waitFor(res.runId, TERMINAL);
  check("run 성공", status === "succeeded", `status=${status}`);

  const nrs = nodeRunsOf(res.runId);
  const pathNodes: { id: string; label: string }[] = [
    { id: writer.id, label: "writer" },
    { id: recruiter.id, label: "recruiter-screen" },
    { id: tech.id, label: "tech-screen" },
    { id: gate.id, label: "gate" },
  ];
  for (const pn of pathNodes) {
    const iters = nrs.filter((n) => n.nodeId === pn.id).map((n) => n.iteration).sort();
    check(`경로 노드 ${pn.label} 2회차(iter 1,2) 재실행`, iters.includes(1) && iters.includes(2), `iters=${iters}`);
  }
  // 핵심: Output(pass-하류)은 유령 iteration+1 없이 정확히 1회.
  const outNrs = nrs.filter((n) => n.nodeId === out.id);
  check("Output node_run 정확히 1개(fail 회차 유령 없음)", outNrs.length === 1, `count=${outNrs.length}, iters=${outNrs.map((n) => n.iteration)}`);
  check("Output succeeded(iteration=1, 최종 pass 회차)", outNrs[0]?.status === "succeeded" && outNrs[0]?.iteration === 1, `${outNrs[0]?.status}#${outNrs[0]?.iteration}`);
  const outArt = outNrs[0] ? artifactOf(outNrs[0].id) : null;
  check("Output이 회차2 초안 수신(Gate pass 통과)", !!outArt && /회차2/.test(outArt.content), outArt?.content.slice(0, 40));
  // 모든 node_run 최종 상태로 마감.
  const dangling = nrs.filter((n) => ["queued", "running", "waiting_human"].includes(n.status));
  check("잔존 node_run 없음", dangling.length === 0, `dangling=${dangling.map((n) => n.nodeId + "#" + n.iteration + ":" + n.status)}`);
}

async function testGatePassImmediate() {
  console.log("\n[b2] Gate 즉시 pass(85): 입력 전체 통과");
  const { pl, writer } = await buildGatePipeline("smoke-gate-immediate", 3);
  stubTable = [
    { match: (p) => p.systemPrompt.startsWith("ROLE_writer"), fn: async () => ({ text: "# 초안" }) },
    { match: (p) => p.systemPrompt.startsWith("ROLE_screen"), fn: async () => ({ text: JSON.stringify({ total: 85 }) }) },
  ];
  const res = runner.start(pl.id);
  if ("errors" in res) throw new Error(JSON.stringify(res.errors));
  const status = await waitFor(res.runId, TERMINAL);
  check("run 성공", status === "succeeded", `status=${status}`);
  const nrs = nodeRunsOf(res.runId);
  const writerRuns = nrs.filter((n) => n.nodeId === writer.id);
  check("writer 1회만 실행(재루프 없음)", writerRuns.length === 1, `runs=${writerRuns.length}`);
}

// ===========================================================================
// (c) maxLoops 초과 → gate_failed + card_run 카드
// ===========================================================================
async function testGateMaxLoops() {
  console.log("\n[c] maxLoops(2) 초과 → gate_failed + 카드");
  const { pl, out } = await buildGatePipeline("smoke-gate-maxloops", 2);
  stubTable = [
    { match: (p) => p.systemPrompt.startsWith("ROLE_writer"), fn: async () => ({ text: "# 초안(항상 낮음)" }) },
    { match: (p) => p.systemPrompt.startsWith("ROLE_screen"), fn: async () => ({ text: JSON.stringify({ total: 50 }) }) },
  ];
  const res = runner.start(pl.id);
  if ("errors" in res) throw new Error(JSON.stringify(res.errors));
  const status = await waitFor(res.runId, TERMINAL);
  check("run gate_failed", status === "gate_failed", `status=${status}`);
  const cards = listChatMessages(pl.id).filter((m) => m.kind === "card_run");
  const gateFailedCard = cards.find((c) => (c.payload as { event?: string }).event === "gate_failed");
  check("card_run(gate_failed) 카드 기록", !!gateFailedCard);
  check("카드에 최종 점수 텍스트 포함", !!gateFailedCard && /50/.test(JSON.stringify(gateFailedCard.payload)));

  // [수정: 스케줄러 라우팅 게이팅] gate_failed로 종료 시 Gate는 pass 결정을 낸
  // 적이 없으므로 pass-하류 Output은 실행되면 안 된다(불필요 HTML 방지).
  const nrs = nodeRunsOf(res.runId);
  const outNrs = nrs.filter((n) => n.nodeId === out.id);
  check(
    "gate_failed 시 Output 미실행(생성 안 됨 또는 skipped, succeeded 아님)",
    outNrs.every((n) => n.status === "skipped") && !outNrs.some((n) => n.status === "succeeded"),
    `outNrs=${outNrs.map((n) => n.iteration + ":" + n.status)}`,
  );
  check(
    "gate_failed 시 Output HTML 아티팩트 없음",
    outNrs.every((n) => !artifactOf(n.id)),
    `arts=${outNrs.map((n) => (artifactOf(n.id) ? "has" : "none"))}`,
  );
  // 유령 queued/running 잔존 없음(mount 노드 포함 — tool/skill/rule은 node_run 자체가 없어야).
  const dangling = nrs.filter((n) => ["queued", "running", "waiting_human"].includes(n.status));
  check("gate_failed 후 잔존 node_run 없음", dangling.length === 0, `dangling=${dangling.map((n) => n.nodeId + "#" + n.iteration + ":" + n.status)}`);
}

// canonical 재현: writer→[recruiter∥tech]→Gate(불가 expr, maxLoops=1),
// pass→Output, fail→writer. live가 잡은 버그 — gate_failed인데 Output이 succeeded.
async function testGateParallelFailedNoOutput() {
  console.log("\n[c2] canonical 불가 expr + maxLoops=1 → gate_failed, Output 미실행");
  const pl = createPipeline("smoke-gate-parallel-failed");
  const jd = node(pl.id, "input", "JD", { inlineText: "JD 본문" });
  const writer = node(pl.id, "agent", "writer", { role: "ROLE_fwriter", outputFormat: "markdown" });
  const recruiter = node(pl.id, "agent", "recruiter", { role: "ROLE_frecruiter", outputFormat: "json", jsonSchema: "{total:number}" });
  const tech = node(pl.id, "agent", "tech", { role: "ROLE_ftech", outputFormat: "json", jsonSchema: "{total:number}" });
  // 불가 조건: 항상 fail.
  const gate = node(pl.id, "gate", "gate", { expr: "recruiter.total >= 999", maxLoops: 1, failTargetNodeId: writer.id });
  const out = node(pl.id, "output", "OUT", { templateId: "default" });
  saveGraph(pl.id, {
    nodes: [jd, writer, recruiter, tech, gate, out],
    edges: [
      edge(pl.id, jd, writer),
      edge(pl.id, writer, recruiter),
      edge(pl.id, writer, tech),
      edge(pl.id, writer, gate, { inputOrder: 0 }),
      edge(pl.id, recruiter, gate, { inputOrder: 1 }),
      edge(pl.id, tech, gate, { inputOrder: 2 }),
      edge(pl.id, gate, out, { sourceHandle: "pass" }),
      edge(pl.id, gate, writer, { sourceHandle: "fail" }),
    ],
  });
  stubTable = [
    { match: (p) => p.systemPrompt.startsWith("ROLE_fwriter"), fn: async () => ({ text: "# 이력서 초안" }) },
    { match: (p) => p.systemPrompt.startsWith("ROLE_frecruiter"), fn: async () => ({ text: JSON.stringify({ total: 70 }) }) },
    { match: (p) => p.systemPrompt.startsWith("ROLE_ftech"), fn: async () => ({ text: JSON.stringify({ total: 90 }) }) },
  ];

  const res = runner.start(pl.id);
  if ("errors" in res) throw new Error(JSON.stringify(res.errors));
  const status = await waitFor(res.runId, TERMINAL);
  check("run gate_failed", status === "gate_failed", `status=${status}`);

  const nrs = nodeRunsOf(res.runId);
  const outNrs = nrs.filter((n) => n.nodeId === out.id);
  // 핵심 회귀: Output은 succeeded가 아니어야(생성 안 됐거나 skipped).
  check(
    "Output succeeded 아님(생성 안 됨 또는 skipped)",
    !outNrs.some((n) => n.status === "succeeded"),
    `outNrs=${outNrs.map((n) => n.iteration + ":" + n.status)}`,
  );
  check(
    "Output HTML 아티팩트 없음(불필요 산출 없음)",
    outNrs.every((n) => !artifactOf(n.id)),
  );
  // writer는 maxLoops=1이라 재작성 없이 1회만(즉시 gate_failed).
  const writerNrs = nrs.filter((n) => n.nodeId === writer.id);
  check("writer 1회만(maxLoops=1, 재큐잉 없음)", writerNrs.length === 1, `count=${writerNrs.length}`);
  const dangling = nrs.filter((n) => ["queued", "running", "waiting_human"].includes(n.status));
  check("잔존 node_run 없음(유령 queued 없음)", dangling.length === 0, `dangling=${dangling.map((n) => n.nodeId + "#" + n.iteration + ":" + n.status)}`);
}

// ===========================================================================
// (d) Human 노드: waiting_human·card_human → approve(편집본) → succeeded·editedBy
// ===========================================================================
async function testHuman() {
  console.log("\n[d] Human: waiting_human → approve(편집) → 하류 진행");
  const pl = createPipeline("smoke-human");
  const jd = node(pl.id, "input", "JD", { inlineText: "JD" });
  const writer = node(pl.id, "agent", "writer", { role: "ROLE_hwriter", outputFormat: "markdown" });
  const human = node(pl.id, "human", "검토", { instruction: "검토하세요", allowEdit: true });
  const out = node(pl.id, "output", "OUT", { templateId: "default" });
  saveGraph(pl.id, {
    nodes: [jd, writer, human, out],
    edges: [edge(pl.id, jd, writer), edge(pl.id, writer, human), edge(pl.id, human, out)],
  });
  stubTable = [{ match: (p) => p.systemPrompt.startsWith("ROLE_hwriter"), fn: async () => ({ text: "# 원본 초안" }) }];

  const res = runner.start(pl.id);
  if ("errors" in res) throw new Error(JSON.stringify(res.errors));
  await waitFor(res.runId, (s) => s === "waiting_human");
  check("run waiting_human 도달", true);

  const cards = listChatMessages(pl.id).filter((m) => m.kind === "card_human");
  check("card_human(waiting) 카드", cards.some((c) => (c.payload as { event?: string }).event === "waiting"));

  // waiting_human node_run 식별.
  const nrsBefore = nodeRunsOf(res.runId);
  const humanNr = nrsBefore.find((n) => n.nodeId === human.id && n.status === "waiting_human");
  check("Human node_run waiting_human", !!humanNr);

  const approveRes = runner.approve(humanNr!.id, "# 편집된 승인본");
  check("approve ok", approveRes.ok, JSON.stringify(approveRes));

  const status = await waitFor(res.runId, TERMINAL);
  check("approve 후 run 성공", status === "succeeded", `status=${status}`);

  const art = artifactOf(humanNr!.id);
  check("승인본 = 편집 내용", !!art && art.content === "# 편집된 승인본", art?.content);
  check("meta.editedBy=human", !!art && art.meta?.editedBy === "human", JSON.stringify(art?.meta));

  // 하류(Output) 진행 확인 + Output은 편집본을 받았는지.
  const nrs = nodeRunsOf(res.runId);
  const outNr = nrs.find((n) => n.nodeId === out.id && n.status === "succeeded");
  check("하류 Output succeeded", !!outNr);
  const outArt = outNr ? artifactOf(outNr.id) : null;
  check("Output이 편집본 내용 반영", !!outArt && /편집된 승인본/.test(outArt.content));
}

// ===========================================================================
// (e) 부분 재실행: from_node부터, 상류 아티팩트 직전 완료 run에서 복사
// ===========================================================================
async function testPartialRerun() {
  console.log("\n[e] 부분 재실행(상류 복사·from_node부터)");
  const pl = createPipeline("smoke-partial");
  const jd = node(pl.id, "input", "JD", { inlineText: "JD" });
  const writer = node(pl.id, "agent", "writer", { role: "ROLE_pwriter", outputFormat: "markdown" });
  const out = node(pl.id, "output", "OUT", { templateId: "default" });
  saveGraph(pl.id, {
    nodes: [jd, writer, out],
    edges: [edge(pl.id, jd, writer), edge(pl.id, writer, out)],
  });

  let writerCalls = 0;
  stubTable = [
    { match: (p) => p.systemPrompt.startsWith("ROLE_pwriter"), fn: async () => { writerCalls++; return { text: `# 초안 v${writerCalls}` }; } },
  ];

  // 1차 전체 실행.
  const r1 = runner.start(pl.id);
  if ("errors" in r1) throw new Error(JSON.stringify(r1.errors));
  await waitFor(r1.runId, TERMINAL);
  check("1차 run 성공", getRunState(r1.runId)!.run.status === "succeeded");
  const writerCallsAfter1 = writerCalls;

  // 부분 재실행: writer부터. 상류(jd)는 복사되어 재실행 안 됨.
  const prev = runner.latestFinishedRunId(pl.id);
  check("직전 완료 run 조회됨", prev === r1.runId, `prev=${prev}`);
  const r2 = runner.startFrom(pl.id, writer.id, prev!);
  if ("errors" in r2) throw new Error(JSON.stringify(r2.errors));
  await waitFor(r2.runId, TERMINAL);
  check("부분 재실행 성공", getRunState(r2.runId)!.run.status === "succeeded");

  const r2nrs = nodeRunsOf(r2.runId);
  const jdNr = r2nrs.find((n) => n.nodeId === jd.id);
  check("상류 input(jd) node_run 복사됨(succeeded)", !!jdNr && jdNr.status === "succeeded");
  const jdArt = jdNr ? artifactOf(jdNr.id) : null;
  check("상류 아티팩트 복사됨(직전 run 내용)", !!jdArt && jdArt.content === "JD");

  // writer는 재실행(호출 1회 추가), jd input 노드는 재실행 안 함.
  check("writer 재실행됨(스텁 추가 호출)", writerCalls === writerCallsAfter1 + 1, `calls=${writerCalls}`);
  const upstreamRunIdRow = db.select().from(runsTable).where(eq(runsTable.id, r2.runId)).get();
  check("run.upstreamRunId 기록", upstreamRunIdRow?.upstreamRunId === r1.runId);
}

// ===========================================================================
// 3노드 직렬 성공(기본 무결성)
// ===========================================================================
async function testSerial() {
  console.log("\n[base] 3노드 직렬 성공(input→agent→output)");
  const pl = createPipeline("smoke-serial");
  const jd = node(pl.id, "input", "JD", { inlineText: "# JD 본문\n요구사항" });
  const writer = node(pl.id, "agent", "writer", { role: "ROLE_swriter", outputFormat: "markdown" });
  const out = node(pl.id, "output", "OUT", { templateId: "default" });
  saveGraph(pl.id, {
    nodes: [jd, writer, out],
    edges: [edge(pl.id, jd, writer), edge(pl.id, writer, out)],
  });
  stubTable = [{ match: (p) => p.systemPrompt.startsWith("ROLE_swriter"), fn: async () => ({ text: "# 홍길동 이력서\n## 경력" }) }];
  const res = runner.start(pl.id);
  if ("errors" in res) throw new Error(JSON.stringify(res.errors));
  const status = await waitFor(res.runId, TERMINAL);
  check("run 성공", status === "succeeded", `status=${status}`);
  const nrs = nodeRunsOf(res.runId);
  check("3 node_run 모두 succeeded", nrs.filter((n) => n.status === "succeeded").length === 3);
  const outNr = nrs.find((n) => n.nodeId === out.id);
  const html = outNr ? artifactOf(outNr.id) : null;
  check("Output HTML 생성", !!html && html.format === "html" && /<html/i.test(html.content));
}

// ===========================================================================
// 중단(cancel)
// ===========================================================================
async function testCancel() {
  console.log("\n[cancel] 실행 중 cancel → cancelled");
  const pl = createPipeline("smoke-cancel");
  const jd = node(pl.id, "input", "JD", { inlineText: "JD" });
  const writer = node(pl.id, "agent", "slow", { role: "ROLE_slow", outputFormat: "markdown" });
  const out = node(pl.id, "output", "OUT", { templateId: "default" });
  saveGraph(pl.id, {
    nodes: [jd, writer, out],
    edges: [edge(pl.id, jd, writer), edge(pl.id, writer, out)],
  });
  stubTable = [{ match: (p) => p.systemPrompt.startsWith("ROLE_slow"), fn: async () => { await sleep(2000); return { text: "late" }; } }];
  const res = runner.start(pl.id);
  if ("errors" in res) throw new Error(JSON.stringify(res.errors));
  await sleep(300); // writer 진입 대기
  const c = runner.cancel(res.runId);
  check("cancel ok", c.ok);
  const status = await waitFor(res.runId, TERMINAL);
  check("run cancelled", status === "cancelled", `status=${status}`);
  const nrs = nodeRunsOf(res.runId);
  check("Output 노드 skipped(미도달)", nrs.some((n) => n.nodeId === out.id && n.status === "skipped") || !nrs.some((n) => n.nodeId === out.id && n.status === "succeeded"));
}

// ===========================================================================
// 재시작 복구: running→failed 마감, waiting_human은 복원 유지
// ===========================================================================
async function testRecovery() {
  console.log("\n[recover] recoverOnBoot: running→failed, waiting_human 유지");
  // running run을 손으로 만들고(제어 없음) recoverOnBoot 호출.
  const pl = createPipeline("smoke-recover");
  const jd = node(pl.id, "input", "JD", { inlineText: "JD" });
  saveGraph(pl.id, { nodes: [jd], edges: [] });
  const { createRun, createNodeRun, getGraph } = await import("../src/lib/db/queries");
  const g = getGraph(pl.id);
  const runningRun = createRun(pl.id, g, null); // status=running
  createNodeRun(runningRun.id, jd.id, "running", 1);

  // waiting_human run(제어 없음) — 복원 유지 대상.
  const whRun = createRun(pl.id, g, null);
  db.update(runsTable).set({ status: "waiting_human" }).where(eq(runsTable.id, whRun.id)).run();
  const whNr = createNodeRun(whRun.id, jd.id, "waiting_human", 1);

  runner.recoverOnBoot();

  const rr = getRunState(runningRun.id)!;
  check("running run → failed", rr.run.status === "failed", `status=${rr.run.status}`);
  check("running run의 node_run → failed", rr.nodeRuns.every((n) => n.status !== "running"));
  const wr = getRunState(whRun.id)!;
  check("waiting_human run 복원 유지", wr.run.status === "waiting_human", `status=${wr.run.status}`);
  check("waiting_human node_run 유지", wr.nodeRuns.find((n) => n.id === whNr.id)?.status === "waiting_human");
}

// ===========================================================================
// main
// ===========================================================================
async function main() {
  await testGateParser();
  await testSerial();
  await testParallel();
  await testGateFailThenPass();
  await testGateParallelFailThenPass();
  await testGatePassImmediate();
  await testGateMaxLoops();
  await testGateParallelFailedNoOutput();
  await testHuman();
  await testPartialRerun();
  await testCancel();
  await testRecovery();

  console.log(`\n===== 스모크 결과: PASS ${pass} / FAIL ${fail} =====`);
  if (fail > 0) {
    console.log("실패 항목:");
    for (const f of failures) console.log("  - " + f);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("스모크 크래시:", e);
  process.exit(2);
});
