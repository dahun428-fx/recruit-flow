/**
 * scripts/seed-canonical.mts — DEV_OWNER_ID 소유 데이터를 비우고 정본 재시드(auth.md §7).
 *
 * 사용법:
 *   npm run seed:canonical          # 삭제 대상 미리보기 (dry-run)
 *   npm run seed:canonical -- --yes # 비우기 + 재시드 실행
 *
 * 환경변수:
 *   DATABASE_URL           앱(rf_app) 커넥션 URL.
 *                          기본: postgres://rf_app:rf_app@localhost:5433/recruit_flow
 *   RF_ADMIN_DATABASE_URL  슈퍼유저 커넥션 URL (provisionSeedForUser 내부 필요 시).
 *                          기본: postgres://postgres:postgres@localhost:5433/recruit_flow
 *
 * 비우기 범위 (DEV_OWNER_ID 소유만):
 *   - pipelines → nodes, edges, runs, chat_messages (FK ON DELETE CASCADE)
 *   - documents → document_versions (FK ON DELETE CASCADE)
 *   - block_defs (owner_id 직접 필터)
 *
 *   FK cascade 덕분에 pipelines·documents만 삭제해도 자식들이 함께 지워진다.
 *   runs/node_runs/artifacts도 pipelines cascade 경로로 자동 정리됨.
 *   삭제 순서: pipelines → documents → block_defs (FK 의존 없으므로 순서 무관하나 명시적으로).
 *
 * 안전장치:
 *   - DEV_OWNER_ID 소유 행만 삭제 — 다른 owner 행은 절대 건드리지 않음.
 *   - --yes 없으면 대상 개수·이름만 출력하고 중단.
 *   - RLS + runWithUser(DEV_OWNER_ID) 경로 사용 → 소유 행만 보임.
 *
 * 멱등:
 *   --yes로 재실행 시 항상 동일 최종 상태 (비우기가 이전 삽입을 정리).
 */

import { provisionSeedForUser } from "../src/lib/seed/provision.js";
import { sql, adminSql } from "../src/lib/db/client.js";
import { DEV_OWNER_ID, runWithUser, getDb } from "../src/lib/auth/context.js";
import {
  pipelines,
  documents,
  blockDefs,
} from "../src/lib/db/schema.js";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// 인수 파싱
// ---------------------------------------------------------------------------
const YES = process.argv.includes("--yes");

// ---------------------------------------------------------------------------
// 메인
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log(`[seed:canonical] DEV_OWNER_ID = "${DEV_OWNER_ID}"`);
  console.log(`[seed:canonical] DATABASE_URL = ${process.env.DATABASE_URL ?? "(기본값)"}`);
  console.log();

  // ── 1. 삭제 대상 조회 (runWithUser — RLS 소유 스코프) ───────────────────
  await runWithUser(DEV_OWNER_ID, async () => {
    const db = getDb();

    // 파이프라인 목록
    const pipelineRows = await db
      .select({ id: pipelines.id, name: pipelines.name })
      .from(pipelines)
      .where(eq(pipelines.ownerId, DEV_OWNER_ID));

    // 문서 목록
    const documentRows = await db
      .select({ id: documents.id, name: documents.name })
      .from(documents)
      .where(eq(documents.ownerId, DEV_OWNER_ID));

    // block_def 목록
    const blockDefRows = await db
      .select({ id: blockDefs.id, name: blockDefs.name, type: blockDefs.type })
      .from(blockDefs)
      .where(eq(blockDefs.ownerId, DEV_OWNER_ID));

    // ── 2. 미리보기 출력 ──────────────────────────────────────────────────
    console.log(`[seed:canonical] 삭제 예정 대상:`);
    console.log();

    console.log(`  pipelines (${pipelineRows.length}개):`);
    for (const row of pipelineRows) {
      console.log(`    - [${row.id}] ${row.name}`);
    }

    console.log();
    console.log(`  documents (${documentRows.length}개):`);
    for (const row of documentRows) {
      console.log(`    - [${row.id}] ${row.name}`);
    }

    console.log();
    console.log(`  block_defs (${blockDefRows.length}개):`);
    for (const row of blockDefRows) {
      console.log(`    - [${row.id}] [${row.type}] ${row.name}`);
    }

    console.log();
    console.log(
      `  cascade 자동 삭제: nodes / edges / runs / node_runs / artifacts / chat_messages / document_versions`,
    );
    console.log();

    // ── 3. 안전 게이트 ────────────────────────────────────────────────────
    if (!YES) {
      console.log(
        `[seed:canonical] --yes 없이 실행됨 — 삭제하지 않고 중단합니다.`,
      );
      console.log(
        `                 재시드를 진행하려면: npm run seed:canonical -- --yes`,
      );
      return;
    }

    // ── 4. 비우기 (DEV_OWNER_ID 소유만) ─────────────────────────────────
    console.log(`[seed:canonical] 비우기 시작...`);

    // pipelines 삭제 → nodes/edges/runs/node_runs/artifacts/chat_messages cascade
    const deletedPipelines = await db
      .delete(pipelines)
      .where(eq(pipelines.ownerId, DEV_OWNER_ID))
      .returning({ id: pipelines.id });

    console.log(`  pipelines ${deletedPipelines.length}개 삭제 (cascade: nodes/edges/runs 포함)`);

    // documents 삭제 → document_versions cascade
    const deletedDocuments = await db
      .delete(documents)
      .where(eq(documents.ownerId, DEV_OWNER_ID))
      .returning({ id: documents.id });

    console.log(`  documents ${deletedDocuments.length}개 삭제 (cascade: document_versions 포함)`);

    // block_defs 삭제
    const deletedBlockDefs = await db
      .delete(blockDefs)
      .where(eq(blockDefs.ownerId, DEV_OWNER_ID))
      .returning({ id: blockDefs.id });

    console.log(`  block_defs ${deletedBlockDefs.length}개 삭제`);

    console.log();
    console.log(`[seed:canonical] 비우기 완료.`);
    console.log();
  });

  // YES가 없으면 여기서 재시드 없이 종료
  if (!YES) {
    return;
  }

  // ── 5. 정본 재시드 ────────────────────────────────────────────────────────
  console.log(`[seed:canonical] 정본 재시드 시작 (provisionSeedForUser)...`);

  await provisionSeedForUser(DEV_OWNER_ID);

  console.log(`[seed:canonical] 재시드 완료.`);
  console.log();
  console.log(`[seed:canonical] 결과 확인: npm run dev 후 http://localhost:3000`);
}

// ---------------------------------------------------------------------------
// 실행
// ---------------------------------------------------------------------------
try {
  await main();
} catch (err) {
  console.error("[seed:canonical] 오류:", err);
  process.exit(1);
} finally {
  // postgres.js 커넥션 풀 종료 — 프로세스 정상 종료.
  await Promise.allSettled([sql.end(), adminSql.end()]);
}
