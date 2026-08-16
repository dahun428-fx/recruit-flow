-- Phase 2a Slice 1: app_users 테이블 + owner_id(nullable) 루트 5개 테이블 + R5 부분 유니크.
-- NOT NULL 승격·RLS 정책은 Phase 2a Slice 4(0002 마이그레이션).
-- 문 순서: (1)테이블 생성 → (2)기본 유저 삽입 → (3)컬럼 추가+FK → (4)백필 → (5)R5 인덱스.

-- (1) app_users 테이블 생성
CREATE TABLE "app_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint

-- (2) 기본 개발자 소유자 삽입 — 모든 fresh DB에서 FK + e2e 시드가 참조하는 폴백.
-- DEV_OWNER_ID = "usr_dev_default" (src/lib/auth/context.ts).
INSERT INTO "app_users" (id, email, created_at) VALUES ('usr_dev_default', 'dev@local', 1786000000000);
--> statement-breakpoint

-- (3) owner_id 컬럼 추가(nullable — NOT NULL은 Slice 4에서)
ALTER TABLE "block_defs" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "folders" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "pipelines" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "owner_id" text;--> statement-breakpoint

-- FK 제약 추가
ALTER TABLE "block_defs" ADD CONSTRAINT "block_defs_owner_id_app_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_id_app_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_owner_id_app_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipelines" ADD CONSTRAINT "pipelines_owner_id_app_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_owner_id_app_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."app_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- (4) 기존 행 백필 — 루트 4개 테이블은 직접, runs는 부모 pipelines에서 상속.
UPDATE "pipelines" SET owner_id = 'usr_dev_default' WHERE owner_id IS NULL;--> statement-breakpoint
UPDATE "documents" SET owner_id = 'usr_dev_default' WHERE owner_id IS NULL;--> statement-breakpoint
UPDATE "folders" SET owner_id = 'usr_dev_default' WHERE owner_id IS NULL;--> statement-breakpoint
UPDATE "block_defs" SET owner_id = 'usr_dev_default' WHERE owner_id IS NULL;--> statement-breakpoint
UPDATE "runs" SET owner_id = (SELECT p.owner_id FROM "pipelines" p WHERE p.id = "runs".pipeline_id) WHERE owner_id IS NULL;--> statement-breakpoint

-- (5) R5 부분 유니크 인덱스 — 파이프라인당 active run 1개 제한(auth.md §9, schema.md §runs).
-- 앱은 INSERT 실패를 409로 변환(engine.md).
CREATE UNIQUE INDEX "one_active_run_per_pipeline" ON "runs" ("pipeline_id") WHERE status IN ('running', 'waiting_human');
