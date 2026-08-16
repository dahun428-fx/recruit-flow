// 라우트 export 래퍼(auth.md §2) — resolveUserId → runWithUser로 현재 유저
// 컨텍스트를 세워 핸들러를 실행한다. Next middleware는 ALS를 핸들러까지
// 전파하지 못하므로 각 라우트 export를 이 얇은 래퍼로 감싼다.
import { resolveUserId, runWithUser } from "./context";

type RouteHandler<C> = (req: Request, ctx: C) => Response | Promise<Response>;

export function withUser<C>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (req, ctx) => {
    const userId = await resolveUserId(req);
    return runWithUser(userId, () => handler(req, ctx));
  };
}
