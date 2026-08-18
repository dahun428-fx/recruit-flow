# 인증·소유권·격리 (재플랫폼 Phase 2)

2026-08-16 architect 설계 + RLS×postgres.js 게이트 실험 확정.
상위: [replatform-plan.md](replatform-plan.md)(SG-2·5·6, R3·R5) ·
[schema.md](schema.md) · [engine.md](engine.md). **스펙=진실의 원천.**

로컬 SQLite 단일사용자 → 멀티유저 전환의 소유권·격리 계약을 정의한다.
**Phase 2a(이 문서)** = 로컬 우선: owner_id + pg 네이티브 RLS + 앱필터 +
현재유저 seam. 실제 Supabase GoTrue/JWT/로그인 UI는 **Phase 2b**로 분리한다.

## 1. 격리 이중방어 — 역할 분담

- **앱필터 = 실행 경로 강제(1차).** 모든 쿼리가 `getCurrentUserId()`로 루트
  행을 필터하고 쓰기에 owner_id를 각인한다. 정상 경로의 행 선택 주체.
- **RLS = 격리 보증(하드 백스톱).** 앱필터에 버그가 있어도 DB가 남의 행을
  반환·수정하지 못하게 막는 최종 보증. `rf_app` 롤 + FORCE RLS.

> plan의 "RLS 1차 + 앱필터 2차"를 이렇게 정밀화한다: *격리의 최종 보증*은
> RLS가, *실행 경로의 필터링*은 앱이 진다.

## 2. 현재 유저 seam (`src/lib/auth/context.ts`)

`AsyncLocalStorage<UserContext>` 기반. 쿼리 시그니처를 바꾸지 않고 현재
유저를 앰비언트로 전파한다.

```
getCurrentUserId(): string          // ALS에서 읽음. 없으면 throw(닫힌 실패).
runWithUser<T>(userId, fn): T        // ALS.run + 예약 커넥션 셋업(§4).
resolveUserId(req): Promise<string>  // ★ 유일한 스왑 지점.
```

- **`resolveUserId`가 Phase 2b 스왑의 유일 지점.** Phase 2a: `x-rf-user`
  헤더(테스트·로컬) 또는 `rf_user` 쿠키를 읽고, 없으면 `DEV_OWNER_ID`
  폴백(격리 미적용 단계에서만). Phase 2b: 이 함수 몸통만 GoTrue JWT →
  `auth.uid()` 검증으로 교체. 나머지 코드는 `getCurrentUserId()`만 본다.
- **라우트 배선:** 각 라우트 export를 `withUser(handler)`로 감싼다
  (`src/lib/auth/with-user.ts`) — `resolveUserId(req)` → `runWithUser(...)`.
  Next `middleware.ts`는 ALS를 핸들러까지 전파 못 하므로 래퍼 방식.

## 3. 소유권 모델

| 테이블 | owner_id | 격리 | RLS 정책 |
| --- | --- | --- | --- |
| pipelines | ✅ 각인 | 직접 | `owner_id = current_setting('app.current_user_id')` USING+CHECK |
| documents | ✅ 각인 | 직접 | 동일 |
| folders | ✅ 각인 | 직접 | 동일 |
| block_defs | ✅ 각인 | 직접 | 동일 |
| runs | ✅ 각인 (R3) | 직접 | 동일 — 러너 백그라운드 쓰기 안전 |
| nodes | ❌ | 부모 조인 | `EXISTS(pipelines p WHERE p.id=pipeline_id AND p.owner_id=…)` USING+CHECK |
| edges | ❌ | → pipelines | 동일 |
| node_runs | ❌ | → runs | `EXISTS(runs 소유)` USING+CHECK |
| artifacts | ❌ | → node_runs | `EXISTS(node_runs 소유)` USING+CHECK |
| document_versions | ❌ | → documents | `EXISTS(documents 소유)` USING+CHECK |
| chat_messages | ❌ | → pipelines | `EXISTS(pipelines 소유)` USING+CHECK |
| app_users (신규) | — | self | 최소 테이블. RLS self-only 또는 미적용 |

**오답 방지 규칙:**
- 자식 정책은 반드시 **`WITH CHECK`도** 건다 — USING만 있으면 남의 부모에
  자식을 **삽입**할 수 있다(누수).
- `current_setting('app.current_user_id', true)`(missing_ok=true)는 미설정 시
  NULL → `owner_id = NULL`은 항상 false → **기본 전면 거부**(닫힌 실패).
- 자식은 owner_id 미보유. `runs`만 예외로 각인(러너가 요청 밖에서 쓰므로
  조인 정책이 러너 컨텍스트에서 취약 → 자체 owner_id가 안전).

## 4. RLS 강제 메커니즘 — GUC 주입 (게이트 실험 확정)

컨테이너 `postgres`(슈퍼유저)는 RLS를 우회한다. 런타임은 **전용 비슈퍼유저
롤 `rf_app`**(FORCE RLS 적용받음)으로 접속한다. 현재 유저는
`app.current_user_id` GUC로 전달한다.

**★ 게이트 실험 결과(2026-08-16) — 반드시 지킬 것:**

- **트랜잭션 스코프 `set_config(...,true)`(=`SET LOCAL`)는 안전**하고
  트랜잭션 종료 시 자동 리셋된다.
- **세션 스코프 `set_config(...,false)`는 풀 커넥션 재사용 시 다음 요청으로
  누수된다**(실험 C/D에서 확증: 예약 커넥션이 리셋 없이 반납되자 무관한
  단건 쿼리가 이전 유저의 행을 봤다). **절대 bare 세션 GUC를 풀에 남기지
  않는다.**

**따라서 주입 방식:**
- `runWithUser(userId, fn)`는 **예약 커넥션(`sql.reserve()`)**을 잡아 그 위에
  `set_config('app.current_user_id', userId, false)`(세션, 배타적 커넥션이라
  안전)를 걸고 ALS에 그 예약 `sql`을 저장한다. `fn` 종료 시 **finally에서
  `RESET app.current_user_id` 후 `release()`**(누수 차단).
- `queries.ts`는 `getDb()`로 **ALS의 예약 커넥션이 있으면 그것을**, 없으면 풀
  `db`를 쓴다. RLS가 켜진 뒤 풀 경로는 GUC 미설정 → 닫힌 실패 → 모든
  격리 대상 접근이 `withUser`/`runWithUser`를 강제로 지나게 된다.
- **커넥션 점유:** 요청은 짧아 무해. 러너 `drive()`는 run 1건당 예약 1개를
  점유(로컬·소수 run이라 허용). 스케일아웃(워커 분리)은 v2.

**★ 슬라이스 4 함정 — 챗 라우트 fire-and-forget × 예약 커넥션 생명주기**:
`POST /pipelines/[id]/chat`는 `runChat`를 fire-and-forget IIFE로 띄우고 즉시 200을
반환한다(chat/route.ts). 슬라이스 3(순수 ALS)에선 store가 detached IIFE로 전파돼
무해하나, 슬라이스 4에서 `runWithUser` finally가 예약 커넥션을 `RESET`+`release`하면,
아직 실행 중인 `runChat`→`trigger_run`→`runner.start`의 `createRun`·검증 쿼리가
**이미 반납된 예약 커넥션**에서 돌아 GUC가 사라진다. 대책(슬라이스 4에서 택1):
(a) chat 라우트가 `runChat` 완료까지 `runWithUser` 스코프를 유지(await), 또는
(b) `runner.start`가 자체 `runWithUser(ownerId)`로 새 예약 커넥션을 세우고 시작
쿼리를 그 안에서 실행. `launch`의 drive는 이미 (b)로 새 스코프를 여므로 그 앞의
`createRun`·검증도 같은 스코프로 끌어오면 된다. R3 리뷰 지적사항.

**롤·마이그레이션 분리:**
- 롤 `rf_app` 생성은 클러스터 전역·환경별 → **마이그레이션 밖
  `scripts/pg-bootstrap.mts`**(멱등). 마이그레이션은 컬럼·정책·인덱스만.
- 마이그레이션·`recoverOnBoot`는 별도 관리 커넥션(`postgres`/`rf_migrator`).

## 5. 러너 owner 경계 (R3)

러너는 요청 컨텍스트 밖(fire-and-forget `drive()`)이다.
- `runner.start/startFrom`은 **요청 컨텍스트에서** `getCurrentUserId()`로
  ownerId를 확보해 `RunControl.ownerId`에 저장하고 `createRun`이 owner_id를
  각인한다.
- `launch()`는 `runWithUser(control.ownerId, () => this.drive(control))`로
  감싼다 → 백그라운드 쓰기도 예약 커넥션(GUC 설정)을 통해 앱필터·RLS를
  동일하게 받는다. **BYPASSRLS 시스템 롤 금지**(R3 위반).
- `recoverOnBoot`는 시스템 컨텍스트 → 마감 대상 run의 `owner_id`를 읽어
  각 유저로 `runWithUser` 감싸 처리한다(BYPASSRLS 대신).

## 6. SSE 소유자 스코프 (SG-3)

- `subscribePipeline(pipelineId, ownerId, fn)` — 구독자를 ownerId와 연결.
  SSE 라우트는 `withUser`로 감싸 `getCurrentUserId()`로 ownerId를 넘긴다.
- `emitToAllPipelines`(전역) → **`emitToOwner(ownerId, event)`**: 해당 owner의
  pipeline 구독자에게만. `emitBlockDef`·`emitDocumentChanged`가 ownerId를
  넘긴다(CRUD 라우트=ALS, 러너=`control.ownerId`).
- run 스코프 이벤트는 이미 runId로 좁혀져 안전하나, run 구독 라우트도 그
  run의 owner==현재유저를 진입 시 검증한다.

## 7. 시드 복제 (SG-4) — 실 가입 없이

- `provisionSeedForUser(userId)`(`src/lib/seed/provision.ts`) — 시드 카탈로그
  (`src/lib/seed/catalog.ts`, 코드 상수)의 block_defs·증거 문서를 새 userId로
  각인해 트랜잭션 복제.
- **표준 파이프라인 시드(정본):** 카탈로그는 block_defs·문서에 더해 **표준
  파이프라인 1개**(`STARTER_PIPELINE` 상수: nodes/edges)를 포함하며,
  `provisionSeedForUser`가 이를 owner 각인해 함께 복제한다(pipelines 1행 +
  nodes/edges). 노드의 `mounts[].blockDefId`(Agent 장착)·`config.documentId`
  (Input 참조)는 **같은 트랜잭션에서 삽입한 시드 block_def·문서의 실제 id로
  해소**한다(삽입 순서 의존). 관문 조건식의 출처 접두는 상류 노드 `name`과
  정확히 일치해야 하므로(engine.md Gate), 시드 노드명↔조건식↔채점기
  `jsonSchema`는 세트로 검증한다. 정본 원문(규칙·기술 본문·문서·템플릿)은
  저장소 루트 `seed/`에 UTF-8 파일로 두고 카탈로그가 읽어 주입한다(유지보수
  지점 1곳, Windows CLI 한글 함정 회피).
- **로컬 정본 재시드** `npm run seed:canonical`(`scripts/`) — `DEV_OWNER_ID`
  소유 block_defs·documents·document_versions·pipelines·nodes·edges·runs(+하위
  artifacts·node_runs)를 **비우고** 카탈로그를 재삽입. 멱등. 삭제는 owner
  스코프로만 한정하고(다른 owner 행 불변), 실행 시 대상 개수·이름을 출력한 뒤
  `--yes` 없으면 중단한다(실 DB 오조작 방지, CLAUDE.md 실 DB 안전규칙 정합).
  부트 마이그레이션·e2e 시드와 분리 — 콘텐츠를 스키마 마이그레이션에 싣지
  않는다.
- CLI 래퍼 `scripts/provision-user.mts <email>` — `app_users` 삽입 후 위 함수
  호출. **스왑 지점:** Phase 2b에서 GoTrue `on_auth_user_created`가 이 함수를
  호출한다. 기존 ETL 112행은 `DEV_OWNER_ID` 소유로 남긴다(시드와 분리).

## 8. 검증 — 3층 격리 (e2e + 저수준)

`e2e/phase2-isolation.spec.ts` + `x-rf-user` 테스트 헤더로 요청별 유저 전환:
1. **앱필터:** A가 만든 P_a를 B의 `GET /api/pipelines`가 못 봄, `GET/PUT/POST
   .../{P_a}/*` → 404/403.
2. **문서·블록:** A의 문서·block_def를 B가 못 봄.
3. **SSE:** A의 문서 수정 → B 구독에 `document_changed` 안 옴, A 구독엔 옴.
4. **RLS 저수준(방어선 직접):** `rf_app`으로 `set_config('…','usr_b')` 후
   `SELECT … WHERE id=P_a` → **0행**(앱 밖에서도 RLS가 막음).

## 9. 실행 슬라이스 (의존 순서 · 보안 게이트)

0. **seam 골격** — context/with-user, `resolveUserId`는 DEV_OWNER_ID 폴백
   (격리 미적용). 동작 무변화. (api-db-builder)
1. **스키마 0001** — owner_id(**nullable**)·app_users 컬럼, 기존 행 백필
   (DEV_OWNER_ID), R5 부분 유니크. **NOT NULL은 0002(슬라이스 4)로 연기** —
   각인(슬라이스 2)·러너(슬라이스 3) 이전에 NOT NULL을 걸면 앱 INSERT가
   깨진다. 각 슬라이스 e2e 그린 유지가 우선. RLS 정책 미적용. e2e seed도
   owner_id=DEV_OWNER_ID로 갱신. (api-db-builder + chore-runner)
2. **앱필터 1차** — queries 루트 필터·각인, 18라우트 `withUser`, `x-rf-user`
   전환. ★ code-reviewer 보안 게이트. (api-db-builder)
3. **러너 owner 경계(R3)** — RunControl.ownerId·runWithUser·createRun 각인·
   recoverOnBoot. ★ code-reviewer 보안 게이트. (engine-builder)
4. **RLS 활성 0002** — bootstrap 롤, ENABLE+FORCE, 정책(루트 직접+자식 조인,
   WITH CHECK), GRANT, DATABASE_URL→rf_app. ★ code-reviewer 보안 게이트.
   최대 함정: 정책이 정상 읽기/러너 쓰기를 막지 않는지. (api-db-builder+chore)
5. **SSE 스코프 + 프로비저닝 + 격리 e2e** — events owner 스코프 ∥ provision +
   phase2-isolation.spec. ★ code-reviewer + qa-verifier. (engine ∥ api-db)

**R5:** `CREATE UNIQUE INDEX one_active_run_per_pipeline ON runs(pipeline_id)
WHERE status IN ('running','waiting_human')` — 앱은 INSERT 실패를 409로 변환.
