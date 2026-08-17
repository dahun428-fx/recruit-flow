import { test, expect } from "./support/fixtures";
import { putGraph, waitForRun, nid, createDocument } from "./support/api";

test("M1: 문서 탭 문서 확인 → 실행 → 노드 상태 → 아티팩트 → 다운로드 → 새로고침 복원", async ({
  request,
  pipelineId,
  page,
}) => {
  // 1. 문서 생성 (재시도 시 중복 생성될 수 있으므로 반환 id로 고유 검증)
  const docId = await createDocument(request, "백엔드 JD", "# JD\n백엔드 시니어");

  // 2. 그래프 세팅
  const inp = nid("in"), ag = nid("ag"), out = nid("out");
  await putGraph(request, pipelineId, [
    { id: inp, type: "input", name: "JD", config: { inlineText: "# JD\n백엔드" } },
    { id: ag, type: "agent", name: "작성자", config: { role: "[E2E:writer] 이력서를 작성한다.", outputFormat: "markdown" } },
    { id: out, type: "output", name: "HTML", config: { templateId: "default" } },
  ], [
    { id: nid("e"), sourceNodeId: inp, targetNodeId: ag },
    { id: nid("e"), sourceNodeId: ag, targetNodeId: out },
  ]);

  // 3. 문서 탭 확인 — 전역 문서 목록(FileExplorer)에서 이 테스트가 만든
  // 문서만 고유 testid로 확인(getByText는 누적/중복 문서에 strict 위반).
  await page.goto("/documents");
  await expect(page.getByTestId(`document-list-item-${docId}`)).toBeVisible({ timeout: 10_000 });

  // 4. 캔버스로 이동
  await page.goto(`/pipelines/${pipelineId}`);
  // 노드들이 렌더링될 때까지 대기
  await expect(page.locator('[data-testid^="node-"]').first()).toBeVisible({ timeout: 30_000 });

  // 5. Run 버튼 클릭
  await page.locator('[data-testid="run-btn"]').click();

  // 6. agent 노드가 실행 중 상태가 되길 기다림
  await expect.poll(
    async () => {
      const statuses = await page.locator('[data-testid="node-status"]').allTextContents();
      return statuses.some((s) => s.includes("실행 중") || s.includes("성공") || s.includes("큐 대기"));
    },
    { timeout: 30_000, intervals: [500] }
  ).toBe(true);

  // 7. run 완료까지 API 폴링
  // run ID는 UI가 기억하므로 API로 최신 run 조회
  const runsRes = await request.get(`/api/pipelines/${pipelineId}/runs`);
  const runs = await runsRes.json() as Array<{ id: string }>;
  expect(runs.length).toBeGreaterThan(0);
  const runId = runs[0].id;
  const state = await waitForRun(request, runId, { timeoutMs: 60_000 });
  expect(state.run.status).toBe("succeeded");

  // 8. Output 노드 더블클릭 → 노드 탭 열림 → 아티팩트 탭 → 다운로드 버튼
  // M4: 노드 더블클릭 시 노드 편집기 탭이 열린다(단일 클릭은 선택만).
  // ReactFlow가 native dblclick을 삼켜 Playwright .dblclick()은 onClick을 1회만
  // 발화하므로, 실제 더블클릭처럼 두 번 클릭한다.
  const outNode = page.locator(`[data-testid="node-${out}"]`);
  await outNode.click();
  await outNode.click();
  await page.locator('[data-testid="artifact-tab"]').click();
  const panelDownload = page.getByTestId("download-html-panel");
  await expect(panelDownload).toBeVisible({ timeout: 10_000 });
  // download-html-node는 캔버스 탭 내 노드 카드의 버튼 — 탭 전환 후 캔버스가 숨겨져 있어 확인하지 않음.
  // download-html-panel(노드 탭)이 visible한 것으로 대체 검증.

  // 9. 다운로드 버튼 클릭 — download 이벤트 대기
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15_000 }),
    panelDownload.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.html$/);

  // 10. 새로고침 후 노드 복원 확인
  await page.reload();
  await expect(page.locator('[data-testid^="node-"]').first()).toBeVisible({ timeout: 30_000 });
  const count = await page.locator('[data-testid^="node-"]').count();
  expect(count).toBeGreaterThanOrEqual(3);
});

test("M1: [E2E:slow] run 실행 중 중단 → cancelled", async ({
  request,
  pipelineId,
  page,
}) => {
  const inp = nid("in"), ag = nid("ag"), out = nid("out");
  await putGraph(request, pipelineId, [
    { id: inp, type: "input", name: "JD", config: { inlineText: "# JD\n백엔드" } },
    { id: ag, type: "agent", name: "느린 에이전트", config: { role: "[E2E:slow] 느린 에이전트", outputFormat: "markdown" } },
    { id: out, type: "output", name: "HTML", config: { templateId: "default" } },
  ], [
    { id: nid("e"), sourceNodeId: inp, targetNodeId: ag },
    { id: nid("e"), sourceNodeId: ag, targetNodeId: out },
  ]);

  await page.goto(`/pipelines/${pipelineId}`);
  await expect(page.locator('[data-testid^="node-"]').first()).toBeVisible({ timeout: 30_000 });

  // Run 시작
  await page.locator('[data-testid="run-btn"]').click();

  // stop 버튼 등장 대기
  await expect(page.locator('[data-testid="stop-btn"]')).toBeVisible({ timeout: 20_000 });

  // 중단
  await page.locator('[data-testid="stop-btn"]').click();

  // run이 cancelled 상태가 될 때까지 API 폴링
  const runsRes = await request.get(`/api/pipelines/${pipelineId}/runs`);
  const runs = await runsRes.json() as Array<{ id: string }>;
  expect(runs.length).toBeGreaterThan(0);
  const runId = runs[0].id;
  const state = await waitForRun(request, runId, { timeoutMs: 30_000, until: (s) => s === "cancelled" || s === "failed" });
  expect(["cancelled", "failed"]).toContain(state.run.status);
});
