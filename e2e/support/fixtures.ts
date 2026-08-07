// e2e 픽스처 — 테스트마다 새 파이프라인을 만들어 격리.
import { test as base, expect } from "@playwright/test";
import { createPipeline } from "./api";

export const test = base.extend<{ pipelineId: string }>({
  pipelineId: async ({ request }, use, testInfo) => {
    const id = await createPipeline(request, `e2e-${testInfo.title.slice(0, 24)}`);
    await use(id);
  },
});

export { expect };
