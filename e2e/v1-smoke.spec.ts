// V1 — 인프라 검증: 서버 런처·격리 DB·스텁 활성·Playwright 연결.
import { test, expect } from "./support/fixtures";
import { putGraph, startRun, waitForRun, nid } from "./support/api";

test("V1: 홈 로드 → 파이프라인 리다이렉트", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/pipelines\//, { timeout: 20_000 });
});

test("V1: 스텁 파이프라인 실행(Input→Agent→Output)", async ({
  request,
  pipelineId,
}) => {
  const inp = nid("in");
  const ag = nid("ag");
  const out = nid("out");
  await putGraph(
    request,
    pipelineId,
    [
      { id: inp, type: "input", name: "JD", config: { inlineText: "# JD\n백엔드 시니어" } },
      {
        id: ag,
        type: "agent",
        name: "작성자",
        config: { role: "[E2E:writer] 이력서를 작성한다.", outputFormat: "markdown" },
      },
      { id: out, type: "output", name: "HTML", config: { templateId: "default" } },
    ],
    [
      { id: nid("e"), sourceNodeId: inp, targetNodeId: ag },
      { id: nid("e"), sourceNodeId: ag, targetNodeId: out },
    ],
  );

  const res = await startRun(request, pipelineId);
  expect(res.runId).toBeTruthy();
  const state = await waitForRun(request, res.runId!);
  expect(state.run.status).toBe("succeeded");
  // 스텁 활성 증명: writer 스텁의 고정 텍스트가 렌더된 HTML에 있어야 함(실 LLM 아님).
  const html = state.artifacts.find((a) => a.format === "html");
  expect(html?.content).toContain("E2E 이력서 초안");
});
