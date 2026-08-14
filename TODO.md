# recruit-flow TODO 점검

최초 점검일: 2026-08-14 / 처리일: 2026-08-14

## 현재 상태

- 검증 기준선(macOS, Node 22.22.2 + npm 11): `typecheck` GREEN ·
  e2e **29/29(retries=0)** · 엔진 스모크 **82/82** · 챗봇 스모크 **38/38**.
- P1·P2·P3 전 항목 처리 완료. 아래 "처리 내역" 참조.

> **주의 — 이 초록이 보증하는 범위는 좁다.**
> e2e 18/18은 전부 **결정론적 스텁 모드**다. 실 LLM으로 이력서를 뽑은
> 적이 이 체크아웃에는 없고(`data/` 없음, 임포터·`@live` 미실행),
> 위 처리 내역 중 5건은 **그 항목만 겨냥해 실패하는 테스트가 없다.**
> 남은 검증 부채와 실행 순서는 **[specs/completion-plan.md](specs/completion-plan.md)** 참조.

## 처리 내역 (2026-08-14)

### P1 — 동작 결함 및 복구 안정성

- [x] SSE 경쟁 조건 수정 — **구독 선행 + 버퍼 병합**(engine.md §3).
      `usePipelineStream`·`useRunStream` 모두 구독을 먼저 열고 도착
      이벤트를 버퍼에 쌓은 뒤 `스냅샷 → 버퍼` 순으로 적용(id 중복 제거).
      `m3-chat.spec.ts`의 `page.reload()` 우회 2건 제거로 실증.
- [x] `waiting_human` 이후 SSE 재구독 — 종결 상태(succeeded/failed/
      cancelled)에서만 구독을 끊도록 변경. 서버 라우트는 원래부터
      `waiting_human`에 스트림을 유지하고 있었고(`runs/[id]/events:66`),
      결함은 클라이언트에만 있었다.
- [x] transient 카드 복원 — 끊김 시 스냅샷 재조회 후 재연결(양 훅 동일).
      `card_human`은 원래 DB에 있었고(`events.ts:110`) 문제는 재조회
      경로 부재였다. TODO의 "영속화 필요"는 오진이었다.
- [x] artifact 없는 Human 노드의 승인 버튼 — 승인 컨트롤을 아티팩트
      조건부 렌더 밖으로 분리. 아티팩트 형식(json 등)과도 무관해졌다.
- [x] 그래프 PUT 500 — **오진 정정**. `saveGraph`의 PK 재사용 문제가
      아니다(delete→insert가 한 트랜잭션이라 재현되지 않음). 실제 원인은
      **PUT 라우트에 구조 검증이 없어** DB 제약 위반이 그대로 500이 된
      것. 필수 필드·중복 id·dangling edge를 400으로 처리(engine.md §2).

### P2 — 상태 정확성 및 회귀 방지

- [x] `gateDecision` DB 저장 — `node_runs.gate_decision` 컬럼 추가
      (마이그레이션 `0001`). 재하이드레이션이 휴리스틱 대신 DB를 읽는다.
      **이건 polish가 아니라 정확성 버그였다**: maxLoops 소진 시 Gate는
      succeeded+fail로 마감하는데 휴리스틱("최대 회차=pass")이 이를
      pass로 뒤집어, 재개 후 gate_failed인데도 Output이 실행됐다.
- [x] Gate+Human 재하이드레이션 회귀 테스트 — `smoke-engine.mts` `[c3]`.
      **대조군으로 실패를 확인**: 휴리스틱 복원 시 FAIL 2
      (`outNrs=1:succeeded`), 재개 wake 제거 시 FAIL 1 (timeout).
- [x] 트레이 승인 PATCH/DELETE의 SSE 미러 — `block_def` 이벤트를 열려
      있는 **모든** pipeline 채널에 브로드캐스트(block_defs는 전역
      테이블이라 특정 채널을 고를 수 없다). Palette가 `rf:blockDefsChanged`
      로 재조회.
- [x] 의존성 설치 후 재검증 — 완료(위 기준선).

### P3 — UI 및 출력 품질

- [x] DESIGN Output 제목 크기 역전 — h3 15.5pt → **12.5pt**로 내려
      `h1 > h2(14.5) > h3(12.5) > body(10.2)` 위계 복원.

## 이번에 새로 발견해 함께 고친 것

- [x] **재시작 후 승인 시 파이프라인 미재개**(러너, P1급).
      `rehydrateForApproval`이 `runHuman`을 `drive()`의 inFlight 밖에서
      띄워 완료 시 wake가 없었다 → Human만 succeeded가 되고 run은
      `running`에 영구 고착. `.finally`로 wake 추가.
      **이 결함이 gate_decision 결함을 가리고 있었다** — 하류가 아예 돌지
      않아 잘못된 라우팅이 드러나지 않았다.
- [x] **마이그레이션 첫 파일만 적용** — `e2e/support/start-server.mjs`가
      `.sort()[0]`, 스모크 2종이 `0000_...sql` 하드코딩. 새 마이그레이션이
      조용히 무시되던 구조. 전부 순서대로 적용하도록 수정.
- [x] **저장소의 Windows 경로 하드코딩** — `playwright.config.ts` 등
      3곳의 `.node22/node.exe`를 `process.execPath`로 교체. 원 의도("서버
      런처를 반드시 Node 22로")를 더 정확히 표현하며 Windows·macOS 양쪽
      에서 동작한다. 이 수정 전까지 macOS에선 e2e가 아예 기동되지 않았다.

## 환경 메모 (macOS)

`npm ci`는 **npm 8 + Python 3.12+ 조합에서 실패**한다(node-gyp 9가
제거된 `distutils`를 요구). better-sqlite3는 prebuild가 있어 소스 빌드가
불필요하므로 최신 npm이면 통과: `npx -y npm@11 ci`. CLAUDE.md에 기록.

## v2 이후로 연기된 제품 범위 (변경 없음)

- [ ] 런타임 중 동적 노드 삽입.
- [ ] LLM designer 노드.
- [ ] 서브 파이프라인(그룹) 노드.
- [ ] 출력 템플릿 3종 이상 및 `.page` 고정박스 레이아웃.
- [ ] 러너를 Next 서버 프로세스에서 별도 워커 프로세스로 분리.
- [ ] 포트폴리오 리뷰 하네스 이식.
- [ ] 부분 재실행 시 재사용 출처 선택 UI (`specs/ui.md:253`).
- [ ] portfolio/headhunter 에이전트군의 앱 내 정식 이관·활성화 범위 결정.

## 다음 할 일 — 완성 판정을 위한 실행 TODO

상세 근거: **[specs/completion-plan.md](specs/completion-plan.md)**

아래 항목은 단순히 테스트가 초록인 것으로 끝내지 않는다. 회귀 테스트는
가능하면 **수정 전 구현에서 실패하는 대조군**을 확인하고, 각 체크박스는
산출물·검증 결과가 함께 남았을 때만 닫는다.

### D — 먼저 닫아야 할 현재 정확성 결함

- [x] **D1. SSE 스냅샷/버퍼 병합을 실제로 멱등하게 만든다.**
  - 범위: `useRunStream`·`usePipelineStream`과 필요한 SSE 타입/서버 이벤트.
  - 현재 위험: delta가 DB 스냅샷에 이미 포함됐는데 버퍼에서 다시 append되면
    아티팩트 내용이 중복되고, 오래된 상태 이벤트가 최신 스냅샷을 되돌릴 수 있다.
  - 완료 조건: 이벤트 id/offset 기반 병합 또는 동등하게 증명 가능한 프로토콜로
    중복 delta와 상태 역행이 모두 불가능해야 한다.
  - 검증: 스냅샷 응답 직전 delta를 의도적으로 발생시키는 회귀 테스트가 수정
    전에는 실패하고 수정 후 통과한다.
  - 담당: `sse_recovery` 서브에이전트. 의존성: 없음.

- [x] **D2. SSE 강제 단절 후 REST 복원·재구독을 자동 검증한다(B4).**
  - 완료 조건: events 요청을 abort/offline 처리한 뒤 UI가 DB 스냅샷으로 복원되고,
    이후 새 이벤트까지 새로고침 없이 수신한다.
  - 검증: Playwright 집중 실행 + D1 경계 테스트.
  - 담당: `sse_recovery`. 의존성: D1.

### B — 구현됐지만 아직 증명되지 않은 수직 회귀 테스트

- [x] **B1. Graph PUT 구조 검증 E2E를 추가한다.**
  - 케이스: `positionX`/`config`/`name` 누락, 중복 node id, dangling edge는
    각각 400이며 정상 그래프는 200이어야 한다.
  - 대조군: `validateGraphPayload` 호출 제거 시 적어도 결함 케이스가 실패해야 한다.
  - 파일 후보: graph route·`validation.ts`·신규 E2E API 스펙.
  - 담당: `verification_slices`. 의존성: 없음.

- [x] **B2. artifact 없는 Human을 실제 UI 버튼으로 승인한다.**
  - 완료 조건: Human 노드 선택 → `human-approve` 클릭 → 하류 Output 성공을
    API 승인이나 `page.reload()` 없이 UI에서 확인한다.
  - 대조군: 승인 컨트롤을 artifact 조건 안으로 되돌리면 실패해야 한다.
  - 담당: `verification_slices`. 의존성: 없음.

- [x] **B3. `block_def` 크로스탭 브로드캐스트를 검증한다.**
  - 완료 조건: 두 탭/컨텍스트 중 한쪽에서 승인·거절했을 때 다른 쪽 Palette가
    새로고침 없이 추가/제거를 반영한다.
  - 대조군: `emitBlockDef` 호출 제거 시 실패해야 한다.
  - 담당: `verification_slices`. 의존성: 없음.

- [x] **B5. Output 제목 위계를 렌더 산출물로 확인한다.**
  - 완료 조건: h1 > h2(14.5pt) > h3(12.5pt) > body(10.2pt)가 실제 HTML/CSS
    산출물에서 확인되고, 가능하면 스냅샷 또는 브라우저 computed-style 단언으로 남는다.
  - `topicTitle`은 h3와 분리할지 함께 결정하고 회귀 테스트로 고정한다.
  - 담당: `quality_audit`. 의존성: 없음(A3에서 육안 재확인).

### C — 품질 게이트와 테스트 신뢰성

- [x] **C0. lint 명령을 현재 Next/ESLint 조합에 맞게 복구한다.**
  - 완료 조건: `npm run lint`가 실제 `src`·`e2e`·`scripts`를 검사하고 exit 0.
  - 검증: lint + typecheck + build.
  - 담당: `quality_audit`. 의존성: 없음.

- [x] **C1. E2E 우회 패턴을 전수 감사한다.**
  - 대상: `page.reload()`·`.first()`·과대한 timeout·API 폴링만 있는 단언.
  - 완료 조건: 각 사용처를 정당/은폐 위험으로 분류하고, 위험한 사용처는 UI
    단언 또는 유일한 testid로 교체하며 결과를 `specs/e2e.md`에 남긴다.
  - 담당: `quality_audit`. 의존성: B1~B3 결과와 충돌 없이 병합.

- [x] **C2. 스모크 단언의 공허한 통과를 감사한다.**
  - 대상: 빈 배열에서도 참이 되는 `every`/`!some`, 대상 개수 선행 단언 없는 검사.
  - 완료 조건: 각 대상 집합에 존재성/개수 단언을 먼저 두고 82/82·38/38을 유지한다.
  - 담당: `quality_audit`. 의존성: 없음.

### 로컬 자동 검증 체크포인트

- [x] D·B·C 변경을 합친 뒤 `npm run lint`와 `npm run typecheck`가 통과한다.
- [x] `npm run build`가 통과한다.
- [x] 결정론 E2E 전체가 통과하고 새 회귀 케이스 수가 결과에 반영된다.
- [x] 엔진·챗봇 스모크가 각각 82/82·38/38 이상으로 통과한다.
- [x] 대조군 확인 결과와 테스트 감사 결과를 `specs/e2e.md`에 기록한다.

### A — 실제 LLM 완전 이관 검증 (외부 비용·인증 승인 게이트)

- [x] **A1. 실제 소스를 임포트해 검증용 DB를 만든다.**
  - 명령: `npx tsx scripts/import-my-recruit.ts --source
    ~/Documents/workspaces9/my-recruit --db data/recruit-flow.db`.
  - 완료 조건: block_defs 약 19건, documents와 document_versions의 실제 본문,
    재실행 idempotency를 수량으로 확인한다.
  - 주의: 개인 데이터가 들어가는 로컬 DB 생성이므로 실행 직전 대상 경로를 확인한다.
  - [x] 사전 점검: agents 19개, resume-reference 문서 17개, 빈 파일·중복 name 0.
  - [x] `--db`가 정적 import보다 늦게 적용되던 초기화 순서 결함 수정.
  - [x] 실제 import와 2회 재실행: 19/17/17 수량·본문·v1·idempotency 확인.

- [x] **A2. 사용자 승인 후 `@live` 카나리아 3건을 실행한다.**
  - 사전 조건: Claude 인증 경로 확인, 구독 쿼터 소비 승인.
  - 완료 조건: 실 챗봇 add_block과 Input→Agent→Output canonical run 통과.
  - 실패 시 로그에서 SDK/인증/도구/스트리밍 실패를 구분해 회귀 항목으로 환류한다.
  - [x] 사전 점검: 3개 live 테스트 발견, 포트/DB 격리와 Claude CLI 인증 확인.
  - [x] 구독 쿼터 승인 후 실제 실행: 3/3, retries=0, 1.4분.

- [ ] **A3. 실제 블록으로 canonical 파이프라인을 조립·실행한다.**
  - 흐름: 작성 → 비평 → 점수 Gate 반복 → Output 렌더 → HTML 다운로드.
  - 완료 조건: 실제 JD 기반 이력서 HTML 산출, Gate 반복과 Human 경로 확인,
    다운로드 파일 및 B5 제목 위계 육안 검증.
  - 산출물·환경·실행 결과를 `specs/e2e.md`에 기록한다.
  - 의존성: A1, A2, 로컬 자동 검증 체크포인트.
  - [x] imported writer/reviewer/recruiter-screen으로 실제 3회 Gate 루프 실행.
  - [x] Human 편집 승인 → Output → download route → HTML/PNG 제목 위계 확인.
  - [x] 두산로보틱스 Fullstack 실제 JD로 67→79점 개선 및 rate-limit 복구 실증.
  - [ ] 실제 JD Gate pass: 최종 재시도 75/80. 근거 문서의 측정 스코프·전후
    수치 쌍이 없어 MUST blocker 2건이 남음(근거를 발명하지 않고 미완료 유지).

### 최종 완료 판정

- [x] D1~D2, B1~B5, C0~C2가 모두 닫혔다.
- [ ] A1~A3가 승인된 실제 환경에서 완료됐다.
- [x] lint·typecheck·build·E2E·스모크가 모두 초록이고 작업 트리가 의도한
  변경만 포함한다.
- [x] `specs/completion-plan.md`와 `specs/e2e.md`가 현재 자동 검증 증거를 반영한다.
- [ ] 위 조건을 만족한 뒤에만 프로젝트 상태를 “완성”으로 변경한다.

## 남은 관찰 사항 (비블로킹)

- `download-html` testid가 FlowNode·SidePanel 양쪽에 존재 — `.first()`를
  쓰는 스펙은 한쪽만 고장나도 통과한다(testid 유일화가 이상적).
- `topicTitle` 15.5pt는 h3가 아니라 별도 `.topic-title` 클래스로
  분리해야 한다(현재는 위계 보존을 우선해 h3를 12.5pt로 둠).
- `npm run lint` 깨짐 — `next lint`가 Next 16에서 제거됨. `eslint` 직접
  호출로 교체 필요(이번 작업과 무관한 기존 상태).
