# recruit-flow e2e + AI 자동 힐링

2026-08-07 도입. 실제 브라우저(Playwright/Chromium) UI 검증 층 + 실패 시
AI가 자동 수정하는 힐링 루프. 스모크(엔진 73·챗 38)가 못 덮는 UI·HTTP
경로를 덮는다.

## 명령 (★ 반드시 Node 22: `.node22\npm.cmd run ...`)

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

## 테스트 맵 (17 케이스, 스펙 출처)

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

## e2e가 발견한 실 앱 결함 (후속 대상, 스펙은 우회)

1. SSE 경쟁 조건(ChatDock/usePipelineStream): hydration~effect 사이 발행
   이벤트 유실, `onerror` 재조회 없음.
2. SidePanel Human 승인 버튼: artifact 없으면 조건부 렌더에서 제외.
3. `useRunStream`: waiting_human 이후 SSE 재구독 누락.
4. transient 카드(card_human 등) SSE 끊김 후 복원 불가.

(참고: `download-html` testid가 FlowNode·SidePanel 양쪽에 있어 `.first()`
사용 스펙은 한쪽만 고장나도 통과 — testid 유일화가 이상적.)
