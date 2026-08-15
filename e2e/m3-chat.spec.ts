import { test, expect } from "./support/fixtures";
import { putGraph, nid } from "./support/api";
import type { ChatMessage } from "../src/lib/types";

test("M3: 채팅 입력 '블록 만들어줘' → card_block → 트레이 표시", async ({
  pipelineId,
  page,
  request,
}) => {
  await page.goto(`/pipelines/${pipelineId}`);
  await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 30_000 });

  await page.locator('[data-testid="chat-input"]').fill("비평가 블록 만들어줘");
  await page.locator('[data-testid="chat-send"]').click();

  // card_block 카드가 **새로고침 없이** SSE로 도착해야 한다.
  // (구독 선행 + 버퍼 병합 — engine.md §3. 예전에는 로드~구독 사이 창에
  //  이벤트가 유실돼 page.reload()로 우회했다.)
  await expect(page.locator('[data-kind="card_block"]').first()).toBeVisible({ timeout: 30_000 });

  // 트레이 항목 확인 (block_def가 DB에 저장됨)
  await expect(page.locator('[data-testid^="tray-item-"]').first()).toBeVisible({ timeout: 10_000 });
});

test("M3: '문서 등록해줘' → 문서 반영", async ({
  pipelineId,
  page,
  request,
}) => {
  await page.goto(`/pipelines/${pipelineId}`);
  await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 30_000 });

  await page.locator('[data-testid="chat-input"]').fill("문서 등록해줘");
  await page.locator('[data-testid="chat-send"]').click();

  // assistant 응답이 DB에 저장될 때까지 API 폴링
  await expect.poll(
    async () => {
      const res = await request.get(`/api/pipelines/${pipelineId}/messages`);
      const msgs = (await res.json()) as ChatMessage[];
      return msgs.some((m) => m.kind === "assistant");
    },
    { timeout: 20_000, intervals: [500] },
  ).toBe(true);

  // 문서 탭에서 확인
  await page.goto("/documents");
  await expect(
    page.locator('[data-testid^="document-list-item-"]', {
      hasText: "챗봇 등록 JD",
    }),
  ).toBeVisible({ timeout: 10_000 });
});

test("M3: '작성해줘' → card_run 카드", async ({
  request,
  pipelineId,
  page,
}) => {
  const inp = nid("in"), ag = nid("ag"), out = nid("out");
  await putGraph(request, pipelineId, [
    { id: inp, type: "input", name: "JD", config: { inlineText: "# JD\n백엔드" } },
    { id: ag, type: "agent", name: "작성자", config: { role: "[E2E:writer] 이력서 작성", outputFormat: "markdown" } },
    { id: out, type: "output", name: "HTML", config: { templateId: "default" } },
  ], [
    { id: nid("e"), sourceNodeId: inp, targetNodeId: ag },
    { id: nid("e"), sourceNodeId: ag, targetNodeId: out },
  ]);

  await page.goto(`/pipelines/${pipelineId}`);
  await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 30_000 });

  await page.locator('[data-testid="chat-input"]').fill("작성해줘");
  await page.locator('[data-testid="chat-send"]').click();

  // card_run 카드가 **새로고침 없이** SSE로 도착해야 한다(구독 선행 — engine.md §3).
  // trigger_run은 runner.start → card_run을 emitChatCard로 pipeline 채널에 발행.
  await expect(page.locator('[data-kind="card_run"]').first()).toBeVisible({ timeout: 30_000 });
});

test("M3: 새로고침 스레드 복원", async ({
  pipelineId,
  page,
  request,
}) => {
  await page.goto(`/pipelines/${pipelineId}`);
  await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 30_000 });

  // 메시지 전송
  await page.locator('[data-testid="chat-input"]').fill("안녕");
  await page.locator('[data-testid="chat-send"]').click();

  // assistant 응답이 DB에 저장될 때까지 폴링
  await expect.poll(
    async () => {
      const res = await request.get(`/api/pipelines/${pipelineId}/messages`);
      const msgs = (await res.json()) as ChatMessage[];
      return msgs.some((m) => m.kind === "assistant");
    },
    { timeout: 20_000, intervals: [500] },
  ).toBe(true);

  // DB의 메시지 수 기록
  const beforeRes = await request.get(`/api/pipelines/${pipelineId}/messages`);
  const msgsBefore = (await beforeRes.json()) as ChatMessage[];
  const countBefore = msgsBefore.length;

  // 새로고침
  await page.reload();
  await expect(page.locator('[data-testid="chat-input"]')).toBeVisible({ timeout: 30_000 });

  // 이전 메시지 복원 확인 (REST /messages로 초기 로드됨)
  await expect.poll(
    async () => page.locator('[data-testid^="chat-msg-"]').count(),
    { timeout: 10_000, intervals: [300] }
  ).toBeGreaterThanOrEqual(countBefore);
});
