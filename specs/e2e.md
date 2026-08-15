# recruit-flow e2e + AI 자동 힐링

2026-08-07 도입. 실제 브라우저(Playwright/Chromium) UI 검증 층 + 실패 시
AI가 자동 수정하는 힐링 루프. 스모크(엔진 73·챗 38)가 못 덮는 UI·HTTP
경로를 덮는다.

## 명령 (★ 반드시 Node 22 — 공급 방식은 머신별, CLAUDE.md 참조)

| 명령 | 용도 |
| --- | --- |
| `npm run e2e:install` | 최초 1회 — Chromium 설치 |
| `npm run e2e` | 결정론 스텁 모드 e2e(기본, `@live` 제외) |
| `npm run e2e:live` | `@live` 태그만 — 실 LLM(구독 쿼터 소비) |
| `npm run e2e:heal` | e2e 실패 시 AI 자동 수정 루프(아래) |

## 결정론 스텁 모드

`RECRUIT_FLOW_E2E_STUB=1`이면 `src/instrumentation.ts`가
`src/lib/engine/e2e-stubs.ts`를 설치 — 기존 globalThis seam(sdk.ts/chat.ts)을
재사용하므로 **앱 코드 무수정**, env 미설정 시 import조차 안 됨(프로덕션
무영향, `next build`·스모크 무회귀로 확인).

- **Agent 스텁**: 노드 role의 `[E2E:*]` 마커로 결정론 출력.
  `[E2E:writer]`(고정 markdown, 재작성 회차엔 `[개선판]`) ·
  `[E2E:scorer-a|b]`(입력에 `[개선판]` 있으면 PASS 90, 없으면 FAIL 40) ·
  `[E2E:scorer-alwaysfail]`(항상 FAIL→gate_failed) · `[E2E:slow]`(지연+abort,
  중단 테스트) · `[E2E:gap]`(askHuman, 갭 인터뷰).
- **챗 스텁**: userText 패턴 → 실제 챗봇 tool 핸들러 직접 호출(add_block·
  register_document·trigger_run), "연결/삭제"는 거절 텍스트.

## 구성

- `playwright.config.ts`(포트 3200, workers 1, retries 1, JSON 리포터) +
  `playwright.live.config.ts`(포트 3201, `@live`).
- `e2e/support/`: `start-server.mjs`(격리 DB `tmp/e2e/*.db` 마이그레이션+
  시드→next dev 스폰, **Node 22 절대경로**) · `seed.mjs` · `api.ts`(그래프
  PUT·run 폴링) · `fixtures.ts`(파이프라인 픽스처).
- 전략: **배선은 API(putGraph)로 세팅, UI는 렌더·실행·상태를 검증**(React
  Flow 드래그 flakiness 격리). 고정 sleep 금지 — locator auto-wait·expect.poll.
- ★ e2e는 **다른 next dev가 떠 있으면 실패**(`.next/dev` 락은 프로젝트당 1개).
  실행 전 수동 dev 서버를 종료할 것.

## 테스트 맵 (29 케이스, 스펙 출처)

m1-basic-flow(M1 완료기준: 문서→실행→상태·스트리밍→다운로드→복원→중단) ·
m1-canvas-edit · m2-gate-loop(fail→재작성→회차칩→pass / gate_failed) ·
m2-partial-rerun · m2-human · m3-chat(블록 add→트레이·문서등록·작성해줘·
스레드 복원) · m3-gap-interview · live-canary(@live 3건).

## AI 힐링 루프 (`scripts/e2e-heal.mts`)

`npm run e2e:heal` — e2e 실패 → `claude -p`(headless, 구독 인증)가 실패
로그·트레이스 보고 **src/·e2e/ 수정** → 재검증(typecheck+smoke 73/38) →
초록이면 자동 커밋. 최대 3회, 지속 실패 시 `e2e-heal-report.md`.

안전장치: clean-tree preflight · `acceptEdits`+allowedTools 화이트리스트 ·
금지경로(specs/·drizzle/·인프라) diff 가드·롤백 · 테스트 완화 금지(스펙
모순은 보고).

### 실증 (2026-08-07)

run 버튼을 `disabled={true}`로 고장 → m1 e2e 실패("element is not
enabled") → `claude -p`가 원인 진단·`disabled={!run.canRun || run.busy}`로
수정 → typecheck GREEN + m1 e2e 통과. **AI가 실패를 읽고 앱을 고쳐 통과**
실증됨.

**주의(실행 창)**: 완전 자동 `e2e:heal`(실패 스위트 + claude 수정 +
재검증)은 수 분 걸리므로 **사용자 터미널에서 실행**한다. Claude Code 세션의
백그라운드 실행 창(~10분)으론 한 번에 완주가 어려울 수 있다(루프 자체·구성
요소는 검증됨).

## e2e가 발견한 실 앱 결함 → **해결(2026-08-14)**

1. ~~SSE 경쟁 조건(ChatDock/usePipelineStream)~~ → **해결**: 구독 선행 +
   버퍼 병합(engine.md §3). `page.reload()` 우회 2건 제거.
2. ~~SidePanel Human 승인 버튼: artifact 없으면 렌더 안 됨~~ → **해결**:
   승인 컨트롤을 아티팩트 조건부 렌더 밖으로 분리.
3. ~~`useRunStream`: waiting_human 이후 SSE 재구독 누락~~ → **해결**:
   종결 상태(succeeded/failed/cancelled)에서만 구독 종료.
4. ~~transient 카드 SSE 끊김 후 복원 불가~~ → **해결**: 끊김 시 스냅샷
   재조회 후 재연결(양 훅 동일 절차). `card_human`은 원래 DB에 있었고,
   문제는 재조회 경로 부재였다.

### 이 과정에서 새로 발견·수정된 결함

5. **재시작 후 승인 시 파이프라인이 재개되지 않음**(러너).
   `rehydrateForApproval`이 `runHuman`을 `drive()`의 inFlight 밖에서
   띄워, 완료 시 wake가 없어 드라이버가 `waitForWake`에 영구 정박했다.
   Human만 succeeded가 되고 run은 `running`에 고착. → `.finally`로 wake.
   이 결함이 4번·gate_decision 결함을 **가리고 있었다**(하류가 아예 안
   돌아서 잘못된 라우팅이 드러나지 않음).
6. **마이그레이션을 첫 파일만 적용**: `start-server.mjs`·스모크 2종이
   `.sort()[0]` / 파일명 하드코딩이라 0001 이후가 적용되지 않았다.
   → 전부 순서대로 적용.
7. **`PUT /graph` 구조 검증 부재**: 필드 누락·중복 id가 DB 제약 위반
   그대로 500이 됐다(engine.md §2). → 400 + 사유.

검증 규율: 회귀 테스트는 **고치기 전 코드에서 실패하는 것을 확인**한 뒤
채택한다(대조군 실행). 통과만으로는 아무것도 증명하지 못한다.

## 검증 부채 자동화 보강 (2026-08-14)

- `e2e/completion-verification.spec.ts` 8건: Graph PUT 오류 5종과 정상 저장,
  artifact 없는 Human의 실제 UI 승인, 서로 다른 pipeline 탭의 트레이 승인·거절
  브로드캐스트를 검증한다. 이 과정에서 `card_human` payload의 `nodeId` 누락도
  발견해 수정했다.
- `e2e/sse-recovery.spec.ts` 2건: SSE open 이후 snapshot 경계에서 cursor/offset
  병합이 중복·상태 역행을 막는지, CDP 강제 offline 뒤 REST 복원·재구독으로
  승인 이후 이벤트를 다시 받는지 검증한다.
- `e2e/output-heading-visual.spec.ts` 1건: 실제 HTML 렌더의 computed style로
  `h2 > h3` 위계를 확인하고 PNG를 테스트 첨부물로 남긴다.
- `download-html` testid를 `download-html-node`/`download-html-panel`로 분리하고
  `.first()` 우회를 제거했다. 문서 목록도 고유 testid로 지정해 strict locator의
  간헐 충돌을 제거했다.
- 스모크의 `every`/`!some` 단언은 대상 개수 또는 허용 상태를 먼저 확인하도록
  보강했다. lint는 ESLint 9 flat config로 복구했다.

통합 재검증: lint 0 errors(기존 warning 22) · typecheck GREEN · build GREEN ·
결정론 E2E **29/29, retries=0** · 엔진 스모크 **82/82** · 챗봇 스모크 **38/38**.

### 실제 데이터·LLM 실증 (2026-08-14)

- `my-recruit`에서 agent 19개와 resume-reference 문서 17개를
  `data/recruit-flow.db`에 임포트했다. block_defs 19 · documents 17 ·
  document_versions 17 · 비어 있지 않은 본문 17 · current_version 모두 1이며,
  두 차례 재실행 후 수량 불변(block 갱신 19/document 스킵 17)을 확인했다.
- `npm run e2e:live -- --retries=0`: 실제 Claude 인증으로 live 카나리아
  **3/3 통과(1.4분)** — add_block, Input→Agent→Output, 엣지 삭제 요청 거절.
- 실제 imported agent canonical 실행:
  - 일반 목표 run `CO6tVC3v_d8_WQ0sduzBF`: recruiter 70→75→72,
    maxLoops=3 후 `gate_failed`; Gate decision 3건 모두 DB에 `fail`로 보존.
  - 최종 writer Markdown을 Human이 편집 승인한 run
    `3UQemOX1xIn5KPb9fptsI`은 succeeded. Output HTML 30,469B를 download route로
    내려받았고 h1/h2/h3 `28/19.3333/16.6667px`, PNG 육안 레이아웃을 확인했다.
  - 두산로보틱스 Fullstack 실제 JD run은 67→79로 개선 후 외부 rate limit을
    만났으며, cooldown 뒤 보존 결과 기반 최종 재시도 `2cKz81Quuy1tW4_XKs8sH`
    는 SDK 오류 없이 75/80으로 `gate_failed`였다.
  - 남은 차단 사유는 측정 스코프 없는 `AI 응답 평균 2초대`와 전후 수치 쌍이
    없는 `약 50% 개선`. 근거를 발명하지 않기 위해 A3 Gate pass는 미완료다.
  - 재현 하네스: `scripts/run-canonical-live.mts`,
    `scripts/render-canonical-live.mts`; 산출물은 gitignored `tmp/canonical-live/`.

## 회귀 게이트 계획 (2026-08-15 합의)

이 스위트의 공식 역할은 **회귀 방지 게이트**다. 강제 지점은 CI·훅이
아니라 규약이다: **기능 단위 완료 시점(qa-verifier 단계)에
`npm run e2e`를 필수 실행**한다. 실행 시간 예산은 두지 않는다 —
커버리지가 우선이다.

### 갭 감사 3축

기존 스위트를 다음 세 잣대로 감사해 공백만 추가한다(기존 테스트 유지).
작업 항목은 `completion-plan.md` D 갈래.

1. **스펙 1:1 대응표** — `specs/ui.md`·`nodes.md`·`engine.md`·`schema.md`의
   계약 항목별로 [자동화됨(케이스 링크) / 스크린샷 회귀 / 미커버]를 표로
   만든다. 대응표는 이 문서에 유지하고, 스펙이 바뀌면 표도 같이 갱신한다.
2. **상호작용 충실도** — `putGraph()` 우회가 못 덮는 실제 사용자 조작
   (엣지 드래그 연결, 팔레트 드래그 앤 드롭 등)을 검증한다. flaky 위험이
   있으므로 **`@interaction` 태그로 분리해 기본 게이트에서 제외**하고
   별도 명령으로 실행한다. 승격 기준: 20회 연속 통과 후에만 기본
   게이트 편입.
3. **실패 모드** — 스펙이 정의한 실패(gate_failed·중단·SSE 단절 등)는
   바로 테스트. **스펙이 침묵하는 실패 모드**(서버 크래시 후 run 상태,
   동시 실행 제한, 중복 승인 클릭 등)는 테스트를 먼저 쓰지 않는다 —
   공백을 목록화하고 기대 동작을 제안해 **사용자 승인으로 스펙에 반영한
   뒤** 테스트를 쓴다(스펙=진실의 원천 규약).

### 스크린샷 회귀 정책

자동화 불가/저효율 시각 항목(목업 대조·노드 상태 색 등)은 Playwright
`toHaveScreenshot`으로 커버한다. 단일 게이트 머신(Windows) 전제라
OS/폰트 편차는 통제 가능하다.

- 동적 콘텐츠(타임스탬프·run id·스트리밍 텍스트)는 mask 처리.
- ★ **에이전트는 `--update-snapshots` 실행 금지**(e2e:heal 포함).
  스크린샷 불일치 시 에이전트는 diff 이미지를 사용자에게 제시하고
  멈춘다. 베이스라인 갱신은 사용자가 직접 명령했을 때만.

### 범위 외

- 실 LLM: `@live` 카나리아 3건 현상 유지. A3 canonical 완주는
  `completion-plan.md`에서 별도 추적.
- 회귀 테스트 채택 규율(고치기 전 코드에서 실패 확인)은 기존과 동일.
