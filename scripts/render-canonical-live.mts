// Render a real writer artifact from a completed canonical run through
// Input -> Human approval -> Output, then exercise the download route and browser CSS.
// Usage: RECRUIT_FLOW_DB_PATH=data/recruit-flow.db CANONICAL_SOURCE_RUN_ID=... npx tsx scripts/render-canonical-live.mts

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

import type { EdgeRow, Graph, NodeConfig, NodeRow } from "../src/lib/types";

const sourceRunId = process.env.CANONICAL_SOURCE_RUN_ID;
if (!process.env.RECRUIT_FLOW_DB_PATH) throw new Error("RECRUIT_FLOW_DB_PATH is required");
if (!sourceRunId) throw new Error("CANONICAL_SOURCE_RUN_ID is required");

const { createPipeline, getGraph, getRunState, saveGraph } = await import("../src/lib/db/queries");
const { runner } = await import("../src/lib/engine/runner");
const { validateGraph } = await import("../src/lib/validation");

const sourceState = getRunState(sourceRunId);
if (!sourceState) throw new Error(`Source run not found: ${sourceRunId}`);
const sourceGraph = getGraph(sourceState.run.pipelineId);
const writerNode = sourceGraph.nodes.find((item) => item.name === "writer");
if (!writerNode) throw new Error("Source writer node not found");
const writerRuns = sourceState.nodeRuns
  .filter((item) => item.nodeId === writerNode.id && item.status === "succeeded")
  .sort((a, b) => b.iteration - a.iteration);
const sourceWriterRun = writerRuns[0];
if (!sourceWriterRun) throw new Error("Succeeded source writer node_run not found");
const sourceArtifact = sourceState.artifacts.find((item) => item.nodeRunId === sourceWriterRun.id);
if (!sourceArtifact || sourceArtifact.format !== "markdown") {
  throw new Error("Final source writer Markdown artifact not found");
}
// Real writer responses may wrap the resume in a fenced Markdown block and add
// an explanatory change log. Human edit approval should select the actual resume,
// otherwise the deterministic renderer correctly turns the fence into a <pre> block.
const fencedMarkdown = Array.from(
  sourceArtifact.content.matchAll(/```(?:markdown|md)?\s*\n([\s\S]*?)```/gi),
).map((match) => match[1].trim());
const approvalMarkdown =
  fencedMarkdown.sort((a, b) => Buffer.byteLength(b, "utf8") - Buffer.byteLength(a, "utf8"))[0] ??
  sourceArtifact.content;
const extractedFencedResume = approvalMarkdown !== sourceArtifact.content;
if (!/^#{1,3}\s+/m.test(approvalMarkdown)) {
  throw new Error("Human approval candidate has no Markdown headings");
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const idPrefix = `canonical_render_${stamp.replace(/[^a-zA-Z0-9]/g, "_")}`;
const pipeline = createPipeline(`canonical-live-render-${stamp}`);
let seq = 0;
function node(type: NodeRow["type"], name: string, config: NodeConfig, x: number): NodeRow {
  return {
    id: `${idPrefix}_${type}_${++seq}`,
    pipelineId: pipeline.id,
    type,
    name,
    positionX: x,
    positionY: 180,
    config,
  };
}
function edge(source: NodeRow, target: NodeRow): EdgeRow {
  return {
    id: `${idPrefix}_edge_${++seq}`,
    pipelineId: pipeline.id,
    sourceNodeId: source.id,
    targetNodeId: target.id,
    kind: "flow",
    sourceHandle: null,
    inputOrder: 0,
  };
}

const input = node(
  "input",
  `canonical-writer-iteration-${sourceWriterRun.iteration}`,
  { inlineText: sourceArtifact.content },
  0,
);
const human = node(
  "human",
  "final-human-approval",
  {
    instruction: `Canonical run ${sourceRunId}의 최종 writer 산출물을 승인합니다.`,
    allowEdit: true,
    primaryInputNodeId: input.id,
  },
  300,
);
const output = node(
  "output",
  "canonical-html-output",
  { templateId: "default", filenameRule: "canonical-resume.html" },
  600,
);
const graph: Graph = {
  nodes: [input, human, output],
  edges: [edge(input, human), edge(human, output)],
};
const errors = validateGraph(graph.nodes, graph.edges);
if (errors.length > 0) throw new Error(`Render graph invalid: ${JSON.stringify(errors)}`);
saveGraph(pipeline.id, graph);

const started = runner.start(pipeline.id);
if ("errors" in started) throw new Error(`Render run start failed: ${JSON.stringify(started.errors)}`);
const runId = started.runId;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(statuses: string[]) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const state = getRunState(runId);
    if (!state) throw new Error(`Render run disappeared: ${runId}`);
    if (statuses.includes(state.run.status)) return state;
    await sleep(100);
  }
  throw new Error(`Render run timeout: ${runId}`);
}

const waiting = await waitFor(["waiting_human", "failed", "cancelled"]);
if (waiting.run.status !== "waiting_human") {
  throw new Error(`Render run did not reach Human: ${waiting.run.status}`);
}
const humanRun = waiting.nodeRuns.find(
  (item) => item.nodeId === human.id && item.status === "waiting_human",
);
if (!humanRun) throw new Error("Waiting Human node_run missing");
const approved = runner.approve(humanRun.id, approvalMarkdown);
if (!approved.ok) throw new Error(`Human approval failed: ${approved.error}`);

const finalState = await waitFor(["succeeded", "failed", "cancelled"]);
if (finalState.run.status !== "succeeded") {
  throw new Error(`Render run failed: ${finalState.run.status}`);
}
const outputRun = finalState.nodeRuns.find(
  (item) => item.nodeId === output.id && item.status === "succeeded",
);
const outputArtifact = outputRun
  ? finalState.artifacts.find((item) => item.nodeRunId === outputRun.id)
  : null;
if (!outputArtifact || outputArtifact.format !== "html") {
  throw new Error("Rendered HTML artifact missing");
}

const { GET: downloadArtifact } = await import("../src/app/api/artifacts/[id]/download/route");
const response = await downloadArtifact(
  new Request(`http://localhost/api/artifacts/${outputArtifact.id}/download`),
  { params: Promise.resolve({ id: outputArtifact.id }) },
);
if (!response.ok) throw new Error(`Download route returned HTTP ${response.status}`);
const html = await response.text();
if (html !== outputArtifact.content || !/^<!DOCTYPE html>/i.test(html)) {
  throw new Error("Downloaded HTML verification failed");
}

const outputDir = path.resolve("tmp/canonical-live");
mkdirSync(outputDir, { recursive: true });
const htmlPath = path.join(outputDir, `canonical-resume-${runId}.html`);
const screenshotPath = path.join(outputDir, `canonical-resume-${runId}.png`);
writeFileSync(htmlPath, html, "utf8");

const browser = await chromium.launch({ headless: true });
let headingVerification: {
  counts: Record<"h1" | "h2" | "h3", number>;
  fontSizes: Record<"h1" | "h2" | "h3", number[]>;
  usedH3Probe: boolean;
  hierarchy: boolean;
};
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1800 } });
  await page.setContent(html, { waitUntil: "load" });
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
        h1.length > 0 && h2.length > 0 && h3.length > 0 &&
        Math.min(...h1) > Math.max(...h2) && Math.min(...h2) > Math.max(...h3),
    };
  });
  await page.screenshot({ path: screenshotPath, fullPage: true });
} finally {
  await browser.close();
}
if (!headingVerification.hierarchy) {
  throw new Error(`Heading hierarchy failed: ${JSON.stringify(headingVerification)}`);
}

console.log(
  `RESULT ${JSON.stringify({
    sourceRunId,
    sourceWriterIteration: sourceWriterRun.iteration,
    sourceArtifactId: sourceArtifact.id,
    sourceBytes: Buffer.byteLength(sourceArtifact.content, "utf8"),
    approvedMarkdownBytes: Buffer.byteLength(approvalMarkdown, "utf8"),
    extractedFencedResume,
    pipelineId: pipeline.id,
    runId,
    status: finalState.run.status,
    humanNodeRunId: humanRun.id,
    outputArtifactId: outputArtifact.id,
    htmlBytes: Buffer.byteLength(html, "utf8"),
    contentDisposition: response.headers.get("content-disposition"),
    htmlPath,
    screenshotPath,
    headingVerification,
  })}`,
);
