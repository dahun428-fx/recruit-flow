// e2e 최소 시드 — 격리 DB에 문서 1개 + 저장된 블록 정의 몇 개.
// 대부분의 스펙은 API(그래프 PUT)로 노드를 세팅하므로 시드는 얇게 유지.
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";

/** @param {string} dbPath */
export function seed(dbPath) {
  const db = new Database(dbPath);
  const now = Date.now();
  const id = () => randomUUID();

  const insDoc = db.prepare(
    "INSERT INTO documents (id,name,current_version,created_at) VALUES (?,?,?,?)",
  );
  const insVer = db.prepare(
    "INSERT INTO document_versions (id,document_id,version,content,author,note,created_at) VALUES (?,?,?,?,?,?,?)",
  );
  const insBd = db.prepare(
    "INSERT INTO block_defs (id,type,name,description,config,enabled,origin,tray,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
  );

  // 증거 문서 1개(문서 탭·Input 노드 테스트용).
  const docId = id();
  insDoc.run(docId, "샘플 증거", 1, now);
  insVer.run(
    id(),
    docId,
    1,
    "# 증거\n- 결제 시스템 재설계, p99 1.2s→180ms\n- 팀 리드 5명",
    "human",
    null,
    now,
  );

  // 저장된 정의(라이브러리) — 팔레트 저장정의·부분재실행 테스트용.
  insBd.run(
    id(),
    "agent",
    "E2E 작성자",
    "고정 markdown 출력(스텁)",
    JSON.stringify({ role: "[E2E:writer] 이력서를 작성한다.", outputFormat: "markdown" }),
    1,
    "import",
    0,
    now,
  );

  db.close();
}
