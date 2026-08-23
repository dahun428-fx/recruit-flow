// R3 실증(일회성) — 정본 표준 파이프라인을 실 LLM으로 완주해 M2 최종 관문
// (Gate pass → 내 검토 승인 → 완성본 HTML)을 검증한다. 감사 R3(2026-08-23).
// dev 서버 없이 러너를 직접 구동(단일 프로세스 — Next dev 백그라운드 조기종료 회피).
//
// 실행:
//   DATABASE_URL=postgres://rf_app:rf_app@localhost:5433/recruit_flow_r3 \
//   RF_ADMIN_DATABASE_URL=postgres://postgres:postgres@localhost:5433/recruit_flow_r3 \
//   npx tsx scripts/r3-live-gate.mts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runWithUser, DEV_OWNER_ID } from "../src/lib/auth/context";
import { runner } from "../src/lib/engine/runner";
import {
  addDocumentVersion,
  getRunState,
  listDocuments,
  listPipelines,
} from "../src/lib/db/queries";
import { sql, adminSql } from "../src/lib/db/client";

const TERMINAL = new Set(["succeeded", "failed", "gate_failed", "cancelled"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const t0 = Date.now();
  const mins = () => ((Date.now() - t0) / 60000).toFixed(1);

  const exitCode = await runWithUser(DEV_OWNER_ID, async () => {
    // R3_JD_FILE이 있으면 실 JD를 "현재 JD" 새 버전으로 주입(nodes.md §3 JD 교체
    // 루프 규약 그대로 — 재배선 없이 다음 run이 이 버전을 읽는다).
    const jdFile = process.env.R3_JD_FILE;
    if (jdFile) {
      const jd = readFileSync(jdFile, "utf8");
      const cur = (await listDocuments()).find((d) => d.name === "현재 JD");
      if (!cur) throw new Error('"현재 JD" 문서 없음');
      const updated = await addDocumentVersion(cur.id, jd, "human", "R3 실증용 실 JD 주입");
      console.log(`실 JD 주입: ${jdFile} → 현재 JD v${updated?.currentVersion} (${jd.length}b)`);
    }

    const pl = (await listPipelines())[0];
    if (!pl) throw new Error("파이프라인 없음");
    console.log(`파이프라인: ${pl.name} (${pl.id})`);

    const res = await runner.start(pl.id);
    if ("errors" in res) throw new Error("검증 실패: " + JSON.stringify(res.errors));
    const runId = res.runId;
    console.log(`run 시작: ${runId} (실 LLM)`);

    let lastSig = "";
    const approvedNodeRuns = new Set<string>();
    for (;;) {
      const capMin = Number(process.env.R3_TIMEOUT_MIN ?? 40);
      if (Date.now() - t0 > capMin * 60 * 1000) {
        console.log(`타임아웃(${capMin}m) — 중단`);
        return 2;
      }
      const st = await getRunState(runId);
      if (!st) throw new Error("run 상태 조회 실패");
      const sig =
        st.run.status +
        "|" +
        st.nodeRuns.map((n) => `${n.nodeId}#${n.iteration}:${n.status}`).join(",");
      if (sig !== lastSig) {
        lastSig = sig;
        console.log(
          `[${mins()}m] ${st.run.status} :: ` +
            st.nodeRuns
              .map((n) => `${n.nodeId.replace(/^n_/, "")}#${n.iteration}=${n.status}`)
              .join(" "),
        );
      }

      if (st.run.status === "waiting_human") {
        const wait = st.nodeRuns.find(
          (n) => n.status === "waiting_human" && !approvedNodeRuns.has(n.id),
        );
        if (wait) {
          approvedNodeRuns.add(wait.id);
          console.log(`>>> 내 검토 대기(${wait.id}) — 무편집 승인`);
          const ap = await runner.approve(wait.id);
          console.log(">>> approve:", JSON.stringify(ap));
        }
      }

      if (TERMINAL.has(st.run.status)) {
        console.log(`\n=== 종단: ${st.run.status} (${mins()}m) ===`);
        for (const n of st.nodeRuns) {
          console.log(
            `  ${n.nodeId}#${n.iteration}: ${n.status}` +
              (n.gateDecision ? ` gate=${n.gateDecision}` : "") +
              (n.error ? ` err=${n.error.slice(0, 100)}` : ""),
          );
        }
        // 증거 보존: 채점 JSON + 최종 HTML을 tmp/r3-live/에 덤프.
        const outDir = path.join(process.cwd(), "tmp", "r3-live");
        mkdirSync(outDir, { recursive: true });
        for (const a of st.artifacts) {
          const nr = st.nodeRuns.find((n) => n.id === a.nodeRunId);
          const label = `${nr?.nodeId ?? a.nodeRunId}#${nr?.iteration ?? "?"}`;
          console.log(`  artifact ${a.format} ${String(a.content ?? "").length}b ← ${label}`);
          if (a.format === "json") {
            console.log(
              "    " + String(a.content ?? "").replace(/\s+/g, " ").slice(0, 220),
            );
          }
          const ext = a.format === "html" ? "html" : a.format === "json" ? "json" : "md";
          writeFileSync(
            path.join(outDir, `${label.replace(/[^\w#-]/g, "_")}.${ext}`),
            String(a.content ?? ""),
            "utf8",
          );
        }
        const html = st.artifacts.find((a) => a.format === "html");
        console.log(
          `\n판정: ${
            st.run.status === "succeeded" && html
              ? "✅ Gate pass → 승인 → 완성본 HTML (" + String(html.content ?? "").length + "b)"
              : "❌ 최종 관문 미달 — status=" + st.run.status
          }`,
        );
        return st.run.status === "succeeded" && html ? 0 : 1;
      }
      await sleep(5000);
    }
  });

  await sql.end({ timeout: 5 }).catch(() => {});
  await adminSql.end({ timeout: 5 }).catch(() => {});
  process.exit(exitCode);
}

main().catch(async (e) => {
  console.error("실증 크래시:", e);
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(3);
});
