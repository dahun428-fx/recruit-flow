/**
 * scripts/rls-verify.mts — RLS 저수준 검증 스크립트 (재사용 가능).
 *
 * 사용법:
 *   npx tsx scripts/rls-verify.mts
 *
 * 환경변수:
 *   DATABASE_URL        슈퍼유저 URL (시드 데이터 삽입·정리용)
 *                       기본: postgres://postgres:postgres@localhost:5433/recruit_flow
 *   RF_APP_URL          rf_app 롤 URL (RLS 검증용)
 *                       기본: postgres://rf_app:rf_app@localhost:5433/recruit_flow
 *
 * 검증 항목:
 *   1. GUC=usr_b로 usr_a 소유 파이프라인·노드·runs·node_runs → 0 행
 *   2. GUC=usr_a로 동일 조회 → 1 행 (실제 행)
 *   3. GUC=usr_b로 usr_a 파이프라인에 노드 INSERT → WITH CHECK 위반으로 거부
 *   4. GUC 미설정(NULL)으로 pipelines SELECT → 0 행 (기본 전면 거부)
 *
 * 구현 원칙 (auth.md §4 게이트 실험 확정):
 *   - set_config('app.current_user_id', uid, true) — 트랜잭션 로컬 (누수 차단).
 *   - rf_app 커넥션 사용 (슈퍼유저가 아님 → FORCE RLS 적용받음).
 */

import postgres from "postgres";
import { randomUUID } from "node:crypto";

const SUPERUSER_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5433/recruit_flow";

const RF_APP_URL =
  process.env.RF_APP_URL ??
  "postgres://rf_app:rf_app@localhost:5433/recruit_flow";

const superSql = postgres(SUPERUSER_URL, { max: 1 });
const rfSql = postgres(RF_APP_URL, { max: 1 });

let passCount = 0;
let failCount = 0;

function pass(label: string) {
  passCount++;
  console.log(`  PASS  ${label}`);
}

function fail(label: string, detail?: unknown) {
  failCount++;
  console.error(`  FAIL  ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
}

// -------------------------------------------------------------------------
// 시드 데이터 생성 (슈퍼유저)
// -------------------------------------------------------------------------
const usrA = `rls_verify_usr_a_${randomUUID().slice(0, 8)}`;
const usrB = `rls_verify_usr_b_${randomUUID().slice(0, 8)}`;
const now = Date.now();
const pipelineId = `rls_verify_pipe_${randomUUID().slice(0, 8)}`;
const nodeId = `rls_verify_node_${randomUUID().slice(0, 8)}`;
const runId = `rls_verify_run_${randomUUID().slice(0, 8)}`;
const nodeRunId = `rls_verify_nr_${randomUUID().slice(0, 8)}`;

console.log("[rls-verify] 시드 데이터 삽입...");

// app_users 두 명 삽입
await superSql`
  INSERT INTO app_users (id, email, created_at)
  VALUES (${usrA}, ${`${usrA}@test.local`}, ${now}),
         (${usrB}, ${`${usrB}@test.local`}, ${now})
  ON CONFLICT (id) DO NOTHING
`;

// usr_a 소유 파이프라인 (슈퍼유저 삽입 — RLS 우회)
await superSql`
  INSERT INTO pipelines (id, name, created_at, updated_at, owner_id)
  VALUES (${pipelineId}, 'RLS 검증용 파이프라인', ${now}, ${now}, ${usrA})
`;

// 파이프라인 소속 노드 (슈퍼유저 삽입)
await superSql`
  INSERT INTO nodes (id, pipeline_id, type, name, position_x, position_y, config, created_at, updated_at)
  VALUES (${nodeId}, ${pipelineId}, 'agent', 'RLS 검증 노드', 0, 0, '{}'::jsonb, ${now}, ${now})
`;

// usr_a 소유 run (슈퍼유저 삽입)
await superSql`
  INSERT INTO runs (id, pipeline_id, status, graph_snapshot, started_at, owner_id)
  VALUES (${runId}, ${pipelineId}, 'succeeded', '{}'::jsonb, ${now}, ${usrA})
`;

// node_run (슈퍼유저 삽입)
await superSql`
  INSERT INTO node_runs (id, run_id, node_id, status)
  VALUES (${nodeRunId}, ${runId}, ${nodeId}, 'succeeded')
`;

console.log("[rls-verify] 시드 완료. 검증 시작...\n");

// -------------------------------------------------------------------------
// 검증 1: GUC=usr_b → usr_a 행 SELECT → 0 행
// -------------------------------------------------------------------------
console.log("▶ 검증 1: usr_b 컨텍스트로 usr_a 소유 행 SELECT → 0 행이어야 함");

await rfSql.begin(async (tx) => {
  // 트랜잭션 로컬 GUC 설정 (missing_ok=true의 true 인자는 current_setting 쪽)
  await tx`SELECT set_config('app.current_user_id', ${usrB}, true)`;

  const pipes = await tx`SELECT id FROM pipelines WHERE id = ${pipelineId}`;
  pipes.length === 0
    ? pass("pipelines: usr_b → usr_a 파이프라인 보이지 않음")
    : fail("pipelines: usr_b → usr_a 파이프라인이 보임", pipes);

  const ns = await tx`SELECT id FROM nodes WHERE id = ${nodeId}`;
  ns.length === 0
    ? pass("nodes: usr_b → usr_a 노드 보이지 않음")
    : fail("nodes: usr_b → usr_a 노드가 보임", ns);

  const rs = await tx`SELECT id FROM runs WHERE id = ${runId}`;
  rs.length === 0
    ? pass("runs: usr_b → usr_a run 보이지 않음")
    : fail("runs: usr_b → usr_a run이 보임", rs);

  const nrs = await tx`SELECT id FROM node_runs WHERE id = ${nodeRunId}`;
  nrs.length === 0
    ? pass("node_runs: usr_b → usr_a node_run 보이지 않음")
    : fail("node_runs: usr_b → usr_a node_run이 보임", nrs);
});

// -------------------------------------------------------------------------
// 검증 2: GUC=usr_a → 자신 소유 행 SELECT → 1 행
// -------------------------------------------------------------------------
console.log("\n▶ 검증 2: usr_a 컨텍스트로 자신 소유 행 SELECT → 1 행이어야 함");

await rfSql.begin(async (tx) => {
  await tx`SELECT set_config('app.current_user_id', ${usrA}, true)`;

  const pipes = await tx`SELECT id FROM pipelines WHERE id = ${pipelineId}`;
  pipes.length === 1
    ? pass("pipelines: usr_a → 자신의 파이프라인 조회 성공")
    : fail("pipelines: usr_a → 자신의 파이프라인 조회 실패", pipes);

  const ns = await tx`SELECT id FROM nodes WHERE id = ${nodeId}`;
  ns.length === 1
    ? pass("nodes: usr_a → 자신의 노드 조회 성공")
    : fail("nodes: usr_a → 자신의 노드 조회 실패", ns);

  const rs = await tx`SELECT id FROM runs WHERE id = ${runId}`;
  rs.length === 1
    ? pass("runs: usr_a → 자신의 run 조회 성공")
    : fail("runs: usr_a → 자신의 run 조회 실패", rs);

  const nrs = await tx`SELECT id FROM node_runs WHERE id = ${nodeRunId}`;
  nrs.length === 1
    ? pass("node_runs: usr_a → 자신의 node_run 조회 성공")
    : fail("node_runs: usr_a → 자신의 node_run 조회 실패", nrs);
});

// -------------------------------------------------------------------------
// 검증 3: GUC=usr_b → usr_a 파이프라인에 노드 INSERT → WITH CHECK 위반
// -------------------------------------------------------------------------
console.log("\n▶ 검증 3: usr_b 컨텍스트로 usr_a 파이프라인에 노드 INSERT → 거부되어야 함");

let insertRejected = false;
try {
  await rfSql.begin(async (tx) => {
    await tx`SELECT set_config('app.current_user_id', ${usrB}, true)`;
    const fakeNodeId = `rls_fake_node_${randomUUID().slice(0, 8)}`;
    await tx`
      INSERT INTO nodes (id, pipeline_id, type, name, position_x, position_y, config, created_at, updated_at)
      VALUES (${fakeNodeId}, ${pipelineId}, 'agent', '침입 노드', 0, 0, '{}'::jsonb, ${now}, ${now})
    `;
    // 여기까지 오면 안 됨
    insertRejected = false;
  });
} catch (e: unknown) {
  // RLS WITH CHECK 위반 → PostgreSQL error 42501 (insufficient_privilege)
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("42501") || msg.toLowerCase().includes("policy") || msg.toLowerCase().includes("row-level")) {
    insertRejected = true;
  } else {
    // 다른 에러는 예상치 못한 실패
    fail("nodes INSERT: 예상치 못한 에러", msg);
  }
}
insertRejected
  ? pass("nodes INSERT: usr_b → usr_a 파이프라인 노드 삽입 거부됨 (WITH CHECK 작동)")
  : fail("nodes INSERT: usr_b → usr_a 파이프라인 노드 삽입이 허용됨! (WITH CHECK 미작동)");

// -------------------------------------------------------------------------
// 검증 4: GUC 미설정(NULL) → pipelines SELECT → 0 행 (기본 전면 거부)
// -------------------------------------------------------------------------
console.log("\n▶ 검증 4: GUC 미설정 상태로 pipelines SELECT → 0 행 (closed-fail)");

await rfSql.begin(async (tx) => {
  // GUC를 설정하지 않음 → current_setting('app.current_user_id', true) = NULL
  // NULL = any_value 는 항상 false → 모든 행 차단
  const pipes = await tx`SELECT id FROM pipelines WHERE id = ${pipelineId}`;
  pipes.length === 0
    ? pass("pipelines: GUC 미설정 → 0 행 (기본 전면 거부 작동)")
    : fail("pipelines: GUC 미설정인데 행이 보임! (closed-fail 미작동)", pipes);
});

// -------------------------------------------------------------------------
// 정리 (슈퍼유저)
// -------------------------------------------------------------------------
console.log("\n[rls-verify] 시드 데이터 정리...");
await superSql`DELETE FROM node_runs WHERE id = ${nodeRunId}`;
await superSql`DELETE FROM runs WHERE id = ${runId}`;
await superSql`DELETE FROM nodes WHERE id = ${nodeId}`;
await superSql`DELETE FROM pipelines WHERE id = ${pipelineId}`;
await superSql`DELETE FROM app_users WHERE id IN (${usrA}, ${usrB})`;
console.log("[rls-verify] 정리 완료.");

// -------------------------------------------------------------------------
// 결과 요약
// -------------------------------------------------------------------------
console.log(`\n${"=".repeat(50)}`);
console.log(`결과: PASS ${passCount} / FAIL ${failCount}`);
if (failCount === 0) {
  console.log("모든 RLS 검증 통과 ✓");
} else {
  console.error(`${failCount}개 검증 실패 — RLS 설정을 점검하세요.`);
}
console.log("=".repeat(50));

await rfSql.end();
await superSql.end();

if (failCount > 0) {
  process.exit(1);
}
