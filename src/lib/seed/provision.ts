// 시드 프로비저닝 — 새 유저에게 스타터 시드를 복제한다(auth.md §7 SG-4).
//
// 원칙:
//   - 모든 시드 INSERT는 runWithUser(userId, ...) 안에서 수행한다.
//     예약 커넥션 + GUC가 세팅되므로 RLS WITH CHECK(owner_id = current_user_id)를
//     통과하고, 앱필터 규율(R3)을 지킨다.
//   - app_users 삽입은 RLS-exempt(슈퍼유저 adminDb) 또는 직접 rf_app으로 수행.
//     app_users는 RLS 정책이 self-only이거나 미적용(auth.md §3)이고, userId가
//     아직 존재하지 않으므로 adminSql(슈퍼유저)로 삽입해 일관성을 유지한다.
//   - 트랜잭션: block_defs + documents + 파이프라인을 단일 트랜잭션으로 묶는다.
//     drizzle의 db.transaction()은 context.ts prepareReservedForDrizzle()이 제공하는
//     BEGIN/COMMIT/ROLLBACK 래퍼 위에서 동작하므로, 예약 커넥션 위에서 안전하다.
//
// 삽입 순서 의존(G4):
//   1. block_defs 행 삽입 → slug→id 맵 확보
//   2. documents 행 삽입 → name→id 맵 확보
//   3. pipelines 행 삽입
//   4. nodes 행 삽입(blockDefId·config.documentId 해소, 노드 name→id 맵 구축)
//   5. edges 행 삽입(sourceNodeId·targetNodeId 해소)
//   * Gate config의 failTargetNodeId는 nodes 삽입 전 id를 미리 생성해 해소한다.

import { nanoid } from "nanoid";
import { adminSql } from "@/lib/db/client";
import { runWithUser, getDb } from "@/lib/auth/context";
import {
  blockDefs,
  documents,
  documentVersions,
  pipelines,
  nodes,
  edges,
} from "@/lib/db/schema";
import {
  STARTER_BLOCK_DEFS,
  STARTER_DOCUMENTS,
  STARTER_PIPELINE,
  type CatalogNode,
} from "./catalog";

// ---------------------------------------------------------------------------
// 내부 헬퍼: __slug: 접두 placeholder 해소
// ---------------------------------------------------------------------------

/**
 * config 객체 안의 "__slug:<slug>" placeholder를 실제 blockDefId로 재귀 치환한다.
 * mounts[].blockDefId에만 사용한다 — 문자열 치환이 아니라 값 수준 치환.
 */
function resolveBlockDefIds(
  config: Record<string, unknown>,
  slugToId: Map<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (k === "mounts" && Array.isArray(v)) {
      out[k] = v.map((mount) => {
        if (
          typeof mount === "object" &&
          mount !== null &&
          "blockDefId" in mount &&
          typeof (mount as { blockDefId: unknown }).blockDefId === "string"
        ) {
          const raw = (mount as { blockDefId: string }).blockDefId;
          if (raw.startsWith("__slug:")) {
            const slug = raw.slice("__slug:".length);
            const resolvedId = slugToId.get(slug);
            if (!resolvedId) {
              throw new Error(
                `block_def slug '${slug}'의 id를 찾을 수 없습니다. 삽입 순서를 확인하세요.`,
              );
            }
            return { ...mount, blockDefId: resolvedId };
          }
        }
        return mount;
      });
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// provisionSeedForUser
// ---------------------------------------------------------------------------

/**
 * 카탈로그 시드(block_defs + 문서 + 표준 파이프라인)를 userId 소유로 복제한다(auth.md §7).
 *
 * runWithUser(userId, ...) 안에서 실행되므로:
 *   - 예약 커넥션 GUC가 userId로 세팅됨 → RLS WITH CHECK 통과.
 *   - getDb()가 예약 커넥션 drizzle 핸들을 반환 → 격리 규율 유지.
 *
 * 트랜잭션 내 순서:
 *   1. block_defs 행 삽입 + slug→id 맵 구축.
 *   2. documents + document_versions 행 삽입 + name→id 맵 구축.
 *   3. pipelines 행 삽입.
 *   4. nodes 행 삽입(blockDefId·documentId·노드 id 선생성).
 *   5. edges 행 삽입(노드 name→id 맵으로 해소).
 */
export async function provisionSeedForUser(userId: string): Promise<void> {
  await runWithUser(userId, async () => {
    const db = getDb();
    const now = Date.now();

    await db.transaction(async (tx) => {
      // ──────────────────────────────────────────────────────────────────
      // 1. block_defs 삽입 + slug→id 맵
      // ──────────────────────────────────────────────────────────────────
      const slugToId = new Map<string, string>();

      for (const def of STARTER_BLOCK_DEFS) {
        const id = `bd_${nanoid()}`;
        slugToId.set(def.slug, id);

        // config 안의 __slug: placeholder는 아직 mounts가 없는 rule/skill/tool엔
        // 존재하지 않는다. agent config의 mounts는 이 루프 후반에 처리되나,
        // mounts[].blockDefId는 삽입 순서(tool/rule/skill→agent)로 이미 확보됨.
        // 따라서 resolveBlockDefIds를 config에 바로 적용한다.
        const resolvedConfig = resolveBlockDefIds(
          def.config as Record<string, unknown>,
          slugToId,
        );

        await tx.insert(blockDefs).values({
          id,
          type: def.type,
          name: def.name,
          description: def.description,
          config: resolvedConfig,
          enabled: true,
          origin: "import",
          tray: false,
          createdAt: now,
          ownerId: userId,
        });
      }

      // ──────────────────────────────────────────────────────────────────
      // 2. documents + document_versions 삽입 + name→id 맵
      // ──────────────────────────────────────────────────────────────────
      const docNameToId = new Map<string, string>();

      for (const doc of STARTER_DOCUMENTS) {
        const docId = `doc_${nanoid()}`;
        docNameToId.set(doc.name, docId);

        await tx.insert(documents).values({
          id: docId,
          name: doc.name,
          currentVersion: 1,
          folderId: null,
          createdAt: now,
          ownerId: userId,
        });

        await tx.insert(documentVersions).values({
          id: `dv_${nanoid()}`,
          documentId: docId,
          version: 1,
          content: doc.content,
          author: "human",
          note: "정본 시드 초기 버전",
          createdAt: now,
        });
      }

      // ──────────────────────────────────────────────────────────────────
      // 3. pipelines 행 삽입
      // ──────────────────────────────────────────────────────────────────
      const pipelineId = `pl_${nanoid()}`;

      await tx.insert(pipelines).values({
        id: pipelineId,
        name: STARTER_PIPELINE.name,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: null,
        ownerId: userId,
      });

      // ──────────────────────────────────────────────────────────────────
      // 4. nodes 삽입
      //    - 노드 id를 미리 생성해 name→id 맵 구축(edges·Gate failTargetNodeId 해소용).
      //    - blockDefId: blockDefSlug → slugToId 해소.
      //    - config.documentName → documentId 해소(Input 노드).
      //    - config.failTargetNodeName → failTargetNodeId 해소(Gate 노드).
      // ──────────────────────────────────────────────────────────────────

      // 4-a. 노드 id 미리 생성
      const nodeNameToId = new Map<string, string>();
      const nodeIds: string[] = [];
      for (const node of STARTER_PIPELINE.nodes) {
        const nodeId = `nd_${nanoid()}`;
        nodeIds.push(nodeId);
        if (nodeNameToId.has(node.name)) {
          throw new Error(
            `파이프라인 노드 이름 중복: "${node.name}". 노드 이름은 유일해야 합니다.`,
          );
        }
        nodeNameToId.set(node.name, nodeId);
      }

      // 4-b. 노드 삽입
      for (let i = 0; i < STARTER_PIPELINE.nodes.length; i++) {
        const catalogNode: CatalogNode = STARTER_PIPELINE.nodes[i];
        const nodeId = nodeIds[i];

        // blockDefId 해소
        const blockDefId =
          catalogNode.blockDefSlug !== null
            ? (slugToId.get(catalogNode.blockDefSlug) ?? null)
            : null;

        if (catalogNode.blockDefSlug !== null && blockDefId === null) {
          throw new Error(
            `노드 "${catalogNode.name}"의 blockDefSlug "${catalogNode.blockDefSlug}"를 해소할 수 없습니다.`,
          );
        }

        // config 해소: documentName → documentId, failTargetNodeName → failTargetNodeId
        const rawConfig = { ...catalogNode.config };
        const resolvedConfig: Record<string, unknown> = {};

        for (const [k, v] of Object.entries(rawConfig)) {
          if (k === "documentName" && typeof v === "string") {
            const docId = docNameToId.get(v);
            if (!docId) {
              throw new Error(
                `문서 이름 "${v}"를 해소할 수 없습니다. STARTER_DOCUMENTS를 확인하세요.`,
              );
            }
            resolvedConfig["documentId"] = docId;
          } else if (k === "failTargetNodeName" && typeof v === "string") {
            const targetId = nodeNameToId.get(v);
            if (!targetId) {
              throw new Error(
                `failTargetNodeName "${v}"를 노드 id로 해소할 수 없습니다. 노드 이름을 확인하세요.`,
              );
            }
            resolvedConfig["failTargetNodeId"] = targetId;
          } else {
            resolvedConfig[k] = v;
          }
        }

        await tx.insert(nodes).values({
          id: nodeId,
          pipelineId,
          type: catalogNode.type,
          name: catalogNode.name,
          positionX: catalogNode.positionX,
          positionY: catalogNode.positionY,
          blockDefId,
          config: resolvedConfig,
          createdAt: now,
          updatedAt: now,
        });
      }

      // ──────────────────────────────────────────────────────────────────
      // 5. edges 삽입
      //    - sourceNodeName / targetNodeName → nodeNameToId 해소.
      // ──────────────────────────────────────────────────────────────────
      for (const edge of STARTER_PIPELINE.edges) {
        const sourceNodeId = nodeNameToId.get(edge.sourceNodeName);
        const targetNodeId = nodeNameToId.get(edge.targetNodeName);

        if (!sourceNodeId) {
          throw new Error(
            `엣지 sourceNodeName "${edge.sourceNodeName}"을 해소할 수 없습니다.`,
          );
        }
        if (!targetNodeId) {
          throw new Error(
            `엣지 targetNodeName "${edge.targetNodeName}"을 해소할 수 없습니다.`,
          );
        }

        await tx.insert(edges).values({
          id: `ed_${nanoid()}`,
          pipelineId,
          sourceNodeId,
          targetNodeId,
          kind: edge.kind,
          sourceHandle: edge.sourceHandle,
          inputOrder: edge.inputOrder,
        });
      }
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
