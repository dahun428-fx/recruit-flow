import { expect, test } from "@playwright/test";
import { marked } from "marked";
import { wrapDocument } from "../src/lib/html/template";

test("Output 제목 위계: h2가 h3보다 크게 렌더링된다", async ({ page }, testInfo) => {
  const markdown = [
    "# 홍길동 이력서",
    "",
    "## 경력",
    "",
    "### 결제 시스템 재설계",
    "",
    "p99 지연 시간을 1.2초에서 180ms로 줄였습니다.",
  ].join("\n");

  await page.setContent(wrapDocument(await marked.parse(markdown), "Output 제목 위계 검증"));

  const h2 = page.locator(".resume h2");
  const h3 = page.locator(".resume h3");
  await expect(h2).toHaveText("경력");
  await expect(h3).toHaveText("결제 시스템 재설계");

  const [h2Size, h3Size] = await Promise.all([
    h2.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
    h3.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ]);
  expect(h2Size, "h2 계산 폰트 크기").toBeGreaterThan(h3Size);

  await testInfo.attach("output-heading-hierarchy", {
    body: await page.locator(".resume").screenshot(),
    contentType: "image/png",
  });
});
