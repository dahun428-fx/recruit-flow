// 시드 프로비저닝 — 새 유저에게 스타터 시드를 복제한다(auth.md §7 SG-4).
//
// 원칙:
//   - 모든 시드 INSERT는 runWithUser(userId, ...) 안에서 수행한다.
//     예약 커넥션 + GUC가 세팅되므로 RLS WITH CHECK(owner_id = current_user_id)를
//     통과하고, 앱필터 규율(R3)을 지킨다.
//   - app_users 삽입은 RLS-exempt(슈퍼유저 adminDb) 또는 직접 rf_app으로 수행.
//     app_users는 RLS 정책이 self-only이거나 미적용(auth.md §3)이고, userId가
//     아직 존재하지 않으므로 adminSql(슈퍼유저)로 삽입해 일관성을 유지한다.
//   - 트랜잭션: block_defs + document + document_version을 단일 트랜잭션으로 묶는다.
//     drizzle의 db.transaction()은 context.ts prepareReservedForDrizzle()이 제공하는
//     BEGIN/COMMIT/ROLLBACK 래퍼 위에서 동작하므로, 예약 커넥션 위에서 안전하다.

import { nanoid } from "nanoid";
import { adminSql } from "@/lib/db/client";
import { runWithUser, getDb } from "@/lib/auth/context";
import { blockDefs, documents, documentVersions, appUsers } from "@/lib/db/schema";
import {
  STARTER_BLOCK_DEFS,
  STARTER_EVIDENCE_DOCUMENT,
} from "./catalog";

// ---------------------------------------------------------------------------
// provisionSeedForUser
// ---------------------------------------------------------------------------

/**
 * 카탈로그 시드(block_defs + 증거 문서)를 userId 소유로 복제한다(auth.md §7).
 *
 * runWithUser(userId, ...) 안에서 실행되므로:
 *   - 예약 커넥션 GUC가 userId로 세팅됨 → RLS WITH CHECK 통과.
 *   - getDb()가 예약 커넥션 drizzle 핸들을 반환 → 격리 규율 유지.
 *
 * 트랜잭션 내 순서:
 *   1. block_defs 행 삽입 (카탈로그 항목 × 1).
 *   2. documents 행 삽입 (증거 문서 헤더).
 *   3. document_versions 행 삽입 (초기 v1 본문).
 */
export async function provisionSeedForUser(userId: string): Promise<void> {
  await runWithUser(userId, async () => {
    const db = getDb();
    const now = Date.now();

    await db.transaction(async (tx) => {
      // 1. block_defs — 카탈로그 항목 전체
      for (const def of STARTER_BLOCK_DEFS) {
        await tx.insert(blockDefs).values({
          id: `bd_${nanoid()}`,
          type: def.type,
          name: def.name,
          description: def.description,
          config: def.config,
          enabled: true,
          origin: "import",
          tray: false,
          createdAt: now,
          ownerId: userId,
        });
      }

      // 2. document 헤더
      const docId = `doc_${nanoid()}`;
      await tx.insert(documents).values({
        id: docId,
        name: STARTER_EVIDENCE_DOCUMENT.name,
        currentVersion: 1,
        folderId: null,
        createdAt: now,
        ownerId: userId,
      });

      // 3. document_versions — 초기 v1 본문
      await tx.insert(documentVersions).values({
        id: `dv_${nanoid()}`,
        documentId: docId,
        version: 1,
        content: STARTER_EVIDENCE_DOCUMENT.content,
        author: "human",
        note: "스타터 시드 초기 버전",
        createdAt: now,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// provisionUser
// ---------------------------------------------------------------------------

/**
 * 새 유저를 app_users에 등록하고 스타터 시드를 복제한다.
 *
 * app_users INSERT는 adminSql(슈퍼유저)로 수행한다 — RLS-exempt 또는 self 정책이며,
 * userId가 아직 없으므로 슈퍼유저 우회가 안전하고 단순하다.
 * provisionSeedForUser는 runWithUser로 rf_app + GUC 경로를 탄다.
 *
 * @param email 가입 이메일 주소
 * @returns 생성된 userId ("usr_" + nanoid)
 */
export async function provisionUser(email: string): Promise<string> {
  const userId = `usr_${nanoid()}`;
  const now = Date.now();

  // app_users는 RLS-exempt — 슈퍼유저(adminSql)로 직접 삽입.
  await adminSql`
    INSERT INTO app_users (id, email, created_at)
    VALUES (${userId}, ${email}, ${now})
  `;

  // 시드 복제는 rf_app + runWithUser(userId) 경로.
  await provisionSeedForUser(userId);

  return userId;
}
