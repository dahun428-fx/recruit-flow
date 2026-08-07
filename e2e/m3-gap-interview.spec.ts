import { test, expect } from "./support/fixtures";
import { putGraph, startRun, waitForRun, nid } from "./support/api";

test("M3: [E2E:gap] 노드 → gap_question 카드 → 인라인 답변 → run 계속", async ({
  request,
  pipelineId,
  page,
}) => {
  const inp = nid("in"), ag = nid("ag"), out = nid("out");
  await putGraph(request, pipelineId, [
    { id: inp, type: "input", name: "JD", config: { inlineText: "# JD\n백엔드" } },
    { id: ag, type: "agent", name: "갭 에이전트", config: { role: "[E2E:gap] 갭 인터뷰", outputFormat: "markdown", gapMode: "ask" } },
    { id: out, type: "output", name: "HTML", config: { templateId: "default" } },
  ], [
    { id: nid("e"), sourceNodeId: inp, targetNodeId: ag },
    { id: nid("e"), sourceNodeId: ag, targetNodeId: out },
  ]);

  await page.goto(`/pipelines/${pipelineId}`);
  await expect(page.locator('[data-testid^="node-"]').first()).toBeVisible({ timeout: 15_000 });

  // run 시작
  await page.locator('[data-testid="run-btn"]').click();

  // run이 waiting_human(갭 인터뷰 중)이 될 때까지 API 폴링
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

  // nodeRun 조회하여 API로 답변 제출
  const runsRes = await request.get(`/api/pipelines/${pipelineId}/runs`);
  const runs = await runsRes.json() as Array<{ id: string }>;
  expect(runs.length).toBeGreaterThan(0);
  const stateRes = await request.get(`/api/runs/${runs[0].id}`);
  const stateBody = await stateRes.json() as { run: { status: string }; nodeRuns: Array<{ nodeId: string; id: string; status: string }> };
  const gapNr = stateBody.nodeRuns.find((nr) => nr.nodeId === ag && nr.status === "waiting_human");
  expect(gapNr).toBeTruthy();

  // API로 답변 제출
  const answerRes = await request.post(`/api/node-runs/${gapNr!.id}/answer`, {
    data: { answer: "백엔드 시니어 포지션" },
  });
  expect(answerRes.ok()).toBe(true);

  // run 완료까지 API 폴링
  const state = await waitForRun(request, runs[0].id, { timeoutMs: 60_000 });
  expect(state.run.status).toBe("succeeded");
});
