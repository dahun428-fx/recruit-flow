// Phase 2a 격리 회귀 게이트(auth.md §8) — 두 유저(usr_a/usr_b)가 x-rf-user 헤더로
// 요청 유저를 전환하며 앱 레벨·SSE 격리를 검증한다. app_users usr_a/usr_b는 seed.mjs가 삽입.
// (저수준 RLS는 scripts/rls-verify.mts가 별도로 실증한다.)
import { test, expect, request as pwRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { createDocument, createPipeline } from "./support/api";

const PORT = process.env.E2E_PORT ?? "3200";
const BASE = `http://localhost:${PORT}`;

function ctx(user: string): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL: BASE,
    extraHTTPHeaders: { "x-rf-user": user },
  });
}

test.describe("Phase 2a: 멀티유저 격리", () => {
  test("앱 레벨 — A의 파이프라인·문서를 B가 보거나 쓰지 못한다", async () => {
    const a = await ctx("usr_a");
    const b = await ctx("usr_b");
    try {
      const pA = await createPipeline(a, "A의 파이프라인");
      const dA = await createDocument(a, "A의 문서", "# A v1");

      // 목록 은닉
      const bPipes = (await (await b.get("/api/pipelines")).json()) as { id: string }[];
      expect(bPipes.find((p) => p.id === pA)).toBeUndefined();
      const bDocs = (await (await b.get("/api/documents")).json()) as { id: string }[];
      expect(bDocs.find((d) => d.id === dA)).toBeUndefined();

      // 직접 접근 404
      expect((await b.get(`/api/pipelines/${pA}`)).status()).toBe(404);
      expect((await b.get(`/api/documents/${dA}`)).status()).toBe(404);

      // 쓰기 누수 차단 — B의 PUT은 404이고 A 문서 버전은 그대로
      expect(
        (await b.put(`/api/documents/${dA}`, { data: { content: "HACKED by B" } })).status(),
      ).toBe(404);
      const aDoc = (await (await a.get(`/api/documents/${dA}`)).json()) as {
        currentVersion: number;
      };
      expect(aDoc.currentVersion).toBe(1);

      // 소유자 A는 정상 접근
      expect((await a.get(`/api/pipelines/${pA}`)).status()).toBe(200);
      expect((await a.get(`/api/documents/${dA}`)).status()).toBe(200);
    } finally {
      await a.dispose();
      await b.dispose();
    }
  });

  test("SSE — A의 block_def 생성 이벤트가 B 구독으로 새지 않는다", async () => {
    const a = await ctx("usr_a");
    const b = await ctx("usr_b");
    // 각 유저가 자기 파이프라인 채널을 구독(SSE 구독은 파이프라인 소유 검증을 지난다).
    const pA = await createPipeline(a, "A SSE 파이프라인");
    const pB = await createPipeline(b, "B SSE 파이프라인");
    const A = await openSse(`${BASE}/api/pipelines/${pA}/events`, "usr_a");
    const B = await openSse(`${BASE}/api/pipelines/${pB}/events`, "usr_b");
    try {
      // ": connected" 수신 = start()가 subscribePipeline까지 실행됨(구독 활성 보장).
      await A.ready;
      await B.ready;

      // A가 block_def 생성 → emitBlockDef(usr_a) → owner=A 구독자에게만.
      const res = await a.post("/api/block-defs", {
        data: { type: "skill", name: "격리테스트스킬", config: { content: "x" }, origin: "human" },
      });
      expect(res.ok()).toBeTruthy();

      // A는 block_def 이벤트를 받는다(최대 5s 폴링 — 로컬 emit이라 보통 즉시).
      await expect
        .poll(() => A.frames.some((f) => /event:\s*block_def/.test(f)), {
          timeout: 5000,
          intervals: [100, 100, 200, 300],
        })
        .toBe(true);

      // B는 못 받는다 — A가 받은 뒤 추가 여유를 두고도 부재.
      await new Promise((r) => setTimeout(r, 700));
      expect(B.frames.some((f) => /event:\s*block_def/.test(f))).toBe(false);
    } finally {
      A.close();
      B.close();
      await a.dispose();
      await b.dispose();
    }
  });
});

interface SseHandle {
  frames: string[];
  ready: Promise<void>;
  close: () => void;
}

/** Node fetch로 SSE 스트림을 연다. ready는 첫 청크(": connected") 수신 시 resolve. */
async function openSse(url: string, user: string): Promise<SseHandle> {
  const ac = new AbortController();
  const frames: string[] = [];
  let markReady!: () => void;
  const ready = new Promise<void>((r) => {
    markReady = r;
  });
  const res = await fetch(url, {
    headers: { "x-rf-user": user, accept: "text/event-stream" },
    signal: ac.signal,
  });
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  void (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        markReady();
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          frames.push(buf.slice(0, idx));
          buf = buf.slice(idx + 2);
        }
      }
    } catch {
      // abort = 스트림 종료(정상).
    }
  })();
  return { frames, ready, close: () => ac.abort() };
}
