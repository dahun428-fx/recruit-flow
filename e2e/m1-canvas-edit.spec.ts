import { test, expect } from "./support/fixtures";
import { putGraph, nid } from "./support/api";

test("M1: 팔레트 더블클릭 노드 추가 → 저장 → 새로고침 유지", async ({
  pipelineId,
  page,
}) => {
  // 빈 파이프라인으로 이동
  await page.goto(`/pipelines/${pipelineId}`);
  // 팔레트가 로드될 때까지 대기
  await expect(page.locator('[data-testid="palette-item-empty-agent"]')).toBeVisible({ timeout: 15_000 });

  // 더블클릭으로 Agent 추가
  await page.locator('[data-testid="palette-item-empty-agent"]').dblclick();

  // 노드가 생겼는지 확인
  await expect(page.locator('[data-testid^="node-"]').first()).toBeVisible({ timeout: 10_000 });
  const countBefore = await page.locator('[data-testid^="node-"]').count();
  expect(countBefore).toBeGreaterThanOrEqual(1);

  // debounce 저장 대기 (800ms)
  await page.waitForTimeout(1200);

  // 새로고침
  await page.reload();

  // 노드가 여전히 있는지 확인
  await expect(page.locator('[data-testid^="node-"]').first()).toBeVisible({ timeout: 15_000 });
  const countAfter = await page.locator('[data-testid^="node-"]').count();
  expect(countAfter).toBeGreaterThanOrEqual(1);
});

test("M1: API putGraph 노드 렌더 확인", async ({
  request,
  pipelineId,
  page,
}) => {
  const inp = nid("in"), ag = nid("ag"), out = nid("out");
  await putGraph(request, pipelineId, [
    { id: inp, type: "input", name: "JD", config: { inlineText: "# JD" } },
    { id: ag, type: "agent", name: "작성자", config: { role: "테스트", outputFormat: "markdown" } },
    { id: out, type: "output", name: "HTML", config: { templateId: "default" } },
  ], [
    { id: nid("e"), sourceNodeId: inp, targetNodeId: ag },
    { id: nid("e"), sourceNodeId: ag, targetNodeId: out },
  ]);

  await page.goto(`/pipelines/${pipelineId}`);
  // 3개 노드가 모두 렌더링되는지 확인
  await expect.poll(
    async () => page.locator('[data-testid^="node-"]').count(),
    { timeout: 15_000, intervals: [300] }
  ).toBeGreaterThanOrEqual(3);
});
