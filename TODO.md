# recruit-flow TODO 점검

최초 점검일: 2026-08-14 / 처리일: 2026-08-14

## 현재 상태

- 검증 기준선(macOS, Node 22.22.2 + npm 11): `typecheck` GREEN ·
  e2e **18/18** · 엔진 스모크 **82/82** · 챗봇 스모크 **38/38**.
- P1·P2·P3 전 항목 처리 완료. 아래 "처리 내역" 참조.

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

## 남은 관찰 사항 (비블로킹)

- `download-html` testid가 FlowNode·SidePanel 양쪽에 존재 — `.first()`를
  쓰는 스펙은 한쪽만 고장나도 통과한다(testid 유일화가 이상적).
- `topicTitle` 15.5pt는 h3가 아니라 별도 `.topic-title` 클래스로
  분리해야 한다(현재는 위계 보존을 우선해 h3를 12.5pt로 둠).
