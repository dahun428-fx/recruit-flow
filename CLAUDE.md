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

## 런타임 — Node 22 (중요)

**불변 조건은 하나다: 모든 node/npm/npx는 Node 22로 실행한다.**
better-sqlite3는 ABI가 맞는 Node에서만 로드되며, Node 23으로 실행하면
DB 로드 시 **세그폴트**한다. 검증(`npm run build`, dev 서버,
마이그레이션, e2e)도 예외 없이 Node 22.

Node 22를 어떻게 공급할지는 **머신마다 다르다.** 저장소 코드는 특정
경로를 가정하지 않고 `process.execPath`(현재 프로세스의 Node)를 쓴다 —
`playwright.config.ts`가 서버 런처를, 런처가 `next dev`를 같은 execPath로
스폰하므로 어느 머신에서든 자동으로 맞는다.

| 머신 | 공급 방식 | 실행 |
| --- | --- | --- |
| Windows (원 개발기) | 프로젝트 로컬 `.node22/`(gitignore). nvm-windows가 고장나 우회 설치 | `.node22\npm.cmd run ...` 또는 `$env:PATH` 앞에 `.node22` 추가 |
| macOS | volta (`node 22.x`가 이미 기본) | `npm run ...` 그대로 |

**macOS 함정 — `npm ci`가 실패한다.** volta가 물려주는 npm이 8.x면
번들된 node-gyp 9가 Python `distutils`를 요구하는데 Python 3.12+에서
제거되어 `ModuleNotFoundError: No module named 'distutils'`로 죽는다.
better-sqlite3는 prebuild가 있어 **소스 빌드가 애초에 불필요**하므로,
최신 npm으로 설치하면 그냥 통과한다:

```
npx -y npm@11 ci     # 또는 volta install npm@11 로 영구 고정
```

## 컨벤션

- UI 문구·주석·문서: 한국어. 코드 식별자: 영어.
- TypeScript strict. 타입체크 통과가 모든 작업의 최소 완료 조건.
- DB 파일 `data/recruit-flow.db`(gitignore), 스키마 변경은 반드시
  drizzle-kit 마이그레이션으로.
- 이 저장소는 독립 git 저장소다(부모 `C:\workspaces` 저장소와 분리).
