// M4 회귀: 탐색기 → 캔버스 실제 드래그-드롭.
// 이 경로는 그간 더블클릭·API로만 검증되어 실드래그 커버리지가 없었다
// (사용자 보고: "드래그하면 캔버스에 옮겨지지 않는다" — 재현/회귀 고정용).
import { test, expect } from "./support/fixtures";

test("M4: 탐색기 저장 정의 드래그 → 캔버스에 참조 노드 생성", async ({
  pipelineId,
  page,
}) => {
  await page.goto(`/pipelines/${pipelineId}`);
  await expect(page.getByTestId("canvas-ready")).toBeVisible({ timeout: 30_000 });

  // 시드된 "E2E 작성자"(agent 정의) 항목
  const defItem = page.locator('[data-testid^="palette-item-def-"]').first();
  await expect(defItem).toBeVisible({ timeout: 30_000 });

  // 캔버스 페인으로 실제 HTML5 드래그
  const pane = page.locator(".react-flow__pane");
  await expect(pane).toBeVisible();
  await defItem.dragTo(pane, { targetPosition: { x: 300, y: 200 } });

  // 참조 노드가 정의 이름으로 나타나야 한다
  const node = page.locator('[data-testid^="node-"]').first();
  await expect(node).toBeVisible({ timeout: 10_000 });
  await expect(node).toContainText("E2E 작성자");
});

test("M4: 탐색기 빈 블록 드래그 → 캔버스에 맨손 노드 생성", async ({
  pipelineId,
  page,
}) => {
  await page.goto(`/pipelines/${pipelineId}`);
  await expect(page.getByTestId("canvas-ready")).toBeVisible({ timeout: 30_000 });

  const emptyAgent = page.getByTestId("palette-item-empty-agent");
  await expect(emptyAgent).toBeVisible({ timeout: 30_000 });

  const pane = page.locator(".react-flow__pane");
  await emptyAgent.dragTo(pane, { targetPosition: { x: 320, y: 240 } });

  await expect(page.locator('[data-testid^="node-"]').first()).toBeVisible({
    timeout: 10_000,
  });
});
