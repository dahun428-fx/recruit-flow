// e2e 최소 시드 — 격리 pg DB에 문서 1개 + 저장된 블록 정의 몇 개.
// 대부분의 스펙은 API(그래프 PUT)로 노드를 세팅하므로 시드는 얇게 유지.
// pg 전환: dbPath(sqlite) → postgres.js sql 클라이언트를 받는다. jsonb/boolean/bigint 주의.
import { randomUUID } from "node:crypto";

/** @param {import("postgres").Sql} sql */
export async function seed(sql) {
  const now = Date.now();
  const id = () => randomUUID();

  // 증거 문서 1개(문서 탭·Input 노드 테스트용).
  const docId = id();
  await sql`INSERT INTO documents (id, name, current_version, created_at)
    VALUES (${docId}, '샘플 증거', 1, ${now})`;
  await sql`INSERT INTO document_versions (id, document_id, version, content, author, note, created_at)
    VALUES (${id()}, ${docId}, 1,
      ${"# 증거\n- 결제 시스템 재설계, p99 1.2s→180ms\n- 팀 리드 5명"},
      'human', ${null}, ${now})`;

  // 저장된 정의(라이브러리) — 팔레트 저장정의·부분재실행 테스트용.
  // config는 jsonb → 텍스트 파라미터 + 서버측 ::jsonb 캐스트(버전 무관 안정), enabled/tray는 boolean.
  const bdConfig = JSON.stringify({
    role: "[E2E:writer] 이력서를 작성한다.",
    outputFormat: "markdown",
  });
  await sql`INSERT INTO block_defs (id, type, name, description, config, enabled, origin, tray, created_at)
    VALUES (${id()}, 'agent', 'E2E 작성자', '고정 markdown 출력(스텁)',
      ${bdConfig}::jsonb,
      ${true}, 'import', ${false}, ${now})`;
}
