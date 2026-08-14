// Canonical live acceptance harness (real Claude Agent SDK, production DB).
//
// Usage:
//   RECRUIT_FLOW_DB_PATH=data/recruit-flow.db npx tsx scripts/run-canonical-live.mts
//
// This intentionally creates a persistent pipeline/run in the selected DB and writes
// the downloaded HTML plus a visual verification screenshot under tmp/canonical-live.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

import type {
  AgentConfig,
  EdgeRow,
  Graph,
  NodeConfig,
  NodeRow,
} from "../src/lib/types";

const DB_PATH = process.env.RECRUIT_FLOW_DB_PATH;
const retrySourceRunId = process.env.CANONICAL_RETRY_SOURCE_RUN_ID;
if (!DB_PATH) throw new Error("RECRUIT_FLOW_DB_PATH is required");
if (process.env.RECRUIT_FLOW_E2E_STUB === "1") {
  throw new Error("Canonical live harness refuses RECRUIT_FLOW_E2E_STUB=1");
}

const {
  createPipeline,
  getGraph,
  getRunState,
  listBlockDefs,
  saveGraph,
} = await import("../src/lib/db/queries");
const { runner } = await import("../src/lib/engine/runner");
const { validateGraph } = await import("../src/lib/validation");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
// A previous live harness process may have been interrupted while its DB-backed run
// remained `running`. Apply the engine's normal boot recovery before creating a new run.
runner.recoverOnBoot();
const pipeline = createPipeline(`${retrySourceRunId ? "canonical-live-final-retry" : "canonical-live"}-${stamp}`);
const idPrefix = `canonical_${stamp.replace(/[^a-zA-Z0-9]/g, "_")}`;
let seq = 0;

function node(
  type: NodeRow["type"],
  name: string,
  config: NodeConfig,
  positionX: number,
  positionY: number,
): NodeRow {
  return {
    id: `${idPrefix}_${type}_${++seq}`,
    pipelineId: pipeline.id,
    type,
    name,
    positionX,
    positionY,
    config,
  };
}

function edge(
  source: NodeRow,
  target: NodeRow,
  opts: Partial<Pick<EdgeRow, "kind" | "sourceHandle" | "inputOrder">> = {},
): EdgeRow {
  return {
    id: `${idPrefix}_edge_${++seq}`,
    pipelineId: pipeline.id,
    sourceNodeId: source.id,
    targetNodeId: target.id,
    kind: opts.kind ?? "flow",
    sourceHandle: opts.sourceHandle ?? null,
    inputOrder: opts.inputOrder ?? 0,
  };
}

const blockDefs = listBlockDefs({ enabledOnly: true });
function importedAgent(name: string): AgentConfig {
  const def = blockDefs.find((candidate) => candidate.type === "agent" && candidate.name === name);
  if (!def) throw new Error(`Imported agent block is missing: ${name}`);
  return def.config as AgentConfig;
}

const baseRequest = [
  "검증된 문서 라이브러리를 근거로 한국어 경력 이력서를 작성하세요.",
  "실제 지원 대상은 `두산로보틱스(주) / Fullstack Developer (경력)` 공고입니다.",
  "target-companies.md를 가장 먼저 조회해 위 회사/직무 엔트리의 JD·요구사항·회사 맥락을 정확히 반영하세요.",
  "그다음 profile.md, experience-bank.md, base-resume.md, writing-guidelines.md, metric-registry.md를 사용하세요.",
  "공고와 검증된 경력의 접점을 근거로 지원 동기와 직무·문화 적합성을 명시하되, 확인되지 않은 회사 정보나 경험은 만들지 마세요.",
  "needs_scope 지표는 승인된 스코프를 명시할 수 있을 때만 사용하고, 불명확하면 제거하세요.",
  "모든 수치와 성과는 문서에서 확인된 사실만 쓰고, 채용 담당자가 빠르게 스캔할 수 있는 Markdown으로 작성하세요.",
  "리뷰 및 채점 피드백이 입력되면 근거를 유지하면서 차단 사유를 해소하세요.",
  "최종 이력서 Markdown 본문만 출력하고 코드 펜스나 변경 설명은 덧붙이지 마세요.",
];

let inputText = baseRequest.join("\n");
if (retrySourceRunId) {
  const sourceState = getRunState(retrySourceRunId);
  if (!sourceState) throw new Error(`Retry source run not found: ${retrySourceRunId}`);
  const sourceGraph = getGraph(sourceState.run.pipelineId);
  const contentAtIteration = (nodeName: string, iteration: number) => {
    const sourceNode = sourceGraph.nodes.find((item) => item.name === nodeName);
    const sourceNodeRun = sourceNode
      ? sourceState.nodeRuns.find(
          (item) =>
            item.nodeId === sourceNode.id &&
            item.iteration === iteration &&
            item.status === "succeeded",
        )
      : null;
    const artifact = sourceNodeRun
      ? sourceState.artifacts.find((item) => item.nodeRunId === sourceNodeRun.id)
      : null;
    if (!artifact) throw new Error(`Retry source artifact missing: ${nodeName}#${iteration}`);
    return artifact.content;
  };
  inputText = [
    ...baseRequest,
    "아래는 rate limit 직전까지 완료된 두산 맞춤 2회차 결과입니다. 처음부터 다시 쓰지 말고 이 초안을 79점 채점 피드백과 reviewer 지적에 맞춰 최종 수정하세요.",
    "## 두산 맞춤 writer 2회차 초안",
    contentAtIteration("writer", 2),
    "## reviewer 2회차 검토",
    contentAtIteration("reviewer", 2),
    "## recruiter-screen 2회차 채점 JSON",
    contentAtIteration("recruiter-screen", 2),
  ].join("\n\n");
}

const input = node(
  "input",
  "Canonical resume request",
  {
    inlineText: inputText,
  },
  0,
  180,
);
const writer = node("agent", "writer", importedAgent("writer"), 260, 180);
const reviewer = node("agent", "reviewer", importedAgent("reviewer"), 520, 80);
const recruiter = node(
  "agent",
  "recruiter-screen",
  importedAgent("recruiter-screen"),
  760,
  180,
);
const gate = node(
  "gate",
  "recruiter-score-gate",
  {
    expr: "recruiter-screen.total >= 80",
    maxLoops: retrySourceRunId ? 1 : 3,
    failTargetNodeId: writer.id,
  },
  1000,
  180,
);
const human = node(
  "human",
  "final-human-approval",
  {
    instruction: "실제 recruiter gate를 통과한 canonical 이력서를 최종 승인합니다.",
    allowEdit: true,
    primaryInputNodeId: writer.id,
  },
  1240,
  180,
);
const output = node(
  "output",
  "canonical-html-output",
  { templateId: "default", filenameRule: "canonical-resume.html" },
  1480,
  180,
);
const getDocument = node("tool", "get_document", { toolName: "get_document" }, 260, 360);
const searchDocuments = node(
  "tool",
  "search_documents",
  { toolName: "search_documents" },
  520,
  360,
);

const graph: Graph = {
  nodes: [input, writer, reviewer, recruiter, gate, human, output, getDocument, searchDocuments],
  edges: [
    edge(input, writer),
    edge(writer, reviewer),
    edge(writer, recruiter, { inputOrder: 0 }),
    edge(reviewer, recruiter, { inputOrder: 1 }),
    edge(writer, gate, { inputOrder: 0 }),
    edge(recruiter, gate, { inputOrder: 1 }),
    edge(gate, writer, { sourceHandle: "fail" }),
    edge(writer, human, { inputOrder: 0 }),
    edge(gate, human, { sourceHandle: "pass", inputOrder: 1 }),
    edge(human, output),
    ...[writer, reviewer, recruiter].flatMap((agent) => [
      edge(getDocument, agent, { kind: "mount" }),
      edge(searchDocuments, agent, { kind: "mount" }),
    ]),
  ],
};

const validationErrors = validateGraph(graph.nodes, graph.edges);
if (validationErrors.length > 0) {
  throw new Error(`Canonical graph validation failed: ${JSON.stringify(validationErrors)}`);
}
saveGraph(pipeline.id, graph);

console.log(`PIPELINE ${pipeline.id} ${pipeline.name}`);
console.log("TOPOLOGY Input -> writer -> reviewer -> recruiter-screen(JSON) -> Gate(fail:writer/pass:Human) -> Human -> Output");

const started = runner.start(pipeline.id);
if ("errors" in started) throw new Error(`Run start failed: ${JSON.stringify(started.errors)}`);
const runId = started.runId;
console.log(`RUN ${runId} started`);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitForStatus(
  predicate: (status: string) => boolean,
  timeoutMs = Number(process.env.CANONICAL_LIVE_TIMEOUT_MS ?? 90 * 60_000),
) {
  const startedAt = Date.now();
  let lastStatus = "";
  while (Date.now() - startedAt < timeoutMs) {
    const state = getRunState(runId);
    if (!state) throw new Error(`Run disappeared: ${runId}`);
    if (state.run.status !== lastStatus) {
      lastStatus = state.run.status;
      console.log(`STATUS ${lastStatus}`);
    }
    if (predicate(lastStatus)) return state;
    await sleep(500);
  }
  throw new Error(`Timed out waiting for run ${runId}; last status=${lastStatus}`);
}

const waiting = await waitForStatus((status) =>
  ["waiting_human", "failed", "gate_failed", "cancelled"].includes(status),
);
if (waiting.run.status !== "waiting_human") {
  const failures = waiting.nodeRuns
    .filter((item) => item.status === "failed")
    .map((item) => ({ nodeId: item.nodeId, iteration: item.iteration, error: item.error }));
  throw new Error(`Canonical run did not reach Human: ${waiting.run.status} ${JSON.stringify(failures)}`);
}

const humanRun = waiting.nodeRuns.find(
  (item) => item.nodeId === human.id && item.status === "waiting_human",
);
if (!humanRun) throw new Error("Human node_run is missing at waiting_human");
const approvedWriterRun = waiting.nodeRuns
  .filter((item) => item.nodeId === writer.id && item.status === "succeeded")
  .sort((a, b) => b.iteration - a.iteration)[0];
const approvedWriterArtifact = approvedWriterRun
  ? waiting.artifacts.find((item) => item.nodeRunId === approvedWriterRun.id)
  : null;
if (!approvedWriterArtifact) throw new Error("Writer artifact missing at Human approval");
const fencedResume = Array.from(
  approvedWriterArtifact.content.matchAll(/```(?:markdown|md)?\s*\n([\s\S]*?)```/gi),
)
  .map((match) => match[1].trim())
  .sort((a, b) => Buffer.byteLength(b, "utf8") - Buffer.byteLength(a, "utf8"))[0];
const approvedContent = fencedResume ?? approvedWriterArtifact.content;
const approval = runner.approve(humanRun.id, approvedContent);
if (!approval.ok) throw new Error(`Human approval failed: ${approval.error}`);
console.log(`APPROVED ${humanRun.id}`);

const finalState = await waitForStatus((status) =>
  ["succeeded", "failed", "gate_failed", "cancelled"].includes(status),
);
if (finalState.run.status !== "succeeded") {
  const failures = finalState.nodeRuns
    .filter((item) => item.status === "failed")
    .map((item) => ({ nodeId: item.nodeId, iteration: item.iteration, error: item.error }));
  throw new Error(`Canonical run failed: ${finalState.run.status} ${JSON.stringify(failures)}`);
}

const outputRun = finalState.nodeRuns.find(
  (item) => item.nodeId === output.id && item.status === "succeeded",
);
if (!outputRun) throw new Error("Output node did not succeed");
const outputArtifact = finalState.artifacts.find((item) => item.nodeRunId === outputRun.id);
if (!outputArtifact || outputArtifact.format !== "html") {
  throw new Error("Output HTML artifact is missing");
}

// Exercise the actual download route, not just the DB row.
const { GET: downloadArtifact } = await import("../src/app/api/artifacts/[id]/download/route");
const downloadResponse = await downloadArtifact(
  new Request(`http://localhost/api/artifacts/${outputArtifact.id}/download`),
  { params: Promise.resolve({ id: outputArtifact.id }) },
);
if (!downloadResponse.ok) throw new Error(`Artifact download failed: HTTP ${downloadResponse.status}`);
const downloadedHtml = await downloadResponse.text();
if (downloadedHtml !== outputArtifact.content) {
  throw new Error("Downloaded artifact differs from the persisted artifact");
}
if (!/^<!DOCTYPE html>/i.test(downloadedHtml) || !downloadedHtml.includes('<main class="resume">')) {
  throw new Error("Downloaded artifact is not a self-contained resume HTML document");
}

const outputDir = path.resolve("tmp/canonical-live");
mkdirSync(outputDir, { recursive: true });
const htmlPath = path.join(outputDir, `canonical-resume-${runId}.html`);
const screenshotPath = path.join(outputDir, `canonical-resume-${runId}.png`);
writeFileSync(htmlPath, downloadedHtml, "utf8");

const browser = await chromium.launch({ headless: true });
let headingVerification: {
  counts: { h1: number; h2: number; h3: number };
  fontSizes: { h1: number[]; h2: number[]; h3: number[] };
  usedH3Probe: boolean;
  hierarchy: boolean;
};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });
  await page.setContent(downloadedHtml, { waitUntil: "load" });
  headingVerification = await page.evaluate(() => {
    const h1 = Array.from(document.querySelectorAll("h1")).map((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
    const h2 = Array.from(document.querySelectorAll("h2")).map((element) =>
      Number.parseFloat(getComputedStyle(element).fontSize),
    );
    const h3 = Array.from(document.querySelectorAll("h3")).map((element) =>
        Number.parseFloat(getComputedStyle(element).fontSize),
    );
    const usedH3Probe = h3.length === 0;
    if (usedH3Probe) {
      const probe = document.createElement("h3");
      probe.textContent = "Heading hierarchy probe";
      document.querySelector("main")?.appendChild(probe);
      h3.push(Number.parseFloat(getComputedStyle(probe).fontSize));
      probe.remove();
    }
    return {
      counts: {
        h1: document.querySelectorAll("h1").length,
        h2: document.querySelectorAll("h2").length,
        h3: document.querySelectorAll("h3").length,
      },
      fontSizes: { h1, h2, h3 },
      usedH3Probe,
      hierarchy:
        h1.length > 0 &&
        h2.length > 0 &&
        h3.length > 0 &&
        Math.min(...h1) > Math.max(...h2) &&
        Math.min(...h2) > Math.max(...h3),
    };
  });
  await page.screenshot({ path: screenshotPath, fullPage: true });
} finally {
  await browser.close();
}
if (!headingVerification.hierarchy) {
  throw new Error(`Heading hierarchy verification failed: ${JSON.stringify(headingVerification)}`);
}

const nodeNameById = new Map(graph.nodes.map((item) => [item.id, item.name]));
const execution = finalState.nodeRuns
  .filter((item) => [writer.id, reviewer.id, recruiter.id, gate.id, human.id, output.id].includes(item.nodeId))
  .map((item) => {
    const artifact = finalState.artifacts.find((candidate) => candidate.nodeRunId === item.id);
    let score: number | null = null;
    if (item.nodeId === recruiter.id && artifact?.format === "json") {
      try {
        const parsed = JSON.parse(artifact.content) as { total?: unknown };
        score = typeof parsed.total === "number" ? parsed.total : null;
      } catch {
        score = null;
      }
    }
    return {
      node: nodeNameById.get(item.nodeId),
      iteration: item.iteration,
      status: item.status,
      gateDecision: item.gateDecision,
      artifactFormat: artifact?.format ?? null,
      artifactBytes: artifact ? Buffer.byteLength(artifact.content, "utf8") : 0,
      score,
    };
  });

console.log(
  `RESULT ${JSON.stringify({
    pipelineId: pipeline.id,
    retrySourceRunId: retrySourceRunId ?? null,
    runId,
    status: finalState.run.status,
    approvedMarkdownBytes: Buffer.byteLength(approvedContent, "utf8"),
    extractedFencedResume: Boolean(fencedResume),
    execution,
    outputArtifactId: outputArtifact.id,
    contentDisposition: downloadResponse.headers.get("content-disposition"),
    htmlPath,
    htmlBytes: Buffer.byteLength(downloadedHtml, "utf8"),
    screenshotPath,
    headingVerification,
  })}`,
);
