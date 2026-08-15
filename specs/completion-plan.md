# recruit-flow 완성 계획 — 검증 부채 청산

2026-08-14 작성. 상위: `recruit-flow-blueprint.md`(결정 1, 마일스톤 M2
완료 기준) + `specs/e2e.md`.

**이 문서가 존재하는 이유**: TODO.md의 P1~P3는 전부 처리됐고 게이트도
초록이다(typecheck · e2e 18/18 · 스모크 82+38). 그런데 **그 초록이
무엇을 보증하는지가 좁다.** 아래 세 갈래를 닫기 전까지 이 프로젝트를
"완성"이라 부를 수 없다.

---

## 0. 배경 — 왜 초록을 못 믿는가

2026-08-14 TODO 처리 중 드러난 사실:

1. **재시작 후 승인하면 파이프라인이 영영 재개되지 않았다.**
   `rehydrateForApproval`이 `runHuman`을 `drive()`의 inFlight 밖에서
   띄워 완료 시 wake가 없었다. Human 노드만 `succeeded`가 되고 run은
   `running`에 영구 고착.
   그런데 이 상태로 **M2·M3 완료 선언이 났고**, code-reviewer·
   qa-verifier 게이트를 통과했고, e2e 17/17이 초록이었다.

2. **e2e 스펙이 결함을 우회하도록 쓰여 있었다.**
   `m3-chat.spec.ts`가 `page.reload()`로 SSE 유실을 덮고 있었고, 주석에
   "SSE 타이밍 이슈 우회"라고 명시돼 있었다. 테스트가 결함을 잡는 게
   아니라 **결함째로 고정**하고 있었다.

3. **회귀 테스트를 새로 써도 처음엔 버그를 못 잡았다.**
   `[c3]`을 추가하고 대조군(고치기 전 코드)을 돌렸더니 그대로 통과했다.
   대조군을 안 돌렸으면 "회귀 방지 완료"로 보고됐을 것이다.

→ **교훈(규율로 승격)**: 회귀 테스트는 **고치기 전 코드에서 실패하는
것을 확인한 뒤에만** 채택한다. 통과만으로는 아무것도 증명하지 못한다.

→ **따라서**: 같은 종류의 미검출 결함이 더 있다고 가정하고 움직인다.

---

## A. 실 LLM 검증 — M2 완료 기준 확인 (최우선)

### 왜 최우선인가

블루프린트가 정한 **M2 완료 기준**은 이것이다:

> 기존 파이프라인(작성→비평→점수게이트 루프→렌더)을 캔버스에서 재조립해
> **실제 이력서 출력 = 완전 이관 성립**

`specs/m3-plan.md` 머리말은 "M1·M2 완료 전제(스모크 73/73, **live
완전이관**, 커밋·푸시)"라고 적고 있다. 즉 원 개발기(Windows)에서는
확인됐다는 주장이 문서에 남아 있다. **그러나 현 체크아웃에서는 확인
불가능하다:**

- `data/recruit-flow.db`는 있으나 4KB 빈 SQLite(테이블 0) → 실 DB는 아직 없음
- `scripts/import-my-recruit.ts`(에이전트·증거 베이스 임포터) 미실행
- `@live` 스위트 미실행 (`playwright.config.ts`의 `grepInvert: /@live/`로
  기본 제외)

현재 초록인 18/18은 **전부 결정론적 스텁 모드**다
(`RECRUIT_FLOW_E2E_STUB=1` → `src/lib/engine/e2e-stubs.ts`). 배선·상태
전이·SSE는 검증되지만, **Claude Agent SDK가 실제로 이력서를 써내는지는
한 번도 확인되지 않았다.**

### 전제조건 (2026-08-14 확인 완료)

| 항목 | 상태 |
| --- | --- |
| my-recruit 소스 | ✅ `~/Documents/workspaces9/my-recruit` |
| `.claude/agents` | ✅ 19개 |
| `docs/resume-reference` | ✅ `experience-bank.md`·`profile.md`·`positioning.md`·`canonical-lines.md` 등 존재 |
| 임포터 기본 source 경로 | ⚠️ `C:\workspaces2\my-recruit` 하드코딩 → **`--source`로 반드시 오버라이드** |
| Claude 인증 | ❓ 미확인. `ANTHROPIC_API_KEY` 미설정 — 구독 인증(결정 2) 경로 확인 필요 |

### 작업

- [x] **A1. 임포터 실행 (실 DB 생성)**
  ```
  mkdir -p data
  npx tsx scripts/import-my-recruit.ts \
    --source ~/Documents/workspaces9/my-recruit \
    --db data/recruit-flow.db
  ```
  - 임포터는 idempotent(block_defs는 name+type upsert, document는 name
    중복 스킵)이므로 재실행 안전.
  - 검증: `block_defs` 19건 내외 + `documents`에 증거 베이스가 들어왔는지
    조회. 문서 본문이 `document_versions`에 버전으로 남는지(결정 7).
  - ⚠️ 임포터 기본 경로가 Windows 경로다. `--source`를 빼먹으면 조용히
    빈 임포트가 될 수 있으니 **임포트 건수를 반드시 확인**할 것.
  - 실증: block_defs 19, documents 17, document_versions 17, 비어 있지 않은
    본문 17, current_version 1. 두 번 더 실행해 같은 수량과 block 갱신 19 /
    document 스킵 17을 확인했다. `--db` 초기화 순서와 CJS top-level await
    결함도 실제 명령에서 발견해 `async main()` 동적 import로 수정했다.

- [x] **A2. `@live` 카나리아 실행**
  ```
  npm run e2e:live
  ```
  - `e2e/live/live-canary.spec.ts` 3건: 챗봇 `add_block`, canonical
    run(Input→Agent→Output), 엣지 삭제 요청 거절.
  - 별도 포트(3201)·별도 DB(`tmp/e2e/recruit-flow-live.db`)로 격리되므로
    A1의 실 DB를 오염시키지 않는다.
  - **구독 쿼터를 소비한다.** 실행 전 사용자 승인 필요.
  - 실패 시 그 자체가 최대 수확이다 — 스텁이 가려온 SDK 통합 결함이
    처음 드러나는 지점이기 때문.
  - 사전 점검 완료: Claude CLI 2.1.232 인증 성공, Node 22와 SDK 실행 조건,
    별도 포트 3201/격리 DB/stub=0 설정을 확인했다. 실 호출만 승인 대기다.
  - 실증: 사용자 승인 후 `npm run e2e:live -- --retries=0` 실행,
    **3/3 통과(1.4분)**.

- [ ] **A3. canonical 파이프라인 실 조립·실행 (M2 완료 기준 그 자체)**
  - A1으로 들어온 실제 에이전트 블록으로 **작성→비평→점수게이트 루프→
    렌더** 파이프라인을 캔버스에서 조립.
  - 실행해서 **이력서 HTML이 실제로 나오는지** 확인, 다운로드까지.
  - 이게 통과해야 비로소 "완전 이관 성립"이고 결정 1(실사용 도구)의
    최소 기준이다.
  - 산출물을 `specs/e2e.md`에 실증 기록으로 남긴다(V4 힐링 실증 선례).
  - 실증 완료 범위: imported writer/reviewer/recruiter-screen, Gate fail→writer
    루프 3회, Human editedContent 승인, Output/download, HTML/PNG 제목 위계.
  - 일반 목표 run은 70→75→72로 `gate_failed`. 두산로보틱스 Fullstack 실제
    JD run은 67→79까지 개선 후 3회차 rate limit을 복구했고, 보존 결과 기반
    최종 재시도는 75/80으로 `gate_failed`였다.
  - 남은 blocker는 소스 근거 자체의 측정 스코프 없는 `AI 응답 평균 2초대`와
    전후 쌍 없는 `약 50% 개선`이다. 사실을 발명해 통과시키지 않으므로 A3의
    **실제 JD Gate pass** 체크는 열어 둔다.

---

## B. 회귀 검증 5건 — 자동화 완료

TODO P1~P3에서 구현됐지만 전용 테스트가 없던 항목들이다. 2026-08-14
`completion-verification.spec.ts`·`sse-recovery.spec.ts`·
`output-heading-visual.spec.ts`로 자동 검증을 추가했다.

각 항목은 **대조군 확인이 완료 조건**이다(§0 규율).

- [x] **B1. `PUT /api/pipelines/[id]/graph` 400 검증**
  - 구현: `src/lib/validation.ts` `validateGraphPayload` +
    `src/app/api/pipelines/[id]/graph/route.ts`
  - E2E API 테스트가 5개 오류 케이스를 각각 400으로 확인한다 —
    필드 누락(`positionX`/`config`/`name`), 한 페이로드 내 중복 node id,
    존재하지 않는 노드를 가리키는 edge.
  - 정상 그래프의 200 저장과 DB 불변성도 함께 확인한다.
  - 대조군: `validateGraphPayload` 호출을 제거하면 500이 나야 한다.

- [x] **B2. artifact 없는 Human 노드 승인 버튼**
  - 구현: `src/components/panel/SidePanel.tsx`(승인 컨트롤을 아티팩트
    조건부 렌더 밖으로 분리)
  - E2E가 `waiting_human` 카드에서 사이드 패널을 열고 `human-approve`를
    실제 클릭해 하류 Output 성공까지 확인한다. 이 테스트가 카드 payload의
    `nodeId` 누락 결함도 추가로 발견했다.
  - 대조군: 승인 컨트롤을 다시 `{isHuman && artifact.format === "markdown"}`
    안으로 넣으면 실패해야 한다.

- [x] **B3. 트레이 `block_def` 브로드캐스트**
  - 구현: `src/lib/engine/events.ts` `emitToAllPipelines`/`emitBlockDef`,
    block-defs 라우트 3곳, `Palette.tsx`의 `rf:blockDefsChanged`
  - 서로 다른 pipeline 탭 2개에서 한쪽의 트레이 승인·거절이 다른 쪽
    Palette에 **새로고침 없이** 반영되는지 검증한다.
  - 대조군: `emitBlockDef` 호출을 제거하면 실패해야 한다.

- [x] **B4. SSE 끊김 후 복원**
  - 구현: open handshake → cursor snapshot → offset 멱등 병합, gap 감지 시
    스냅샷 재조회·재연결.
  - Playwright가 snapshot/buffer 경계와 CDP 강제 offline 복원을 검증한다.

- [x] **B5. DESIGN Output 제목 위계**
  - 구현: `src/lib/html/template.ts` h3 15.5pt → 12.5pt
  - 실제 HTML을 브라우저에서 렌더해 h2/h3 computed font-size를 비교하고
    PNG를 테스트 첨부물로 남긴다. A3 실제 산출물에서도 한 번 더 육안 확인한다.
  - 별건: `topicTitle` 15.5pt는 h3가 아니라 별도 `.topic-title` 클래스로
    분리해야 한다(현재는 위계 보존을 우선해 h3를 낮춰둔 상태).

---

## C. e2e 우회 패턴 감사

§0-2가 보여주듯 테스트가 결함을 덮을 수 있어 전수 감사했다.

- [x] **C1. 결함을 덮는 패턴 훑기**

  | 패턴 | 왜 의심스러운가 | 확인 방법 |
  | --- | --- | --- |
  | `page.reload()` | 실시간 갱신 결함을 새로고침으로 덮는 전형 | 제거해도 통과하는지. 통과하면 정당한 영속성 테스트, 실패하면 결함 은폐 |
  | `.first()` | `download-html` testid가 FlowNode·SidePanel 양쪽에 있어 **한쪽만 고장나도 통과**한다(specs/e2e.md 기지 사항) | testid 유일화 |
  | 과대한 timeout | 느린 게 아니라 안 되는 걸 기다리는 중일 수 있음 | 줄여도 통과하는지 |
  | API 폴링으로만 확인 | DB엔 맞게 들어갔지만 **UI엔 안 보이는** 결함을 통과시킨다 | UI 단언 추가 |

  - 남은 `reload()` 3곳은 검토 결과 **정당**하다고 판단했다
    (`m1-basic-flow.spec.ts:66` 노드 복원, `m1-canvas-edit.spec.ts:25`
    저장 유지, `m3-chat.spec.ts` 새로고침 스레드 복원). 다만 "제거하면
    실패하는가"로 재확인한 적은 없다.
  - 중복 `download-html` testid를 분리하고 `.first()`를 제거했다. API 폴링만
    하던 Human 흐름은 B2 UI 단언으로 보강했다. 문서 목록의 중복 텍스트 locator도
    고유 testid로 바꿔 retries=0 전체 E2E에서 확인했다.

- [x] **C2. 스모크 스위트에도 같은 감사 적용**
  - `smoke-engine.mts` 82건 / `smoke-chat.mts` 38건 중 **빈 배열에
    대해 자동으로 참이 되는 단언**(`every`/`!some`)이 있는지.
  - `[c3]` 작성 중 실제로 이 함정을 밟았다: 대상이 0건일 때
    `!outNrs.some(...)`가 공허하게 통과했다.
  - 대상 개수/허용 상태의 선행 조건을 추가했고 엔진 82/82·챗봇 38/38을 유지한다.

---

## D. 회귀 게이트 갭 감사 (2026-08-15 합의)

`specs/e2e.md` "회귀 게이트 계획" 절이 정책의 원천이다. 여기는 작업
항목만 추적한다.

- [ ] **D1. 스펙 1:1 대응표 작성**
  - `specs/ui.md`·`nodes.md`·`engine.md`·`schema.md` 계약 항목 ↔ e2e/스모크
    케이스 대응표를 `specs/e2e.md`에 작성. 각 항목을
    [자동화됨 / 스크린샷 회귀 / 미커버]로 분류.
  - 산출: 미커버 목록 → D4 테스트 추가의 입력.
- [ ] **D2. 스펙 미정의 실패 모드 공백 목록화**
  - 후보: 서버 크래시 후 run 상태, 동시 run 제한, 중복 승인 클릭,
    run 도중 그래프 수정, DB 잠금 경합.
  - 각각 기대 동작을 제안해 사용자 승인 → 해당 스펙에 반영 → 그 뒤에만
    테스트 작성.
- [ ] **D3. `@interaction` 스위트 신설**
  - 실제 드래그 조작(엣지 연결·팔레트 드래그 앤 드롭) 검증. 기본 게이트
    제외(`grepInvert`), 별도 명령. 20회 연속 통과 시 기본 게이트 승격.
- [ ] **D4. 갭 메우기 테스트 추가**
  - D1 미커버 항목 + 승인된 D2 실패 모드에 테스트 추가. 스크린샷 회귀
    도입(마스킹·베이스라인 사람 승인 규칙 포함). §0 대조군 규율 적용.

실행 순서: D1 ∥ D2 (독립) → D3 → D4.

---

## 실행 순서

```
A1 임포터 → A2 @live 카나리아 → A3 canonical 실행(M2 기준 확정)
                                     └→ B5 시각 확인 동반
그와 별개로 언제든: B1 → B2 → B3 → C1 → C2 → B4
```

A 갈래가 먼저인 이유: **실 LLM에서만 드러나는 결함이 있으면 B·C의
테스트를 어디에 놔야 할지가 바뀐다.** 스텁으로 촘촘히 짜놓고 나서 SDK
통합이 깨진 걸 발견하면 그 작업이 헛돈다.

B1~B3는 A와 독립이고 각각 e2e 1개 수준이라 싸다.

## 완료 기준

- **A**: 실제 JD로 이력서 HTML이 나오고 다운로드된다. 실증 기록이
  `specs/e2e.md`에 남는다.
- **B**: 5건 모두 대조군에서 실패하는 테스트를 갖는다.
- **C**: 감사 결과가 문서화되고, 은폐 패턴이 발견되면 제거 후 그 자리에
  대조군 검증된 테스트가 들어간다.

세 갈래가 닫히면 블루프린트 결정 1("실사용 도구")과 M2 완료 기준을
근거를 갖고 주장할 수 있다. 그 전까지는 "기능은 구현됨, 검증은 부분적"이
정확한 표현이다.

## 범위 밖 (v2 연기 — 블루프린트)

런타임 중 동적 노드 삽입 · LLM designer 노드 · 서브 파이프라인(그룹)
노드 · 출력 템플릿 3종+ 및 `.page` 고정박스 · 러너 워커 프로세스 분리 ·
포트폴리오 리뷰 하네스 이식 · 부분 재실행 시 재사용 출처 선택 UI ·
portfolio/headhunter 에이전트군 이관 범위 결정(`specs/m2-plan.md:21`).

## 별건 (이 문서 범위 밖의 알려진 결함)

- ~~`npm run lint`가 깨져 있다~~ → ESLint 9 flat config와 `eslint .` 직접 호출로
  복구했다. 현재 0 errors이며 기존 warning 22건은 후속 정리 대상이다.
