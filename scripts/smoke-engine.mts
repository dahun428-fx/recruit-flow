// 엔진 스모크 스위트(M2a 검증) — 러너 직접 구동, dev 서버 없이.
// Node 22 + tsx. 격리 DB(RECRUIT_FLOW_DB_PATH)에서 마이그레이션 적용 후 실행.
// SDK는 __recruitFlowAgentStub로 스텁(고정 출력) — Gate/병렬/루프/Human/부분재실행 로직만 검증.
//
// 실행: RECRUIT_FLOW_DB_PATH=... node .node22 tsx scripts/smoke-engine.ts

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

// --- 격리 DB 준비(러너·queries import 전에 스키마를 만들어 둔다) ---------------
const DB_PATH = process.env.RECRUIT_FLOW_DB_PATH!;
if (!DB_PATH) throw new Error("RECRUIT_FLOW_DB_PATH 필요");

{
  const raw = new Database(DB_PATH);
  // 모든 마이그레이션을 파일명 순서대로 적용(특정 파일 하드코딩 금지 —
  // 새 마이그레이션이 추가되면 스모크가 조용히 낡은 스키마로 돈다).
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

// 스키마 생성 후에야 client(싱글턴 커넥션) import.
const {
  createPipeline,
  saveGraph,
  createDocument,
  getRunState,
  getRunSnapshot,
  getArtifactByNodeRun,
  listChatMessages,
  createBlockDef,
  resolveNodeConfig,
} = await import("../src/lib/db/queries");
const { runner } = await import("../src/lib/engine/runner");
const { deriveMounts } = await import("../src/lib/engine/mount");
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
function node(
  pipelineId: string,
  type: NodeRow["type"],
  name: string,
  config: NodeConfig,
  blockDefId: string | null = null,
): NodeRow {
  return {
    id: `n_${type}_${++seq}`,
    pipelineId,
    type,
    name,
    positionX: 0,
    positionY: 0,
    blockDefId,
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
    outNrs.length === 0 || outNrs.every((n) => n.status === "skipped"),
    `outNrs=${outNrs.map((n) => n.iteration + ":" + n.status)}`,
  );
  check(
    "gate_failed 시 Output HTML 아티팩트 없음",
    outNrs.length === 0 || outNrs.every((n) => !artifactOf(n.id)),
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
    outNrs.length === 0 || outNrs.every((n) => n.status === "skipped"),
    `outNrs=${outNrs.map((n) => n.iteration + ":" + n.status)}`,
  );
  check(
    "Output HTML 아티팩트 없음(불필요 산출 없음)",
    outNrs.length === 0 || outNrs.every((n) => !artifactOf(n.id)),
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
  const outNrs = nrs.filter((n) => n.nodeId === out.id);
  check(
    "Output 노드 미도달(생성 안 됨 또는 skipped)",
    outNrs.length === 0 || outNrs.every((n) => n.status === "skipped"),
    `outNrs=${outNrs.map((n) => n.iteration + ":" + n.status)}`,
  );
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
  check(
    "running run의 node_run → failed",
    rr.nodeRuns.length > 0 && rr.nodeRuns.every((n) => n.status !== "running"),
    `nodeRuns=${rr.nodeRuns.length}`,
  );
  const wr = getRunState(whRun.id)!;
  check("waiting_human run 복원 유지", wr.run.status === "waiting_human", `status=${wr.run.status}`);
  check("waiting_human node_run 유지", wr.nodeRuns.find((n) => n.id === whNr.id)?.status === "waiting_human");
}

// ===========================================================================
// [c3] gate_decision 영속화 + Gate(maxLoops 소진) + Human 재하이드레이션
//
// 과거 결함: gateDecision이 인메모리라 재하이드레이션 시
// "succeeded Gate의 최대 회차 = pass" 휴리스틱으로 재구성했다. 그런데
// maxLoops 소진 시 Gate는 succeeded + 결정 fail로 마감하고 다음 회차를
// 만들지 않으므로, **최대 회차가 fail인데 pass로 뒤집혀** 재개 후
// pass-하류(Output)가 실행됐다. 이제 DB(node_runs.gate_decision)를 읽는다.
// ===========================================================================
async function testGateDecisionPersisted() {
  console.log("\n[c3] gate_decision 영속화 + Gate maxLoops + Human 재하이드레이션");

  // --- (1) 영속화: 실제 run으로 기록되는 값 확인 ---------------------------
  const { pl: pl1, gate: gate1 } = await buildGatePipeline("smoke-gate-decision", 2);
  stubTable = [
    { match: (p) => p.systemPrompt.startsWith("ROLE_writer"), fn: async () => ({ text: "# 초안(항상 낮음)" }) },
    { match: (p) => p.systemPrompt.startsWith("ROLE_screen"), fn: async () => ({ text: JSON.stringify({ total: 50 }) }) },
  ];
  const res1 = runner.start(pl1.id);
  if ("errors" in res1) throw new Error(JSON.stringify(res1.errors));
  await waitFor(res1.runId, TERMINAL);

  const gateRows = nodeRunsOf(res1.runId)
    .filter((n) => n.nodeId === gate1.id)
    .sort((a, b) => a.iteration - b.iteration);
  check("Gate node_run이 회차별로 기록됨", gateRows.length >= 2, `rows=${gateRows.length}`);
  check(
    "모든 Gate 회차의 gate_decision = fail(항상 낮은 점수)",
    gateRows.every((r) => r.gateDecision === "fail"),
    `decisions=${gateRows.map((r) => r.iteration + ":" + r.gateDecision)}`,
  );
  // 이게 핵심 — 옛 휴리스틱이라면 최대 회차를 pass로 뒤집었다.
  check(
    "maxLoops 소진 시 최대 회차도 fail(휴리스틱이면 pass로 뒤집힘)",
    gateRows[gateRows.length - 1].gateDecision === "fail",
    `maxIter=${gateRows[gateRows.length - 1].iteration}:${gateRows[gateRows.length - 1].gateDecision}`,
  );
  const nonGateRows = nodeRunsOf(res1.runId).filter((n) => n.nodeId !== gate1.id);
  check(
    "Gate 외 노드의 gate_decision은 null",
    nonGateRows.length > 0 && nonGateRows.every((n) => n.gateDecision === null),
    `rows=${nonGateRows.length}`,
  );
  // pass가 나는 경우도 기록되는지(대조군).
  const { pl: pl2, gate: gate2 } = await buildGatePipeline("smoke-gate-decision-pass", 3);
  stubTable = [
    { match: (p) => p.systemPrompt.startsWith("ROLE_writer"), fn: async () => ({ text: "# 초안" }) },
    { match: (p) => p.systemPrompt.startsWith("ROLE_screen"), fn: async () => ({ text: JSON.stringify({ total: 95 }) }) },
  ];
  const res2 = runner.start(pl2.id);
  if ("errors" in res2) throw new Error(JSON.stringify(res2.errors));
  await waitFor(res2.runId, TERMINAL);
  const passGateRows = nodeRunsOf(res2.runId).filter((n) => n.nodeId === gate2.id);
  check(
    "pass Gate의 gate_decision = pass",
    passGateRows.length > 0 && passGateRows.every((r) => r.gateDecision === "pass"),
    `rows=${passGateRows.length}`,
  );

  // --- (2) 재하이드레이션: Gate(fail) + Human 대기 조합 -------------------
  // testRecovery와 같은 방식으로 DB 상태를 직접 구성해 승인 경로만 격리 검증.
  //
  // 이 시나리오는 두 결함을 동시에 잡는다(둘 다 있어야 통과):
  //  (a) gate_decision을 DB에서 읽지 않고 "최대 회차=pass" 휴리스틱을 쓰면
  //      Gate 최종 결정이 fail인데 pass-하류 Output이 succeeded로 실행된다.
  //  (b) rehydrateForApproval의 runHuman은 drive()의 inFlight에 없어서
  //      완료 시 wake가 없다 → 승인해도 드라이버가 깨지 않아 run이 running에
  //      영원히 머문다(아래 "재개되어 종결" 검사가 이를 잡는다).
  const pl = createPipeline("smoke-gate-human-rehydrate");
  const jd = node(pl.id, "input", "JD", { inlineText: "JD 본문" });
  const writer = node(pl.id, "agent", "writer", { role: "ROLE_writer", outputFormat: "markdown" });
  const screen = node(pl.id, "agent", "screen", { role: "ROLE_screen", outputFormat: "json", jsonSchema: "{total:number}" });
  const gate = node(pl.id, "gate", "gate", { expr: "screen.total >= 80", maxLoops: 2, failTargetNodeId: writer.id });
  const out = node(pl.id, "output", "OUT", { templateId: "default" });
  const human = node(pl.id, "human", "검토", { instruction: "검토해 주세요" });
  saveGraph(pl.id, {
    nodes: [jd, writer, screen, gate, out, human],
    edges: [
      edge(pl.id, jd, writer),
      edge(pl.id, writer, screen),
      edge(pl.id, writer, gate, { inputOrder: 0 }),
      edge(pl.id, screen, gate, { inputOrder: 1 }),
      edge(pl.id, gate, out, { sourceHandle: "pass" }),
      edge(pl.id, gate, writer, { sourceHandle: "fail" }),
      // Human은 별도 분기 — Gate가 소진돼도 이 분기가 run을 붙잡는다.
      edge(pl.id, jd, human),
    ],
  });

  const {
    createRun,
    createNodeRun,
    getGraph,
    setNodeRunGateDecision,
    createArtifact,
    finalizeArtifact,
  } = await import("../src/lib/db/queries");
  const g = getGraph(pl.id);
  const run = createRun(pl.id, g, null);
  db.update(runsTable).set({ status: "waiting_human" }).where(eq(runsTable.id, run.id)).run();

  createNodeRun(run.id, jd.id, "succeeded", 1);
  const wnr = createNodeRun(run.id, writer.id, "succeeded", 1);
  const snr = createNodeRun(run.id, screen.id, "succeeded", 1);
  // Gate 2회차 모두 fail — 2회차가 최대 회차이자 maxLoops 소진 지점.
  const gnr1 = createNodeRun(run.id, gate.id, "succeeded", 1);
  const gnr2 = createNodeRun(run.id, gate.id, "succeeded", 2);
  setNodeRunGateDecision(gnr1.id, "fail");
  setNodeRunGateDecision(gnr2.id, "fail");
  const hnr = createNodeRun(run.id, human.id, "waiting_human", 1);

  // Gate 하류가 입력을 구성할 수 있도록 상류 아티팩트를 채운다.
  const wArt = createArtifact(wnr.id, "markdown");
  finalizeArtifact(wArt.id, "# 초안");
  const sArt = createArtifact(snr.id, "json");
  finalizeArtifact(sArt.id, JSON.stringify({ total: 50 }));

  // 승인 → rehydrateForApproval이 gateDecision을 DB에서 복원한다.
  const approveRes = runner.approve(hnr.id);
  check("Human 승인 수락됨", approveRes.ok, JSON.stringify(approveRes));

  // (b) 재개 검사 — wake가 없으면 여기서 running에 머물러 타임아웃 난다.
  const finalStatus = await waitFor(run.id, TERMINAL, 10000).catch(() => "timeout");
  check(
    "재하이드레이션 승인 후 드라이버가 재개되어 run 종결",
    finalStatus !== "timeout",
    `status=${finalStatus}(재개 wake 누락 시 running 고착)`,
  );

  // (a) 라우팅 검사 — 휴리스틱이면 Output이 succeeded로 실행된다.
  const outNrs = nodeRunsOf(run.id).filter((n) => n.nodeId === out.id);
  check(
    "재하이드레이션 후 pass-하류 Output 미실행(Gate 최종 결정=fail)",
    outNrs.length === 0 || outNrs.every((n) => n.status === "skipped"),
    `outNrs=${outNrs.map((n) => n.iteration + ":" + n.status)}`,
  );
  check(
    "재하이드레이션 후 Output HTML 아티팩트 없음",
    outNrs.length === 0 || outNrs.every((n) => !artifactOf(n.id)),
  );
}

// ===========================================================================
// (g) M4 PR2 — 참조 resolve 스냅샷 불변성 + config.mounts 기반 장착(deriveMounts)
//
// 대조군 규율: 이 케이스들은 PR2 이전 코드에서 실패한다.
//  - 스냅샷 resolve 없음 → 스냅샷에 미해소 config가 저장돼(정의 편집이 새어) 불변성 깨짐.
//  - deriveMounts가 mount 엣지를 순회 → 엣지 없는 config.mounts는 무시돼 장착 0개.
// ===========================================================================
async function testResolveSnapshotAndMounts() {
  console.log("\n[g] resolve 스냅샷 불변성 + config.mounts 장착");
  const pl = createPipeline("smoke-resolve-mounts");

  // 팔레트 정의(block_defs): skill/rule/tool + 이들을 mounts로 참조하는 Agent 정의.
  const skillDef = createBlockDef({
    type: "skill", name: "STAR 기법", origin: "human",
    config: { content: "성과는 STAR로 기술한다." },
  });
  const ruleDef = createBlockDef({
    type: "rule", name: "수치화 강제", origin: "human",
    config: { content: "모든 성과를 정량화한다." },
  });
  const toolDef = createBlockDef({
    type: "tool", name: "문서 검색", origin: "human",
    config: { toolName: "search_documents" },
  });
  const agentDef = createBlockDef({
    type: "agent", name: "이력서 작성기", origin: "human",
    config: {
      role: "ROLE_resolved",
      outputFormat: "markdown",
      model: "def-model",
      mounts: [
        { blockDefId: skillDef.id },
        { blockDefId: ruleDef.id, override: { content: "이 Agent에서만: 3줄 이내." } },
        { blockDefId: toolDef.id },
      ],
    },
  });

  // (1) resolveNodeConfig 단위 검증 — 정의 참조 노드가 실효 config를 합성하는가.
  // 노드 오버라이드: role. outputFormat은 인라인으로도 둔다 — validateGraph는
  // resolve 전(라이브) config를 보므로 Output 상류 마크다운 판정에 필요하다
  // (정의의 outputFormat은 검증 시점에 안 보임; resolve 인지 검증은 PR2 범위 밖).
  const refNode = node(
    pl.id, "agent", "작성기 인스턴스",
    { role: "ROLE_override", outputFormat: "markdown" },
    agentDef.id,
  );
  const resolved = resolveNodeConfig({ ...refNode }) as {
    role: string; model?: string; outputFormat: string;
    mounts: { blockDefId: string; type?: string; name?: string; override?: { content?: string; toolName?: string } }[];
  };
  check("resolve: 노드 오버라이드 우선(role=ROLE_override)", resolved.role === "ROLE_override", `role=${resolved.role}`);
  check("resolve: 정의 필드 상속(model=def-model)", resolved.model === "def-model", `model=${resolved.model}`);
  check("resolve: mounts 3개 해소", resolved.mounts?.length === 3, `len=${resolved.mounts?.length}`);
  const rSkill = resolved.mounts.find((m) => m.blockDefId === skillDef.id);
  const rRule = resolved.mounts.find((m) => m.blockDefId === ruleDef.id);
  const rTool = resolved.mounts.find((m) => m.blockDefId === toolDef.id);
  check("resolve: skill type·name 박제", rSkill?.type === "skill" && rSkill?.name === "STAR 기법");
  check("resolve: skill content 정의에서", rSkill?.override?.content === "성과는 STAR로 기술한다.");
  check("resolve: rule override가 정의 위에 덮임", rRule?.override?.content === "이 Agent에서만: 3줄 이내.");
  check("resolve: tool toolName 박제", rTool?.override?.toolName === "search_documents");

  // (2) deriveMounts — resolve된 스냅샷 형태에서 DB 조회 없이 분류하는가.
  const resolvedGraph: Graph = {
    nodes: [{ ...refNode, blockDefId: null, config: resolved as unknown as NodeConfig }],
    edges: [],
  };
  const mounts = deriveMounts(resolvedGraph, refNode.id);
  check("deriveMounts: skill 1개(STAR)", mounts.skills.length === 1 && mounts.skills[0].name === "STAR 기법");
  check("deriveMounts: skill content 반영", mounts.skills[0]?.content === "성과는 STAR로 기술한다.");
  check("deriveMounts: rule 1개(override 반영)", mounts.rules.length === 1 && mounts.rules[0].content === "이 Agent에서만: 3줄 이내.");
  check("deriveMounts: tool 1개(search_documents)", mounts.tools.length === 1 && mounts.tools[0].toolName === "search_documents");

  // (3) 전체 실행 경로 + 스냅샷 불변성.
  const jd = node(pl.id, "input", "JD", { inlineText: "JD 본문" });
  const out = node(pl.id, "output", "OUT", { templateId: "default" });
  const graph: Graph = {
    nodes: [jd, refNode, out],
    edges: [edge(pl.id, jd, refNode), edge(pl.id, refNode, out)],
  };
  saveGraph(pl.id, graph);

  // 스텁: resolve된 systemPrompt(역할+장착)를 관찰해 장착이 프롬프트에 합성됐는지 확인.
  let sawSkill = false, sawRule = false, sawRole = false;
  stubTable = [
    {
      match: (p) => p.systemPrompt.startsWith("ROLE_override"),
      fn: async (p) => {
        sawRole = true;
        sawSkill = /## 스킬: STAR 기법/.test(p.systemPrompt) && /STAR로 기술/.test(p.systemPrompt);
        sawRule = /## 규칙: 수치화 강제/.test(p.systemPrompt) && /3줄 이내/.test(p.systemPrompt);
        return { text: "# 이력서 초안" };
      },
    },
  ];

  const res = runner.start(pl.id);
  if ("errors" in res) throw new Error("검증 실패: " + JSON.stringify(res.errors));
  const status = await waitFor(res.runId, TERMINAL);
  check("resolve 파이프라인 run 성공", status === "succeeded", `status=${status}`);
  check("실행 시 systemPrompt에 역할 반영(오버라이드)", sawRole);
  check("실행 시 systemPrompt에 스킬 주입", sawSkill);
  check("실행 시 systemPrompt에 규칙 append(override 반영)", sawRule);

  // 스냅샷은 resolve 완결본을 담아야 한다(blockDefId=null로 자족).
  const snap = getRunSnapshot(res.runId)!;
  const snapAgent = snap.nodes.find((n) => n.id === refNode.id)!;
  const snapCfg = snapAgent.config as { role: string; model?: string; mounts?: { name?: string; override?: { content?: string } }[] };
  check("스냅샷: Agent config 완결(role=ROLE_override)", snapCfg.role === "ROLE_override");
  check("스냅샷: 참조 끊김(blockDefId=null)", snapAgent.blockDefId === null, `blockDefId=${snapAgent.blockDefId}`);
  const snapRule = snapCfg.mounts?.find((m) => m.name === "수치화 강제");
  check("스냅샷: mount content 박제", snapRule?.override?.content === "이 Agent에서만: 3줄 이내.");

  // ★ 불변성: run 시작 후 정의를 편집해도 스냅샷은 그대로여야 한다.
  createBlockDef({
    type: "rule", name: "수치화 강제", origin: "human", upsert: true,
    config: { content: "★편집됨★ 완전히 다른 규칙." },
  });
  const snap2 = getRunSnapshot(res.runId)!;
  const snap2Rule = (snap2.nodes.find((n) => n.id === refNode.id)!.config as {
    mounts?: { name?: string; override?: { content?: string } }[];
  }).mounts?.find((m) => m.name === "수치화 강제");
  check(
    "불변성: 정의 편집 후에도 스냅샷 mount content 불변",
    snap2Rule?.override?.content === "이 Agent에서만: 3줄 이내.",
    `after-edit=${snap2Rule?.override?.content}`,
  );

  // deriveMounts도 스냅샷(불변)에서 읽으므로 편집 후에도 동일 content.
  const mounts2 = deriveMounts(snap2, refNode.id);
  check(
    "불변성: deriveMounts도 편집 전 content 유지(DB 재조회 없음)",
    mounts2.rules.find((r) => r.name === "수치화 강제")?.content === "이 Agent에서만: 3줄 이내.",
  );
}

// ===========================================================================
// (R1) M4 참조노드 회귀 — validateGraph를 resolve 후 그래프로 돌려야 한다.
//
// 배경: UI가 만드는 참조 노드는 config={}(실효 config는 block_def에 있음)다.
// validation.ts의 emitsJson/emitsMarkdown은 node.config.outputFormat을 직접
// 읽으므로, resolve 전(라이브) 그래프로 검증하면 참조 Agent의 outputFormat이
// undefined다:
//   - 참조 Agent(json)가 Gate 상류면 emitsJson=false → gate_json_upstream 오검증
//   - 참조 Agent(markdown)가 Output 상류면 emitsMarkdown=false →
//     output_markdown_count(0개) 오검증
// → 참조 Agent가 낀 파이프라인이 실행 거부된다.
//
// 대조군 규율: runner.start/startFrom의 검증-순서 수정(resolve 먼저) 이전
// 코드에서 이 케이스는 반드시 실패한다("검증 실패: [...gate_json_upstream...]"
// 또는 output_markdown_count로 runner.start가 {errors} 반환). 그 실패를 본
// 뒤에만 이 케이스를 채택한다. [g](testResolveSnapshotAndMounts)는 ref 노드에
// outputFormat을 인라인으로도 박아 이 회귀를 못 잡으므로, 여기서는 반드시
// config={}인 순수 참조 노드로 구성한다.
// ===========================================================================
async function testRefNodeValidationRegression() {
  console.log("\n[R1] 참조노드(config={}) Gate 상류/Output 상류 검증 회귀");
  const pl = createPipeline("smoke-ref-validation");

  // 팔레트 정의: 실효 config(outputFormat 포함)는 전부 block_def에 있다.
  const writerDef = createBlockDef({
    type: "agent", name: "작성기 정의", origin: "human",
    config: { role: "ROLE_refwriter", outputFormat: "markdown" },
  });
  const screenDef = createBlockDef({
    type: "agent", name: "채점기 정의", origin: "human",
    config: { role: "ROLE_refscreen", outputFormat: "json", jsonSchema: "{total:number}" },
  });

  const jd = node(pl.id, "input", "JD", { inlineText: "JD 본문" });
  // 순수 참조 노드: config={}. outputFormat은 오직 block_def에만 존재.
  //  - writer(markdown 정의)가 Output 상류 → output_markdown_count 회귀 대상.
  //  - screen(json 정의)이 Gate 상류 → gate_json_upstream 회귀 대상.
  const writer = node(pl.id, "agent", "writer", {} as NodeConfig, writerDef.id);
  const screen = node(pl.id, "agent", "screen", {} as NodeConfig, screenDef.id);
  const gate = node(pl.id, "gate", "gate", { expr: "screen.total >= 80", maxLoops: 3, failTargetNodeId: writer.id });
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

  stubTable = [
    { match: (p) => p.systemPrompt.startsWith("ROLE_refwriter"), fn: async () => ({ text: "# 참조 작성기 초안" }) },
    // 즉시 pass(85) — 검증 통과·정상 실행·아티팩트 생성만 확인하면 되므로 루프 불필요.
    { match: (p) => p.systemPrompt.startsWith("ROLE_refscreen"), fn: async () => ({ text: JSON.stringify({ total: 85 }) }) },
  ];

  // 핵심 단언: 검증 통과(runner.start가 {errors}를 반환하지 않는다).
  // 수정 전 코드에서는 여기서 gate_json_upstream/output_markdown_count로 실패한다.
  const res = runner.start(pl.id);
  const rejected = "errors" in res;
  check(
    "참조노드 파이프라인 검증 통과(gate_json_upstream/output_markdown_count 오검증 없음)",
    !rejected,
    rejected ? "errors=" + JSON.stringify((res as { errors: unknown }).errors) : undefined,
  );
  if (rejected) return; // 검증 거부 시 이후 실행 단언은 무의미.

  const status = await waitFor(res.runId, TERMINAL);
  check("참조노드 파이프라인 run 성공", status === "succeeded", `status=${status}`);

  const nrs = nodeRunsOf(res.runId);
  // Gate 상류 참조 Agent(json)가 실제로 json 아티팩트를 냈는가.
  const screenNr = nrs.find((n) => n.nodeId === screen.id && n.status === "succeeded");
  const screenArt = screenNr ? artifactOf(screenNr.id) : null;
  check("참조 Agent(json) 아티팩트 생성", !!screenArt && screenArt.format === "json", screenArt?.format);
  // Output 상류 참조 Agent(markdown)가 Gate pass 통과로 Output까지 흘렀는가.
  const outNr = nrs.find((n) => n.nodeId === out.id && n.status === "succeeded");
  const outArt = outNr ? artifactOf(outNr.id) : null;
  check("Output HTML 아티팩트 생성(markdown 참조 Agent가 상류)", !!outArt && outArt.format === "html" && /<html/i.test(outArt.content));
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
  await testGateDecisionPersisted();
  await testHuman();
  await testPartialRerun();
  await testCancel();
  await testRecovery();
  await testResolveSnapshotAndMounts();
  await testRefNodeValidationRegression();

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
