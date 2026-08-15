// M4 우클릭 만들기: 타입 폴더 우클릭 → 새 에이전트 → 이름 입력 → 정의 탭 열림 확인
import { test, expect } from "./support/fixtures";

test("M4: 타입 폴더 우클릭 → 새 에이전트 생성 → 인라인 이름 편집 → 정의 탭 열림", async ({
  pipelineId,
  page,
}) => {
  await page.goto(`/pipelines/${pipelineId}`);
  await expect(page.getByTestId("canvas-ready")).toBeVisible({ timeout: 30_000 });

  // 에이전트 타입 폴더 헤더 우클릭 (data-testid로 정확히 지정)
  const agentTypeHead = page.getByTestId("type-folder-agent");
  await expect(agentTypeHead).toBeVisible({ timeout: 10_000 });
  await agentTypeHead.click({ button: "right" });

  // "새 에이전트" 컨텍스트 메뉴 항목 클릭
  const newAgentBtn = page.getByTestId("ctx-new-type-agent");
  await expect(newAgentBtn).toBeVisible({ timeout: 5_000 });
  await newAgentBtn.click();

  // 인라인 이름 편집 input이 나타나야 함 (기본값 "새 에이전트")
  const renameInput = page.getByTestId("block-def-rename-input");
  await expect(renameInput).toBeVisible({ timeout: 5_000 });
  await expect(renameInput).toHaveValue("새 에이전트");

  // 이름 변경 후 Enter
  await renameInput.fill("테스트 에이전트");
  await renameInput.press("Enter");

  // 정의 탭이 열려야 함 — TabEditor 탭 목록에서 "테스트 에이전트" 탭 레이블이 보여야 함
  await expect(
    page.locator("button").filter({ hasText: "테스트 에이전트" }).first()
  ).toBeVisible({ timeout: 10_000 });
});
