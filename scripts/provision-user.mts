/**
 * scripts/provision-user.mts — 유저 프로비저닝 CLI.
 *
 * 사용법:
 *   npx tsx scripts/provision-user.mts <email>
 *
 * 환경변수:
 *   DATABASE_URL           앱(rf_app) 커넥션 URL (runWithUser가 사용).
 *                          기본: postgres://rf_app:rf_app@localhost:5433/recruit_flow
 *   RF_ADMIN_DATABASE_URL  슈퍼유저 커넥션 URL (app_users INSERT 용).
 *                          기본: postgres://postgres:postgres@localhost:5433/recruit_flow
 *
 * 수행 내용:
 *   1. app_users에 새 행 삽입 (id = "usr_" + nanoid, email, created_at).
 *   2. 스타터 시드 복제 — block_defs × 4 + 증거 문서 × 1 (v1 포함).
 *      모두 userId 소유로 각인(RLS WITH CHECK 통과).
 *   3. 생성된 userId와 시드 요약을 stdout에 출력.
 *
 * 주의:
 *   - CLI는 요청 컨텍스트가 없으므로 runWithUser는 provisionSeedForUser 내부에서
 *     명시적으로 세팅된다(context.ts 설계 원칙).
 *   - 종료 전 sql.end()를 호출해 프로세스가 멈추지 않도록 한다.
 */

// 환경변수를 먼저 읽어 client.ts 싱글턴이 올바른 URL로 초기화되도록
// import 전에 process.env 세팅 코드를 두지 않는다(이미 환경에 세팅돼 있어야 함).
import { provisionUser } from "../src/lib/seed/provision.js";
import { sql, adminSql } from "../src/lib/db/client.js";
import { STARTER_BLOCK_DEFS, STARTER_EVIDENCE_DOCUMENT } from "../src/lib/seed/catalog.js";

const email = process.argv[2];

if (!email || !email.includes("@")) {
  console.error("사용법: npx tsx scripts/provision-user.mts <email>");
  console.error("예: npx tsx scripts/provision-user.mts alice@example.com");
  process.exit(1);
}

console.log(`[provision-user] 유저 프로비저닝 시작: ${email}`);

try {
  const userId = await provisionUser(email);

  console.log(`\n[provision-user] 완료`);
  console.log(`  userId  : ${userId}`);
  console.log(`  email   : ${email}`);
  console.log(`\n  시드 내용:`);
  console.log(`    block_defs (${STARTER_BLOCK_DEFS.length}개):`);
  for (const def of STARTER_BLOCK_DEFS) {
    console.log(`      - [${def.type}] ${def.name}`);
  }
  console.log(`    documents (1개):`);
  console.log(`      - "${STARTER_EVIDENCE_DOCUMENT.name}" (v1)`);
} catch (err) {
  console.error("[provision-user] 오류:", err);
  process.exit(1);
} finally {
  // postgres.js 커넥션 풀 종료 — 프로세스 정상 종료.
  await Promise.allSettled([sql.end(), adminSql.end()]);
}
