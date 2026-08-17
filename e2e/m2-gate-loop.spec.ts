import { test, expect } from "./support/fixtures";
import { putGraph, startRun, waitForRun, nid } from "./support/api";

test("M2: writer→[scorer-a∥scorer-b]→gate(pass)→output — 재작성 후 pass 종료", async ({
  request,
  pipelineId,
  page,
}) => {
  const inp = nid("in"), writer = nid("ag");
  const scorerA = nid("sa"), scorerB = nid("sb");
  const gate = nid("gate"), out = nid("out");

  await putGraph(request, pipelineId, [
    { id: inp, type: "input", name: "JD", config: { inlineText: "# JD\n백엔드" } },
    { id: writer, type: "agent", name: "작성자", config: { role: "[E2E:writer] 이력서 작성", outputFormat: "markdown" } },
    { id: scorerA, type: "agent", name: "scorer-a", config: { role: "[E2E:scorer-a]", outputFormat: "json" } },
    { id: scorerB, type: "agent", name: "scorer-b", config: { role: "[E2E:scorer-b]", outputFormat: "json" } },
    { id: gate, type: "gate", name: "gate", config: { expr: "scorer-a.total >= 80 && scorer-b.total >= 80", maxLoops: 2, failTargetNodeId: writer } },
    { id: out, type: "output", name: "HTML", config: { templateId: "default" } },
  ], [
    { id: nid("e"), sourceNodeId: inp, targetNodeId: writer },
    { id: nid("e"), sourceNodeId: writer, targetNodeId: scorerA },
    { id: nid("e"), sourceNodeId: writer, targetNodeId: scorerB },
    { id: nid("e"), sourceNodeId: writer, targetNodeId: gate },
    { id: nid("e"), sourceNodeId: scorerA, targetNodeId: gate },
    { id: nid("e"), sourceNodeId: scorerB, targetNodeId: gate },
    { id: nid("e"), sourceNodeId: gate, targetNodeId: out, sourceHandle: "pass" },
    { id: nid("e"), sourceNodeId: gate, targetNodeId: writer, sourceHandle: "fail" },
  ]);

  // UI: 캔버스 이동, run 시작
  await page.goto(`/pipelines/${pipelineId}`);
  await expect(page.locator('[data-testid="run-btn"]')).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-testid="run-btn"]').click();

  // run 완료까지 API 폴링
  await expect.poll(
    async () => {
      const runsRes = await request.get(`/api/pipelines/${pipelineId}/runs`);
      const runs = await runsRes.json() as Array<{ id: string }>;
      if (runs.length === 0) return "none";
      const state = await request.get(`/api/runs/${runs[0].id}`);
      const s = await state.json() as { run: { status: string } };
      return s.run.status;
    },
    { timeout: 60_000, intervals: [500] }
  ).toBe("succeeded");

  // writer nodeRuns 수 확인
  const runsRes = await request.get(`/api/pipelines/${pipelineId}/runs`);
  const runs = await runsRes.json() as Array<{ id: string }>;
  const stateRes = await request.get(`/api/runs/${runs[0].id}`);
  const state = await stateRes.json() as { run: { status: string }; nodeRuns: Array<{ nodeId: string; iteration: number; status: string }> };
  const writerRuns = state.nodeRuns.filter((nr) => nr.nodeId === writer);
  expect(writerRuns.length).toBeGreaterThanOrEqual(2);

  // writer 노드 더블클릭(두 번 클릭) → 노드 탭 → 아티팩트 탭 → 회차 칩(단일 클릭은 선택만)
  const writerNode = page.locator(`[data-testid="node-${writer}"]`);
  await writerNode.click();
  await writerNode.click();
  await page.locator('[data-testid="artifact-tab"]').click();

  // 회차 칩이 writerRuns 수만큼 있어야 함
  await expect.poll(
    async () => page.locator('[data-testid^="iteration-chip-"]').count(),
    { timeout: 15_000, intervals: [500] }
  ).toBeGreaterThanOrEqual(writerRuns.length);
});

test("M2: scorer-alwaysfail → gate_failed", async ({
  request,
  pipelineId,
}) => {
  const inp = nid("in"), writer = nid("ag");
  const scorer = nid("sc"), gate = nid("gate"), out = nid("out");

  await putGraph(request, pipelineId, [
    { id: inp, type: "input", name: "JD", config: { inlineText: "# JD\n백엔드" } },
    { id: writer, type: "agent", name: "작성자", config: { role: "[E2E:writer] 이력서 작성", outputFormat: "markdown" } },
    { id: scorer, type: "agent", name: "채점자", config: { role: "[E2E:scorer-alwaysfail]", outputFormat: "json" } },
    { id: gate, type: "gate", name: "gate", config: { expr: "채점자.total >= 80", maxLoops: 2, failTargetNodeId: writer } },
    { id: out, type: "output", name: "HTML", config: { templateId: "default" } },
  ], [
    { id: nid("e"), sourceNodeId: inp, targetNodeId: writer },
    { id: nid("e"), sourceNodeId: writer, targetNodeId: scorer },
    { id: nid("e"), sourceNodeId: writer, targetNodeId: gate },
    { id: nid("e"), sourceNodeId: scorer, targetNodeId: gate },
    { id: nid("e"), sourceNodeId: gate, targetNodeId: out, sourceHandle: "pass" },
    { id: nid("e"), sourceNodeId: gate, targetNodeId: writer, sourceHandle: "fail" },
  ]);

  const res = await startRun(request, pipelineId);
  expect(res.runId).toBeTruthy();
  const state = await waitForRun(request, res.runId!, { timeoutMs: 60_000, until: (s) => s === "gate_failed" || s === "failed" || s === "succeeded" });
  expect(state.run.status).toBe("gate_failed");
});
