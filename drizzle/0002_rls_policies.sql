-- Phase 2a Slice 4: NOT NULL 승격 + RLS 활성화 + 정책 설정.
-- 전제: 0001 마이그레이션에서 owner_id 컬럼 추가·백필 완료.
--       e2e DB는 마이그레이션 전 테이블이 비어 있으므로 SET NOT NULL이 no-op.
-- 실행 주체: postgres(슈퍼유저) — 정책 생성·FORCE RLS는 오너 권한 필요.

-- ============================================================
-- PART 1: owner_id NOT NULL 승격 (루트 5개 테이블)
-- 백필이 0001에서 완료되어 NULL 행 없음. e2e 빈 테이블은 no-op.
-- ============================================================

ALTER TABLE "pipelines" ALTER COLUMN "owner_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "owner_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "folders" ALTER COLUMN "owner_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "block_defs" ALTER COLUMN "owner_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "runs" ALTER COLUMN "owner_id" SET NOT NULL;
--> statement-breakpoint

-- ============================================================
-- PART 2: RLS 활성화 (11개 테이블 전체 — ENABLE + FORCE)
-- FORCE ROW LEVEL SECURITY: postgres 슈퍼유저도 RLS 적용받게 함.
-- rf_app은 테이블 오너가 아니므로 FORCE 없이도 RLS 적용됨.
-- 오너(postgres)가 앱 연결 시 우회하지 못하도록 FORCE 필수.
-- ============================================================

-- 루트 테이블 (owner_id 직접 소유)
ALTER TABLE "pipelines" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "pipelines" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "folders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "folders" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "block_defs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "block_defs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "runs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- 자식 테이블 (부모 조인으로 격리)
ALTER TABLE "nodes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "nodes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "edges" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "edges" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "node_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "node_runs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "artifacts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "artifacts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "document_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "document_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "chat_messages" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

-- ============================================================
-- PART 3-A: 루트 테이블 정책 (owner_id 직접 비교)
-- current_setting missing_ok=true → GUC 미설정 시 NULL → 기본 전면 거부.
-- USING: SELECT/UPDATE/DELETE 행 필터.
-- WITH CHECK: INSERT/UPDATE 쓰기 검증. 둘 다 필수(auth.md §3 오답 방지).
-- ============================================================

CREATE POLICY owner_isolation ON "pipelines"
  USING (owner_id = current_setting('app.current_user_id', true))
  WITH CHECK (owner_id = current_setting('app.current_user_id', true));
--> statement-breakpoint

CREATE POLICY owner_isolation ON "documents"
  USING (owner_id = current_setting('app.current_user_id', true))
  WITH CHECK (owner_id = current_setting('app.current_user_id', true));
--> statement-breakpoint

CREATE POLICY owner_isolation ON "folders"
  USING (owner_id = current_setting('app.current_user_id', true))
  WITH CHECK (owner_id = current_setting('app.current_user_id', true));
--> statement-breakpoint

CREATE POLICY owner_isolation ON "block_defs"
  USING (owner_id = current_setting('app.current_user_id', true))
  WITH CHECK (owner_id = current_setting('app.current_user_id', true));
--> statement-breakpoint

CREATE POLICY owner_isolation ON "runs"
  USING (owner_id = current_setting('app.current_user_id', true))
  WITH CHECK (owner_id = current_setting('app.current_user_id', true));
--> statement-breakpoint

-- ============================================================
-- PART 3-B: 자식 테이블 정책 (부모 조인)
-- nodes, edges → pipelines (pipeline_id 경유)
-- node_runs → runs (run_id 경유)
-- artifacts → node_runs (node_run_id 경유, node_runs의 정책이 2차 방어)
-- document_versions → documents (document_id 경유)
-- chat_messages → pipelines (pipeline_id 경유)
-- ============================================================

-- nodes: pipelines 소유권 조인
CREATE POLICY owner_isolation ON "nodes"
  USING (
    EXISTS (
      SELECT 1 FROM "pipelines" p
      WHERE p.id = "nodes".pipeline_id
        AND p.owner_id = current_setting('app.current_user_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "pipelines" p
      WHERE p.id = "nodes".pipeline_id
        AND p.owner_id = current_setting('app.current_user_id', true)
    )
  );
--> statement-breakpoint

-- edges: pipelines 소유권 조인
CREATE POLICY owner_isolation ON "edges"
  USING (
    EXISTS (
      SELECT 1 FROM "pipelines" p
      WHERE p.id = "edges".pipeline_id
        AND p.owner_id = current_setting('app.current_user_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "pipelines" p
      WHERE p.id = "edges".pipeline_id
        AND p.owner_id = current_setting('app.current_user_id', true)
    )
  );
--> statement-breakpoint

-- node_runs: runs 소유권 조인 (run_id → runs.owner_id)
CREATE POLICY owner_isolation ON "node_runs"
  USING (
    EXISTS (
      SELECT 1 FROM "runs" r
      WHERE r.id = "node_runs".run_id
        AND r.owner_id = current_setting('app.current_user_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "runs" r
      WHERE r.id = "node_runs".run_id
        AND r.owner_id = current_setting('app.current_user_id', true)
    )
  );
--> statement-breakpoint

-- artifacts: node_runs 조인 (node_run_id → node_runs → runs.owner_id).
-- 단일 홉: node_runs의 자체 RLS 정책이 2차 방어.
-- 직접 조인(runs까지 2홉)도 가능하나 단일 홉 + node_runs 정책 위임이 더 간결.
CREATE POLICY owner_isolation ON "artifacts"
  USING (
    EXISTS (
      SELECT 1 FROM "node_runs" nr
      JOIN "runs" r ON r.id = nr.run_id
      WHERE nr.id = "artifacts".node_run_id
        AND r.owner_id = current_setting('app.current_user_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "node_runs" nr
      JOIN "runs" r ON r.id = nr.run_id
      WHERE nr.id = "artifacts".node_run_id
        AND r.owner_id = current_setting('app.current_user_id', true)
    )
  );
--> statement-breakpoint

-- document_versions: documents 소유권 조인 (document_id → documents.owner_id)
CREATE POLICY owner_isolation ON "document_versions"
  USING (
    EXISTS (
      SELECT 1 FROM "documents" d
      WHERE d.id = "document_versions".document_id
        AND d.owner_id = current_setting('app.current_user_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "documents" d
      WHERE d.id = "document_versions".document_id
        AND d.owner_id = current_setting('app.current_user_id', true)
    )
  );
--> statement-breakpoint

-- chat_messages: pipelines 소유권 조인 (pipeline_id → pipelines.owner_id)
CREATE POLICY owner_isolation ON "chat_messages"
  USING (
    EXISTS (
      SELECT 1 FROM "pipelines" p
      WHERE p.id = "chat_messages".pipeline_id
        AND p.owner_id = current_setting('app.current_user_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "pipelines" p
      WHERE p.id = "chat_messages".pipeline_id
        AND p.owner_id = current_setting('app.current_user_id', true)
    )
  );
--> statement-breakpoint

-- ============================================================
-- PART 4: app_users — RLS 의도적 미적용
-- app_users는 아이덴티티 테이블이다. FK 체크는 RLS를 우회하며,
-- 프로비저닝(신규 유저 생성)은 관리자 작업이다.
-- 앱 롤(rf_app)은 bootstrap에서 SELECT/INSERT 권한을 받는다.
-- ============================================================
-- (app_users 에는 ENABLE ROW LEVEL SECURITY를 걸지 않는다)
