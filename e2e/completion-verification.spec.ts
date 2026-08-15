import { test, expect } from "./support/fixtures";
import { createPipeline, nid, putGraph } from "./support/api";

type GraphNodePayload = {
  id: string;
  pipelineId: string;
  type: string;
  name: string;
  positionX: number;
  positionY: number;
  config: Record<string, unknown>;
};

function graphNode(pipelineId: string): GraphNodePayload {
  return {
    id: nid("node"),
    pipelineId,
    type: "input",
    name: "검증 입력",
    positionX: 80,
    positionY: 80,
    config: { inlineText: "검증 본문" },
  };
}

test.describe("B1: graph PUT 구조 검증", () => {
  const invalidCases: Array<{
    title: string;
    mutate: (node: GraphNodePayload) => { nodes: unknown[]; edges: unknown[] };
    errorPath: RegExp;
  }> = [
    {
      title: "positionX 누락",
      mutate: (node) => {
        const { positionX: _omitted, ...missingPositionX } = node;
        return { nodes: [missingPositionX], edges: [] };
      },
      errorPath: /nodes\[0\]\.positionX/,
    },
    {
      title: "config 누락",
      mutate: (node) => {
        const { config: _omitted, ...missingConfig } = node;
        return { nodes: [missingConfig], edges: [] };
      },
      errorPath: /nodes\[0\]\.config/,
    },
    {
      title: "name 누락",
      mutate: (node) => {
        const { name: _omitted, ...missingName } = node;
        return { nodes: [missingName], edges: [] };
      },
      errorPath: /nodes\[0\]\.name/,
    },
    {
      title: "중복 node id",
      mutate: (node) => ({
        nodes: [node, { ...node, name: "중복 입력", positionX: 280 }],
        edges: [],
      }),
      errorPath: /중복된 노드 id/,
    },
    {
      title: "dangling edge",
      mutate: (node) => ({
        nodes: [node],
        edges: [
          {
            id: nid("edge"),
            pipelineId: node.pipelineId,
            sourceNodeId: node.id,
            targetNodeId: nid("missing"),
            kind: "flow",
            sourceHandle: null,
            inputOrder: 0,
          },
        ],
      }),
      errorPath: /존재하지 않는 노드/,
    },
  ];

  for (const invalidCase of invalidCases) {
    test(`${invalidCase.title}은 400이며 기존 그래프를 바꾸지 않는다`, async ({
      request,
      pipelineId,
    }) => {
      const payload = invalidCase.mutate(graphNode(pipelineId));
      const response = await request.put(`/api/pipelines/${pipelineId}/graph`, {
        data: payload,
      });

      expect(response.status()).toBe(400);
      const body = (await response.json()) as { error?: string; errors?: string[] };
      expect(body.error).toMatch(invalidCase.errorPath);
      expect(body.errors).toEqual(expect.arrayContaining([expect.stringMatching(invalidCase.errorPath)]));

      const persisted = await request.get(`/api/pipelines/${pipelineId}/graph`);
      expect(persisted.ok()).toBe(true);
      await expect(persisted.json()).resolves.toEqual({ nodes: [], edges: [] });
    });
  }

  test("정상 payload는 200으로 저장된다", async ({ request, pipelineId }) => {
    const node = graphNode(pipelineId);
    const response = await request.put(`/api/pipelines/${pipelineId}/graph`, {
      data: { nodes: [node], edges: [] },
    });

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });

    const persisted = await request.get(`/api/pipelines/${pipelineId}/graph`);
    expect(persisted.ok()).toBe(true);
    const graph = (await persisted.json()) as { nodes: GraphNodePayload[]; edges: unknown[] };
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]).toMatchObject(node);
    expect(graph.edges).toEqual([]);
  });
});

test("B2: artifact 없는 Human 대기를 사이드 패널 버튼으로 승인한다", async ({
  request,
  pipelineId,
  page,
}) => {
  const input = nid("input");
  const human = nid("human");
  const output = nid("output");
  await putGraph(
    request,
    pipelineId,
    [
      { id: input, type: "input", name: "원문", config: { inlineText: "# 검토할 문서" } },
      {
        id: human,
        type: "human",
        name: "무산출물 검토자",
        config: { instruction: "아티팩트가 없어도 승인하세요", allowEdit: false },
      },
      { id: output, type: "output", name: "완료물", config: { templateId: "default" } },
    ],
    [
      { id: nid("edge"), sourceNodeId: input, targetNodeId: human },
      { id: nid("edge"), sourceNodeId: human, targetNodeId: output },
    ],
  );

  await page.goto(`/pipelines/${pipelineId}`);
  const humanNode = page.locator(`[data-testid="node-${human}"]`);
  await expect(humanNode).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("run-btn").click();
  await expect(humanNode.getByTestId("node-status")).toHaveText("● 사람 대기 중", {
    timeout: 30_000,
  });

  // 채팅의 Human 대기 카드가 제공하는 실제 진입점으로 사이드 패널을 연다.
  await page.getByRole("button", { name: "사이드 패널에서 열기", exact: true }).click();
  await page.getByTestId("artifact-tab").click();
  await expect(page.getByText("이 노드의 아티팩트를 기다리는 중…", { exact: true })).toBeVisible();
  const approve = page.getByTestId("human-approve");
  await expect(approve).toBeVisible();
  await expect(approve).toBeEnabled();
  await approve.click();

  // M4: 승인 후 노드 탭이 활성 상태 — 캔버스 탭으로 복귀해야 노드 DOM이 렌더링됨.
  await page.getByRole("button", { name: "캔버스", exact: true }).click();

  await expect(page.locator(`[data-testid="node-${output}"]`).getByTestId("node-status"))
    .toHaveText("● 성공", { timeout: 30_000 });
});

test("B3: 한 탭의 트레이 승인·거절이 다른 탭에 새로고침 없이 반영된다", async ({
  request,
  pipelineId,
  page,
  context,
}) => {
  async function createTrayBlock(name: string): Promise<string> {
    const response = await request.post("/api/block-defs", {
      data: {
        type: "agent",
        name,
        description: "크로스탭 브로드캐스트 검증",
        config: { role: "검증 에이전트", outputFormat: "markdown" },
        origin: "chatbot",
        enabled: true,
        tray: true,
      },
    });
    expect(response.status()).toBe(201);
    return ((await response.json()) as { id: string }).id;
  }

  const approvedId = await createTrayBlock(`승인-${nid("broadcast")}`);
  const rejectedId = await createTrayBlock(`거절-${nid("broadcast")}`);
  const peerPipelineId = await createPipeline(request, "e2e-block-def-peer");
  const peer = await context.newPage();

  await Promise.all([
    page.goto(`/pipelines/${pipelineId}`),
    peer.goto(`/pipelines/${peerPipelineId}`),
  ]);

  for (const tab of [page, peer]) {
    await expect(tab.getByTestId(`tray-item-${approvedId}`)).toBeVisible({ timeout: 30_000 });
    await expect(tab.getByTestId(`tray-item-${rejectedId}`)).toBeVisible();
    await expect(tab.getByTestId(`palette-item-def-${approvedId}`)).toHaveCount(0);
  }

  await page.getByTestId(`tray-item-${approvedId}`).dblclick();
  await expect(peer.getByTestId(`tray-item-${approvedId}`)).toHaveCount(0, { timeout: 15_000 });
  await expect(peer.getByTestId(`palette-item-def-${approvedId}`)).toBeVisible();

  await page.getByTestId(`tray-reject-${rejectedId}`).click();
  await expect(page.getByText(/거절.*블록을 거절\(폐기\)할까요/)).toBeVisible();
  await page.getByRole("button", { name: "확인", exact: true }).click();
  await expect(peer.getByTestId(`tray-item-${rejectedId}`)).toHaveCount(0, { timeout: 15_000 });
  await expect(peer.getByTestId(`palette-item-def-${rejectedId}`)).toHaveCount(0);

  const allResponse = await request.get("/api/block-defs?all=1");
  expect(allResponse.ok()).toBe(true);
  const allDefs = (await allResponse.json()) as Array<{ id: string; tray: boolean }>;
  expect(allDefs.find((def) => def.id === approvedId)?.tray).toBe(false);
  expect(allDefs.some((def) => def.id === rejectedId)).toBe(false);
});
