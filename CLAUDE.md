# recruit-flow

JD + 파이프라인 조립 → 이력서 HTML을 만드는 로컬 웹앱. 레고처럼 조립
가능한 파이프라인 UI로, LLM 챗봇은 블록을 만들고 조립은 사람이 한다.

스택: Next.js(App Router) + React Flow(@xyflow/react) + SQLite/Drizzle
(better-sqlite3) + Zustand + SSE + Claude Agent SDK(TypeScript).

## 스펙 = 진실의 원천

구현 관련 모든 판단은 스펙 문서가 우선한다. 코드와 스펙이 어긋나면
스펙이 맞고, 스펙을 바꿔야 하면 **먼저 스펙을 수정하고 사용자 승인 후**
코드를 바꾼다.

- `recruit-flow-blueprint.md` — 12개 결정, 마일스톤 M1~M3
- `specs/ui.md` (+ `specs/ui-mockup.html` 시각 기준)
- `specs/nodes.md` — 8종 노드 계약
- `specs/schema.md` — 9개 테이블
- `specs/engine.md` — 러너·API·SSE

## 팀 구성 (.claude/agents)

| 에이전트 | 모델 | 담당 | 성격 |
| --- | --- | --- | --- |
| architect | opus | 작업 분해·설계 검토·스펙 공백 판정 | 읽기 전용 |
| engine-builder | opus | 러너·Agent SDK 통합·SSE·run API | 구현 |
| ui-builder | sonnet | 캔버스·팔레트·패널·채팅 독·문서 탭 | 구현 |
| api-db-builder | sonnet | Drizzle 스키마·CRUD 라우트·검증 함수·임포터 | 구현 |
| code-reviewer | opus | 스펙 위반·버그·영역 침범 판정 | 읽기 전용 게이트 |
| qa-verifier | sonnet | 앱 실기동 시나리오 검증 | 실동작 게이트 |
| chore-runner | haiku | 의존성·설정·리네임·마이그레이션 실행 | 기계적 잡무 |

모델 배정 원칙: 판단·동시성·통합의 난도가 높은 곳(설계, 러너, 리뷰
게이트)은 opus, 스펙이 계약을 다 정해준 구현은 sonnet, 판단이 없는
잡무는 haiku.

## 오케스트레이션

**메인 세션이 오케스트레이터다.** 빌더끼리 직접 통신하지 않는다 — 모든
조율·순서 결정·결과 전달은 메인 세션이 한다.

### 기능 단위 표준 플로우

```
architect(분해·계획)
   → 빌더 구현 (독립 영역이면 병렬, 같은 파일을 건드리면 worktree 격리)
   → code-reviewer(게이트: 승인/수정 필요)
   → 수정 필요 시 해당 빌더로 반환 (리뷰-수정 루프)
   → qa-verifier(실동작 검증)
   → 완료
```

- 사소한 단일 파일 수정은 architect·리뷰를 생략할 수 있다. 러너·SDK·
  스키마를 건드리면 생략 금지.
- 빌더는 자기 "소유하지 않는 영역"을 수정하지 않는다. 경계 파일(API
  계약 등)이 걸리면 메인 세션이 조정.

### 마일스톤 의존 순서 (M1 기준)

1. chore-runner: 스캐폴딩(Next.js·의존성·설정) — 단, 최초 구조 결정은
   architect 계획 후
2. api-db-builder: 스키마·마이그레이션·pipelines/graph/documents CRUD
3. 병렬: ui-builder(셸·캔버스·문서 탭) ∥ engine-builder(러너·SDK·SSE)
   — 2의 스키마·API 계약이 나온 뒤에
4. 통합: run 시작→스트리밍→다운로드 연결
5. code-reviewer → qa-verifier(M1 시나리오) → M1 완료 선언

### 마일스톤 경계

빌더가 현재 마일스톤 밖 기능을 미리 만드는 것 금지(리뷰에서 걸러냄).
v2 연기 목록(블루프린트)은 제안도 하지 않는다.

## 런타임 — Postgres (재플랫폼 Phase 1, 2026-08-16)

**데이터 레이어가 SQLite/better-sqlite3 → Postgres/postgres.js로 전환됐다**
([specs/replatform-plan.md](specs/replatform-plan.md), Phase 1). 그 결과:

- **Node 22 제약 소멸.** better-sqlite3(네이티브 ABI)가 사라져 Node 23+에서도
  세그폴트하지 않는다. `.node22` 우회, volta `distutils` 함정 등은 앱에 더 이상
  적용되지 않는다. (단, 아직 pg로 포팅 안 된 **레거시 스모크 스크립트**
  `scripts/smoke-*.mts`는 이관 대기 — 실행하려면 async 포팅 필요.)
- **DB 접속은 `DATABASE_URL`.** 기본값은 로컬 개발용
  `postgres://postgres:postgres@localhost:5433/recruit_flow`. `client.ts`가 이
  env를 읽는다(과거 `RECRUIT_FLOW_DB_PATH`는 폐지).
- **스키마 적용은 부트 시 자동.** `instrumentation.register()`가
  drizzle-kit pg 마이그레이터(`migrate(db,{migrationsFolder:"drizzle"})`)를
  돌려 백지 DB도 사용 가능하게 만든다. 수동은 `DATABASE_URL=... npm run db:migrate`.
- **로컬 Postgres는 Docker로.** 예:
  `docker run -d --name recruit-flow-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=recruit_flow -p 5433:5432 postgres:17`.
- **e2e는 전용 DB `recruit_flow_e2e`.** `playwright.config.ts`가 `DATABASE_URL`을
  주입하고 `e2e/support/start-server.mjs`가 매 실행마다 `public`·`drizzle` 스키마를
  리셋→마이그레이트→시드한다(격리). 실행 전 로컬 pg가 떠 있어야 한다.
- **SQLite 마이그레이션은 `drizzle/sqlite-archive/`에 보존**, pg는 백지 `0000`부터.
- **ETL**: 기존 sqlite 데이터를 pg로 옮기는 일회성 스크립트
  `scripts/etl-sqlite-to-pg.mts`(`sqlite3 -json` CLI로 읽어 적재).

> **Phase 2+ 예정**(replatform-plan.md): 멀티유저(owner_id·Supabase Auth·RLS),
> 지속 Node 호스트 배포, 사용자별 BYO Anthropic 키.

## 컨벤션

- UI 문구·주석·문서: 한국어. 코드 식별자: 영어.
- TypeScript strict. 타입체크 통과가 모든 작업의 최소 완료 조건.
- DB 파일 `data/recruit-flow.db`(gitignore), 스키마 변경은 반드시
  drizzle-kit 마이그레이션으로.
- **회귀 게이트**: 기능 단위 완료 시점(qa-verifier 단계)에 `npm run e2e`
  필수 실행(`specs/e2e.md` 회귀 게이트 계획 참조).
- **스크린샷 베이스라인**: 에이전트는 `--update-snapshots` 실행 금지.
  불일치 시 diff를 사용자에게 제시하고, 갱신은 사용자가 직접 명령.
- **검증은 격리 DB 필수**: qa-verifier·스모크·e2e 등 모든 검증 실행은
  실 DB(`data/recruit-flow.db`)를 절대 건드리지 않는다 — 반드시 격리
  DB(`tmp/e2e/` 등, `RECRUIT_FLOW_DB` env)로 서버를 띄운다. 2026-08-15
  실 DB에서 QA 잔해 파이프라인 4개를 청소한 재발 방지 규칙.
- **Windows CLI 한글 함정**: sqlite3·curl 등 외부 CLI에 한글을 명령행
  인자로 넘기면 cp949로 깨진 채 저장된다(U+FFFD 오염 사고 원인). 한글
  데이터 쓰기는 UTF-8 파일 경유(`sqlite3 < file.sql`) 또는 앱 API
  (`Content-Type: application/json; charset=utf-8`)로만.
- 이 저장소는 독립 git 저장소다(부모 `C:\workspaces` 저장소와 분리).
