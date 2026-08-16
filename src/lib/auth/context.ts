// 현재 유저 seam (auth.md §2) — AsyncLocalStorage로 요청/실행 스코프에 현재
// 유저를 앰비언트 전파한다. queries.ts 시그니처를 바꾸지 않고 userId를 읽게 한다.
// resolveUserId가 Phase 2b(Supabase GoTrue) 스왑의 유일 지점이다.
import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/postgres-js";
import { db, sql, type Db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";

/** 인증 UI 도입 전 기본 소유자(로컬·ETL 데이터·폴백). Phase 2b에서 제거. */
export const DEV_OWNER_ID = "usr_dev_default";

type UserContext = {
  userId: string;
  /** RLS용 예약 커넥션(Phase 2a 슬라이스 4에서 주입). 없으면 풀 db 사용. */
  db?: Db;
};

// ★ globalThis 캐시 — Next dev/HMR·번들 컨텍스트 분리로 이 모듈이 재평가돼도
// ALS 인스턴스는 하나만 유지한다. 캐시 안 하면 runWithUser가 세팅한 als와
// getCurrentUserId가 읽는 als가 달라져 "컨텍스트 없음"이 간헐 발생한다
// (db/eventBus 싱글턴과 동일 패턴).
const globalForAls = globalThis as unknown as {
  __recruitFlowUserAls?: AsyncLocalStorage<UserContext>;
};
const als =
  globalForAls.__recruitFlowUserAls ?? new AsyncLocalStorage<UserContext>();
if (process.env.NODE_ENV !== "production") {
  globalForAls.__recruitFlowUserAls = als;
}

/** 현재 유저 id. 컨텍스트 밖이면 throw(닫힌 실패). */
export function getCurrentUserId(): string {
  const ctx = als.getStore();
  if (!ctx) {
    throw new Error(
      "현재 유저 컨텍스트 없음 — withUser/runWithUser 밖에서 호출됨",
    );
  }
  return ctx.userId;
}

/** 컨텍스트가 있으면 userId, 없으면 undefined(비강제 조회용). */
export function getCurrentUserIdOrNull(): string | undefined {
  return als.getStore()?.userId;
}

/**
 * postgres.js의 예약 커넥션(ReservedSql)을 drizzle(postgres-js)이 쓸 수 있게 보강한다.
 *
 * 예약 커넥션은 부모 `sql`과 달리 `.options`와 `.begin`을 노출하지 않는다:
 *   - `.options`: drizzle 드라이버가 parsers/serializers(투명 파서)를 주입하려고 읽는다.
 *     부모 sql의 options(동일 객체)를 공유한다 — 파서 주입은 멱등이라 안전.
 *   - `.begin`: drizzle의 `transaction()`이 `client.begin(cb)`를 호출한다. 부모 sql의
 *     begin은 풀에서 "다른" 커넥션을 잡아 트랜잭션을 열어 GUC(예약 커넥션 세션 값)를
 *     잃는다. 그래서 예약 커넥션 "그 자체"에서 BEGIN/COMMIT/ROLLBACK을 raw로 돌리고
 *     콜백에 예약 커넥션을 그대로 넘기는 begin을 붙인다 — 트랜잭션이 GUC가 걸린 동일
 *     물리 커넥션에 머문다(RLS 정책이 트랜잭션 쓰기에도 적용됨).
 *
 * 멱등: 이미 보강됐으면(begin 존재) 재설정하지 않는다.
 */
type ReservedConn = Awaited<ReturnType<typeof sql.reserve>>;
function prepareReservedForDrizzle(conn: ReservedConn): void {
  const c = conn as unknown as {
    options?: unknown;
    begin?: (cb: (client: ReservedConn) => unknown) => Promise<unknown>;
  };
  if (c.options === undefined) {
    c.options = (sql as unknown as { options: unknown }).options;
  }
  if (typeof c.begin !== "function") {
    c.begin = async (cb: (client: ReservedConn) => unknown) => {
      await conn`BEGIN`;
      try {
        const result = await cb(conn);
        await conn`COMMIT`;
        return result;
      } catch (e) {
        try {
          await conn`ROLLBACK`;
        } catch {
          // ROLLBACK 실패(커넥션 이미 끊김 등)는 무시하고 원 오류를 던진다.
        }
        throw e;
      }
    };
  }
}

/** 현재 스코프의 DB 핸들. 예약 커넥션(RLS)이 있으면 그것, 없으면 풀. */
export function getDb(): Db {
  return als.getStore()?.db ?? db;
}

/**
 * userId를 컨텍스트로 fn 실행 + RLS 예약 커넥션 생명주기 관리(auth.md §4).
 *
 * 흐름(reserve → set → run → reset → release):
 *   1. 앱 풀(rf_app)에서 커넥션을 배타적으로 예약(sql.reserve()).
 *   2. 그 커넥션에 세션 GUC `app.current_user_id`를 건다. 배타적 커넥션이라
 *      세션 스코프(false)여도 다른 요청으로 누수되지 않는다(게이트 실험 확정).
 *   3. 그 커넥션에 바인딩된 drizzle 핸들을 ALS store에 담아 fn 실행 —
 *      getDb()가 이 예약 커넥션을 반환하므로 모든 격리 쿼리가 GUC를 받는다.
 *   4. finally에서 RESET(GUC 제거) 후 release() — bare 세션 GUC를 풀에 남기지
 *      않는다(누수 차단). RESET 실패는 삼켜도 release는 반드시 수행.
 *
 * 이제 async다 — 호출자는 반환 Promise를 await하거나 void로 fire-and-forget한다.
 */
export async function runWithUser<T>(
  userId: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  const conn = await sql.reserve();
  try {
    await conn`SELECT set_config('app.current_user_id', ${userId}, false)`;
    prepareReservedForDrizzle(conn);
    const scopedDb = drizzle(conn, { schema });
    return await als.run({ userId, db: scopedDb }, fn);
  } finally {
    try {
      await conn`RESET app.current_user_id`;
    } catch {
      // RESET 실패(커넥션 이미 끊김 등)는 무시 — release는 반드시 수행.
    }
    conn.release();
  }
}

/**
 * ★ 유일한 스왑 지점(auth.md §2). Phase 2a: `x-rf-user` 헤더 또는
 * `DEV_OWNER_ID` 폴백. Phase 2b: 이 몸통을 GoTrue JWT 검증으로 교체.
 */
export async function resolveUserId(req: Request): Promise<string> {
  const header = req.headers.get("x-rf-user");
  if (header) return header;
  return DEV_OWNER_ID;
}
