// @live — 실 LLM 카나리아. 기본 스위트에서 제외(grepInvert: /@live/).
import { test, expect } from "../support/fixtures";
import { putGraph, startRun, waitForRun, nid } from "../support/api";

test("@live LLM: 챗봇 add_block 1건", async ({ page, pipelineId }) => {
  await page.goto(`/pipelines/${pipelineId}`);
  await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="chat-input"]').fill("비평가 블록을 만들어줘");
  await page.locator('[data-testid="chat-send"]').click();
  await expect(page.locator('[data-kind="card_block"]').first()).toBeVisible({ timeout: 60_000 });
});

test("@live LLM: canonical run 1건", async ({ request, pipelineId }) => {
  const inp = nid("in"), ag = nid("ag"), out = nid("out");
  await putGraph(request, pipelineId, [
    { id: inp, type: "input", name: "JD", config: { inlineText: "# JD\n백엔드 시니어\n- 대규모 트랜잭션 처리\n- 팀 리드 경험" } },
    { id: ag, type: "agent", name: "작성자", config: { role: "JD에 비추어 이력서 초안을 작성한다. 경력·성과를 구체적 수치로 표현.", outputFormat: "markdown" } },
    { id: out, type: "output", name: "HTML", config: { templateId: "default" } },
  ], [
    { id: nid("e"), sourceNodeId: inp, targetNodeId: ag },
    { id: nid("e"), sourceNodeId: ag, targetNodeId: out },
  ]);

  const res = await startRun(request, pipelineId);
  expect(res.runId).toBeTruthy();
  const state = await waitForRun(request, res.runId!, { timeoutMs: 120_000 });
  expect(state.run.status).toBe("succeeded");
  const html = state.artifacts.find((a) => a.format === "html");
  expect(html?.content).toBeTruthy();
});

test("@live LLM: '엣지 삭제해줘' → 거절", async ({ page, pipelineId }) => {
  await page.goto(`/pipelines/${pipelineId}`);
  await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid="chat-input"]').fill("엣지 삭제해줘");
  await page.locator('[data-testid="chat-send"]').click();
  // 거절 메시지 대기
  await expect(page.locator('[data-kind="assistant"]').first()).toBeVisible({ timeout: 60_000 });
  const text = await page.locator('[data-kind="assistant"]').first().textContent();
  expect(text).toMatch(/할 수 없|조립.*캔버스|직접/);
});
