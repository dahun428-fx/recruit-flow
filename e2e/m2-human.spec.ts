import { test, expect } from "./support/fixtures";
import { putGraph, startRun, waitForRun, nid } from "./support/api";

test("M2: Human 노드 waiting_human → 사이드패널 승인 → 진행", async ({
  request,
  pipelineId,
  page,
}) => {
  const inp = nid("in"), ag = nid("ag"), human = nid("hu"), out = nid("out");
  await putGraph(request, pipelineId, [
    { id: inp, type: "input", name: "JD", config: { inlineText: "# JD\n백엔드" } },
    { id: ag, type: "agent", name: "작성자", config: { role: "[E2E:writer] 이력서를 작성한다.", outputFormat: "markdown" } },
    { id: human, type: "human", name: "검토자", config: { instruction: "검토해주세요", allowEdit: false } },
    { id: out, type: "output", name: "HTML", config: { templateId: "default" } },
  ], [
    { id: nid("e"), sourceNodeId: inp, targetNodeId: ag },
    { id: nid("e"), sourceNodeId: ag, targetNodeId: human },
    { id: nid("e"), sourceNodeId: human, targetNodeId: out },
  ]);

  await page.goto(`/pipelines/${pipelineId}`);
  await expect(page.locator('[data-testid^="node-"]').first()).toBeVisible({ timeout: 15_000 });

  // run 시작 (UI)
  await page.locator('[data-testid="run-btn"]').click();

  // run이 waiting_human이 될 때까지 API 폴링
  const runsWait = await expect.poll(
    async () => {
      const r = await request.get(`/api/pipelines/${pipelineId}/runs`);
      const runs = await r.json() as Array<{ id: string }>;
      if (runs.length === 0) return "none";
      const s = await request.get(`/api/runs/${runs[0].id}`);
      const body = await s.json() as { run: { status: string }; nodeRuns: Array<{ nodeId: string; id: string; status: string }> };
      return body.run.status;
    },
    { timeout: 30_000, intervals: [500] }
  ).toBe("waiting_human");

  // human nodeRunId 조회하여 API로 직접 승인
  const runsRes = await request.get(`/api/pipelines/${pipelineId}/runs`);
  const runs = await runsRes.json() as Array<{ id: string }>;
  const stateRes = await request.get(`/api/runs/${runs[0].id}`);
  const stateBody = await stateRes.json() as { run: { status: string }; nodeRuns: Array<{ nodeId: string; id: string; status: string }> };
  const humanNr = stateBody.nodeRuns.find((nr) => nr.nodeId === human && nr.status === "waiting_human");
  expect(humanNr).toBeTruthy();

  // API로 승인
  const approveRes = await request.post(`/api/node-runs/${humanNr!.id}/approve`, {
    data: {},
  });
  expect(approveRes.ok()).toBe(true);

  // run이 완료될 때까지 API 폴링
  const state = await waitForRun(request, runs[0].id, { timeoutMs: 30_000 });
  expect(state.run.status).toBe("succeeded");
});

// P1-2 회귀: useRunStream이 waiting_human에서 SSE 구독을 끊어버려, 다른
// 탭·채팅 독에서 승인해도 캔버스가 새로고침 전까지 멈춰 있던 결함.
// 승인은 API로(=다른 세션이 승인한 상황) 하고, **새로고침 없이** UI가
// 진행되는지 본다(engine.md §3 재구독 조건).
test("M2: waiting_human 승인 후 새로고침 없이 캔버스가 재개된다", async ({
  request,
  pipelineId,
  page,
}) => {
  const inp = nid("in"), ag = nid("ag"), human = nid("hu"), out = nid("out");
  await putGraph(request, pipelineId, [
    { id: inp, type: "input", name: "JD", config: { inlineText: "# JD\n백엔드" } },
    { id: ag, type: "agent", name: "작성자", config: { role: "[E2E:writer] 이력서를 작성한다.", outputFormat: "markdown" } },
    { id: human, type: "human", name: "검토자", config: { instruction: "검토해주세요", allowEdit: false } },
    { id: out, type: "output", name: "HTML", config: { templateId: "default" } },
  ], [
    { id: nid("e"), sourceNodeId: inp, targetNodeId: ag },
    { id: nid("e"), sourceNodeId: ag, targetNodeId: human },
    { id: nid("e"), sourceNodeId: human, targetNodeId: out },
  ]);

  await page.goto(`/pipelines/${pipelineId}`);
  await expect(page.locator('[data-testid^="node-"]').first()).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="run-btn"]').click();

  // 캔버스에서 Human 노드가 사람 대기로 보일 때까지(= SSE가 살아 있음).
  const humanNode = page.locator(`[data-testid="node-${human}"]`);
  await expect(humanNode.locator('[data-testid="node-status"]'))
    .toHaveText("● 사람 대기 중", { timeout: 30_000 });

  // 다른 세션이 승인한 상황을 API로 재현.
  const runsRes = await request.get(`/api/pipelines/${pipelineId}/runs`);
  const runs = await runsRes.json() as Array<{ id: string }>;
  const stateRes = await request.get(`/api/runs/${runs[0].id}`);
  const stateBody = await stateRes.json() as { nodeRuns: Array<{ nodeId: string; id: string; status: string }> };
  const humanNr = stateBody.nodeRuns.find((nr) => nr.nodeId === human && nr.status === "waiting_human");
  expect(humanNr).toBeTruthy();
  const approveRes = await request.post(`/api/node-runs/${humanNr!.id}/approve`, { data: {} });
  expect(approveRes.ok()).toBe(true);

  // ★ page.reload() 없이 캔버스가 갱신돼야 한다.
  await expect(page.locator(`[data-testid="node-${out}"] [data-testid="node-status"]`))
    .toHaveText("● 성공", { timeout: 30_000 });
});

test("M2: allowEdit Human 노드 → 편집 승인", async ({
  request,
  pipelineId,
  page,
}) => {
  const inp = nid("in"), ag = nid("ag"), human = nid("hu"), out = nid("out");
  await putGraph(request, pipelineId, [
    { id: inp, type: "input", name: "JD", config: { inlineText: "# JD\n백엔드" } },
    { id: ag, type: "agent", name: "작성자", config: { role: "[E2E:writer] 이력서를 작성한다.", outputFormat: "markdown" } },
    { id: human, type: "human", name: "편집자", config: { instruction: "편집 후 승인해주세요", allowEdit: true } },
    { id: out, type: "output", name: "HTML", config: { templateId: "default" } },
  ], [
    { id: nid("e"), sourceNodeId: inp, targetNodeId: ag },
    { id: nid("e"), sourceNodeId: ag, targetNodeId: human },
    { id: nid("e"), sourceNodeId: human, targetNodeId: out },
  ]);

  await page.goto(`/pipelines/${pipelineId}`);
  await expect(page.locator('[data-testid^="node-"]').first()).toBeVisible({ timeout: 15_000 });

  await page.locator('[data-testid="run-btn"]').click();

  // run이 waiting_human이 될 때까지 API 폴링
  await expect.poll(
    async () => {
      const r = await request.get(`/api/pipelines/${pipelineId}/runs`);
      const runs = await r.json() as Array<{ id: string }>;
      if (runs.length === 0) return "none";
      const s = await request.get(`/api/runs/${runs[0].id}`);
      const body = await s.json() as { run: { status: string } };
      return body.run.status;
    },
    { timeout: 30_000, intervals: [500] }
  ).toBe("waiting_human");

  // human nodeRunId 조회하여 API로 직접 승인 (편집 내용 포함)
  const runsRes = await request.get(`/api/pipelines/${pipelineId}/runs`);
  const runs = await runsRes.json() as Array<{ id: string }>;
  const stateRes = await request.get(`/api/runs/${runs[0].id}`);
  const stateBody = await stateRes.json() as { run: { status: string }; nodeRuns: Array<{ nodeId: string; id: string; status: string }> };
  const humanNr = stateBody.nodeRuns.find((nr) => nr.nodeId === human && nr.status === "waiting_human");
  expect(humanNr).toBeTruthy();

  // API로 편집 내용과 함께 승인
  const approveRes = await request.post(`/api/node-runs/${humanNr!.id}/approve`, {
    data: { editedContent: "# 편집된 이력서\n\n편집 완료." },
  });
  expect(approveRes.ok()).toBe(true);

  const state = await waitForRun(request, runs[0].id, { timeoutMs: 30_000 });
  expect(state.run.status).toBe("succeeded");
});
