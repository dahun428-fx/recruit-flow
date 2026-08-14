import { expect, test } from "./support/fixtures";
import { nid, putGraph, waitForRun } from "./support/api";
import { mergeTextDelta } from "../src/lib/stream-reconcile";

test("SSE snapshot 경계의 artifact delta를 offset으로 멱등 병합한다", () => {
  expect(mergeTextDelta("완료", 0, "완료")).toEqual({
    content: "완료",
    hasGap: false,
  });
  expect(mergeTextDelta("완", 0, "완료")).toEqual({
    content: "완료",
    hasGap: false,
  });
  expect(mergeTextDelta("완료", 2, " 후속")).toEqual({
    content: "완료 후속",
    hasGap: false,
  });
  expect(mergeTextDelta("완", 2, "료")).toEqual({
    content: "완",
    hasGap: true,
  });
  expect(mergeTextDelta("다름", 0, "완료")).toEqual({
    content: "다름",
    hasGap: true,
  });
});

test("run SSE 강제 단절 중 완료된 실행을 재연결 스냅샷으로 복원한다", async ({
  request,
  pipelineId,
  page,
}) => {
  const input = nid("in");
  const agent = nid("ag");
  const human = nid("hu");
  const output = nid("out");

  await putGraph(request, pipelineId, [
    {
      id: input,
      type: "input",
      name: "JD",
      config: { inlineText: "# JD\nSSE 복원 검증" },
    },
    {
      id: agent,
      type: "agent",
      name: "작성자",
      config: {
        role: "[E2E:writer] 짧은 이력서를 작성한다.",
        outputFormat: "markdown",
      },
    },
    {
      id: human,
      type: "human",
      name: "검토자",
      config: { instruction: "검토해주세요", allowEdit: false },
    },
    {
      id: output,
      type: "output",
      name: "HTML",
      config: { templateId: "default" },
    },
  ], [
    { id: nid("e"), sourceNodeId: input, targetNodeId: agent },
    { id: nid("e"), sourceNodeId: agent, targetNodeId: human },
    { id: nid("e"), sourceNodeId: human, targetNodeId: output },
  ]);

  await page.goto(`/pipelines/${pipelineId}`);
  await expect(page.locator('[data-testid^="node-"]').first()).toBeVisible();
  await page.locator('[data-testid="run-btn"]').click();

  const humanNode = page.locator(`[data-testid="node-${human}"]`);
  await expect(humanNode.locator('[data-testid="node-status"]')).toHaveText(
    "● 사람 대기 중",
    { timeout: 30_000 },
  );

  const runs = await (
    await request.get(`/api/pipelines/${pipelineId}/runs`)
  ).json() as Array<{ id: string }>;
  const runId = runs[0].id;
  const state = await (await request.get(`/api/runs/${runId}`)).json() as {
    nodeRuns: Array<{ id: string; nodeId: string; status: string }>;
  };
  const humanRun = state.nodeRuns.find(
    (nodeRun) => nodeRun.nodeId === human && nodeRun.status === "waiting_human",
  );
  expect(humanRun).toBeTruthy();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });

  try {
    await expect(
      (await request.post(`/api/node-runs/${humanRun!.id}/approve`, { data: {} })).ok(),
    ).toBe(true);
    await waitForRun(request, runId, { timeoutMs: 30_000 });

    // 오류 직후 REST도 실패하는 분기를 지나도록 첫 재시도보다 오래 끊는다.
    await page.waitForTimeout(2_500);
  } finally {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  }

  await expect(
    page.locator(`[data-testid="node-${output}"] [data-testid="node-status"]`),
  ).toHaveText("● 성공", { timeout: 15_000 });
});
