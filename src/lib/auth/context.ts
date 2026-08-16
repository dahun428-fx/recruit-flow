// 현재 유저 seam (auth.md §2) — AsyncLocalStorage로 요청/실행 스코프에 현재
// 유저를 앰비언트 전파한다. queries.ts 시그니처를 바꾸지 않고 userId를 읽게 한다.
// resolveUserId가 Phase 2b(Supabase GoTrue) 스왑의 유일 지점이다.
import { AsyncLocalStorage } from "node:async_hooks";
import { db, type Db } from "@/lib/db/client";

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

/** 현재 스코프의 DB 핸들. 예약 커넥션(RLS)이 있으면 그것, 없으면 풀. */
export function getDb(): Db {
  return als.getStore()?.db ?? db;
}

/**
 * userId를 컨텍스트로 fn 실행. 슬라이스 4에서 RLS 예약 커넥션+GUC 셋업을
 * 여기에 추가한다(auth.md §4). 지금은 ALS 전파만.
 */
export function runWithUser<T>(userId: string, fn: () => T): T {
  return als.run({ userId }, fn);
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
