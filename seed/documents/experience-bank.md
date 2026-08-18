# Experience Bank

This file stores reusable evidence for resumes, self-introductions, and cover
letters. Each entry should be factual enough to support multiple tailored
versions.

## How To Add An Entry

Use this structure:

```markdown
## Project / Experience Name

- Period:
- Context:
- Problem:
- Role:
- Actions:
- Technologies:
- Result:
- Metrics:
- Evidence / links:
- Reusable keywords:
- Notes for tailoring:
```

## Entries

Rows and sections marked `TBD` are placeholders and must not be used as source
facts in drafted application text.

### AI 건강검진 챗봇 제품화 및 플랫폼 확장

- Period: 2025.07 ~ 2025.10
- Context: 대웅제약 AI추진팀 / AI 헬스케어·B2B 플랫폼 (신규 고객사 웰체크 온보딩 포함, user-attested 2026-07-23 — headhunter-advisor 인터뷰에서 사용자 직접 확인)
  **[병합 노트 — user-attested 2026-07-24, grill-me base-resume 세션]**: AI 건강검진
  챗봇 = AI코치는 동일 서비스임을 소유자가 확인. "2025 대웅제약 성과 평가 기반 사업
  기여" 항목(아래)의 "AI코치 신규 화면 11건·기능 13건" 수치는 이 서비스의 수치.
  두 항목 간 상호 참조: AI코치 화면·기능 건수는 해당 항목 Metrics를 참조.
  프로젝트 목표: MVP 정의 → PoC 검증 → 10주 내 실서비스 전환.
  (user-attested 2026-07-24, grill-me base-resume 세션)
  **[조직 구조 — user-attested 2026-07-27, 이력서 재작성 세션에서 소유자 구두
  확인, 문서 근거 없음]**: 대웅제약 AI추진팀 내 "다나아데이터 스쿼드" 소속.
  규모: 부서 20명 / 스쿼드 10명(EXP-03의 "FE AX SOP·Playwright 검증 체계는
  팀원 10명 전원 채택"과 동일 스쿼드 규모 — 상호 참조). 담당 범위: 비즈36.5·
  AI코치·바이오에이지 3개 서비스 FE 총괄 — 에스크미는 이 총괄 범위에 포함되지
  않으며 EXP-06 기준 별도 유지보수 지원 성격으로 일관됨(모순 없음). 이 조직
  정보는 대웅제약 재직 기간 전반의 프로젝트 항목(EXP-01/EXP-02/EXP-03/EXP-06/
  EXP-07)에 공통 적용됨.
- Problem: 목업 수준의 AI 건강검진 챗봇을 실사용 가능한 서비스로 고도화해야 했고, LLM 답변 지연, Markdown/표/링크 렌더링, 오류 대응, 고객사별 화면 확장 구조가 부족했다.
- Role: 프론트엔드 유일 담당자로 FE 기술적 의사결정권을 가지고 아키텍처 설계·분석부터 구현·테스트까지 독립적으로 수행, BE/LLM 개발자와 협의하며 AI/백엔드 응답 정책 조율 및 LLM/BE 로직 일부에 참여(팀 공동 기여, 단독 구축 아님), 서비스 품질 및 확장 구조 구축 (user-attested 2026-07-23 — headhunter-advisor 인터뷰에서 사용자 직접 확인)
- Actions:
  - AI 개발자와 API 응답 형식, 스트리밍, 오류 정책 조율
  - SSE 기반 실시간 응답, 답변 중지/재시도/오류 상태를 포함한 대화 흐름 설계
  - Markdown 전용 렌더링 계층 구축, 표/목록/링크/차트의 React 컴포넌트 변환
  - XSS 필터링, 404/500/LLM 오류 가드레일 적용
  - React Query 캐싱, 코드 스플리팅, 이미지 최적화, HTTP/2 전환
  - Base-Theme과 Config-Driven UI로 고객사별 테마/문구/기능 노출 조건 분리 — 전사 요구사항인 "기능별로 차별점을 두어 애플리케이션 가격을 매기고 싶다"(기능별 차등 가격 정책)에 대응하기 위해 feature flag 형태로 구현, 운영/기획자가 FE 단에서 기능을 분할·제한할 수 있도록 설계 (user-attested 2026-07-23 — headhunter-advisor 인터뷰에서 사용자 직접 확인)
  - 위 Config-Driven UI 전환을 위해 이미 완성돼 있던 챗봇 소스코드의 상당 부분을 수정하는 대규모 리팩토링 수행 (user-attested 2026-07-23 — headhunter-advisor 인터뷰에서 사용자 직접 확인)
  - **[컴포넌트 추상화 수준 제한]** 비슷하게 생긴 UI라도 모두 공통화하지
    않고 "변경 이유가 같은 것만" 공통화하는 기준 적용. 과공통화 시
    variant/type/mode/isSpecialCase props가 늘어나는 거대 컴포넌트가 되고,
    공통화 전무 시 동일 수정을 반복하는 트레이드오프 판단. Config-Driven
    UI·Base-Theme 기반 공통 컴포넌트 구조(이 EXP-01 Actions)와 정합적인
    설계 원칙. 검증 관점: 신규 요구 시 변경 파일 수·조건 분기 증가
    여부·회귀 범위
    (user-attested 2026-07-23 — headhunter-advisor 인터뷰)
    **[적용 범위 가드레일 — user-attested 2026-08-12, 네이버웹툰 지원 세션
    적대 검증 갭 확인]** 이 "변경 이유가 같은 것만" 기준은 **이 챗봇
    프로젝트(EXP-01) 내부 UI 공통화 판단에 한정**해 수립·적용됐다. 이후
    비즈36.5·AI코치·바이오에이지 3개 서비스에 걸친 공통 컴포넌트 레이어
    (EXP-03의 Storybook 기반 "디자인시스템급 공통 컴포넌트 체계")에서
    "무엇을 공통으로 올리고 무엇을 서비스별로 남길지" 판정할 때 이 기준을
    적용했다는 사실은 **없음**(소유자 확인) — 서비스 간 공통 레이어 판정
    기준으로 서술 금지. EXP-03 Notes for tailoring 상호 참조.
  - **[오류 처리 경계 설계]** 모든 오류를 공통 toast로 처리하지 않고
    오류 유형을 구분: (a) 재시도 가능한 네트워크 오류, (b) 사용자 입력
    오류, (c) 인증 만료, (d) 치명적 화면 오류(전체 화면 fallback 필요).
    기존 XSS 필터링·404/500/LLM 오류 가드레일과는 별개로, 오류 분류
    체계 자체를 설계한 판단. 검증 관점: 오류 재현 시 화면 복구 가능성·
    문의 건수·로그 원인 추적성
    (user-attested 2026-07-23 — headhunter-advisor 인터뷰)
  - LLM 릴레이 서버·AI 오케스트레이션 구현에 협업(백엔드·LLM 개발자와 공동,
    FE 단독 구현 아님). 상세 실체 [확인 필요 — 구현 범위·기여 비중 소유자
    확인 예정]. (user-attested 2026-07-24, grill-me base-resume 세션)
- Technologies: React, TypeScript, TanStack Query, Recoil, SSE, Chart.js,
  Tailwind CSS, Nginx, FastAPI [사용 위치 확인 필요], Chromatic [UI 테스트 —
  A/B 실험 여부 확인 필요], Web Vitals [운영 방식 확인 필요],
  Docker [배포 인프라 — EXP-02 Blue-Green 무중단 배포 상세 참조], MongoDB
  (NoSQL)
  (Nginx·FastAPI·Chromatic·Web Vitals user-attested 2026-07-24,
  grill-me base-resume 세션; 상세 용도는 [확인 필요] 마커 참조.
  Docker user-attested 2026-07-27, 이력서 재작성 세션에서 소유자 구두 확인 —
  문서 근거 없음, pending documentary source.
  MongoDB(NoSQL) user-attested 2026-07-27, 같은 세션 — 귀속 확정(이 서비스,
  AI코치=AI 건강검진 챗봇). 문서 근거 없음, pending documentary source.
  "Unattributed Technologies" 보류 섹션에 있던 항목을 귀속 확정에 따라 이관.)
  **[정정 — user-attested 2026-07-27, 소유자 갭 정정]** 이전에 이 항목에
  임시 귀속으로 기록됐던 Nest.js·Zustand는 바이오에이지 서비스 소속임을
  소유자가 확인해 EXP-06("2025 대웅제약 성과 평가 기반 사업 기여")으로
  귀속 이관함 — 이 항목(EXP-01)에서는 제거. 출처는 동일하게
  `user-attested 2026-07-27 구두 확인, 문서 근거 없음`.
- Result:
  - PoC 수준의 AI 서비스를 실사용 가능한 AI 건강검진 챗봇으로 전환
  - 신규 AI 챗봇 반복 구축에 사용할 수 있는 공통 FE 확장 구조 확보
- Metrics:
  - **[활성 사용자 수 — 정정, user-attested 2026-07-27, 소유자 구두 확인, 문서
    근거 없음]** 3,493명은 실제 활성 사용자 수(임직원 대상 실사용 규모)임을
    소유자가 확인. 관계 정리: 2차 PoC(사용성 4.18/만족도 4.06/완성도 4.05
    산정 모집단)를 거쳐 실서비스로 전환됐고, 전환 후 활성 사용자가 3,493명—
    "3,493명 규모 PoC 운영"이라는 기존 표현은 이 활성 사용자 수치로 갱신함.
  - 사용성 4.18점, 서비스 만족도 4.06점, 완성도 4.05점 (2차 PoC 검증 기준)
  - AI 답변 출력 시간 10초 -> 4초, 60% 단축
  - 초기 서비스 진입 시간 30초 -> 6초, 80% 단축
  - 400건 발화 검증 기준 답변 화면 정상 출력률 100%
  - Lighthouse 91점
  - 신규 AI 챗봇 구축 기간을 10주에서 2주로 줄일 수 있는 공통 구조 확보(원문 표현: 80% 단축 가능한 구조) — **스코프 정정(user-attested 2026-07-23, headhunter-advisor 인터뷰)**: 10주는 챗봇 최초 구현 기간, 2주는 신규 고객사(웰체크) 입점 시 Base-Theme을 활용해 색상·CI·기능을 커스터마이징해 FE 단을 납품한 기간. 2주는 FE 납품 기준 수치이며 LLM/BE 일정은 별도로 고려되지 않았으므로, "챗봇 전체를 2주 만에 만들었다"는 식으로 확대 해석 금지
  - **[2주 조기 달성 대상 — 정정, user-attested 2026-07-27, 소유자 구두 확인,
    문서 근거 없음]** 계획 대비 2주 조기 달성한 대상은 **실서비스 활성화**임을
    소유자가 확인. 기존 "계획 대비 2주 빠르게 PoC 고도화 완료" 표현은 대상이
    부정확했으므로 정정 — PoC 고도화 자체의 일정 단축 여부는 별도로 확인된 바
    없다. 바로 위 "신규 AI 챗봇 구축 기간 10주→2주"(신규 고객사 FE 납품 기간)
    항목과는 다른 사건이므로 혼동 금지.
  - AI 발화 응답 평균 2초대 — 네트워크에서 데이터 수신 기준.
    ※ 기존 "출력 시간 10초→4초"와 측정 대상이 다름: 10초→4초는 출력 완료까지의
    전체 시간 단축이고, 2초대는 네트워크 수신(첫 청크 또는 전체 수신) 기준으로
    측정한 별도 지표. 두 수치를 동일 맥락에서 혼용 금지.
    (user-attested 2026-07-24, grill-me base-resume 세션)
  - **[코드베이스 실측 수치 — user-attested 2026-07-24, grill-me base-resume 세션]**
    소유자 직접 제공 실측값. 문서 근거 미확보(pending documentary source).
    - 12개 도메인 모듈(건강검진·AI 상담·병원 추천 등)
    - 5개 도메인에 걸친 REST API 요청 31종·응답 모델 33종
    - Feature 모듈 10종·주요 라우트 7종
    - Vitest 테스트 파일 315개·약 2,600 테스트 케이스·테스트 코드 약 3.4만 LOC
      **[제외 결정 — user-attested 2026-08-12, 네이버웹툰 세션 게이트 보완
      갭 인터뷰]**: "약 2,600 테스트 케이스" 수치는 `metric-registry.md`에
      미등재·문서 근거 미확보 상태이며, 소유자 결정에 따라 이력서 문면
      (경력기술서 포함)에서 제외한다. 대신 확정치인 반복 QA 시간
      3시간→30분(EXP-03 Metrics, `metric-qa-time`, confirmed) 등으로
      대체할 것. 테스트 파일 315개·테스트 코드 약 3.4만 LOC 등 나머지
      실측 수치는 이 결정의 대상이 아니며 기존 상태(문서 근거 미확보,
      고부담 문서에서 확인 요청 권장) 그대로 유지.
    - TypeScript·React 운영 코드 약 8만 LOC
    - Storybook 스토리 210개
    - Playwright E2E 시나리오 5종
    - 테넌트별 콘텐츠·테마·기능 플래그 관리자 프리뷰 도구
      (JSON 편집·변경 Diff·설정 이력 관리 등 관리자 기능 5종)
    - 건강 데이터 분석 기능
      (검진 결과·건강 점수·만성질환·이상 결과·종합 소견)
    - 브라우저 언어 감지 기반 i18n
    - PostHog·GA4 사용자 행동·화면 이동 이벤트 연동
    - 채팅 기능
      (AI 답변 스트리밍·재생성·메시지 재시도·복사·피드백·상담 이력)
- Evidence / links:
  - `sources/이력서_20260624.pdf`
  - `extracted/이력서_20260624.txt`
  - `sources/2026_상반기종합평가.xlsx`
  - `extracted/2026_상반기종합평가.md`
  - `sources/연종합평가2025_정다훈.xlsx`
  - `extracted/연종합평가2025_정다훈.md`
  - user-attested 2026-07-23 (headhunter-advisor 인터뷰에서 사용자 직접 확인) — Config-Driven UI/Base-Theme 배경, 리팩토링 규모, "10주->2주" 스코프 정정, 웰체크 실명 사용 동의, 컴포넌트 추상화 수준 제한("변경 이유가 같은 것만" 기준), 오류 처리 경계 설계(오류 유형 4분류 — 네트워크/입력/인증/치명)
  - user-attested 2026-07-24 (grill-me base-resume 세션) — AI 건강검진 챗봇=AI코치
    동일 서비스 확인(병합 노트). 프로젝트 목표(MVP→PoC→10주 내 실서비스 전환) 확인.
    LLM 릴레이 서버·AI 오케스트레이션 협업 사실(상세 실체 [확인 필요]). 기술 스택
    추가(Nginx·FastAPI·Chromatic·Web Vitals — 상세 용도 [확인 필요]). AI 발화 응답
    평균 2초대(네트워크 수신 기준, 기존 10초→4초 출력 시간과 측정 대상 다름).
    코드베이스 실측 수치 일체(문서 근거 미확보).
  - user-attested 2026-07-27 (이력서 재작성 세션에서 소유자 구두 확인) — 조직
    구조(다나아데이터 스쿼드 소속, 부서 20명/스쿼드 10명, 비즈36.5·AI코치·
    바이오에이지 3개 서비스 FE 총괄) 및 기술 스택 추가(Docker). 문서 근거
    없음, pending documentary source.
  - user-attested 2026-07-27 (같은 세션, 갭 정정) — Nest.js·Zustand는
    바이오에이지 서비스 소속으로 확인돼 EXP-06으로 귀속 이관, 이 항목에서
    제거함.
  - user-attested 2026-07-27 (같은 세션, 은행-이력서 불일치 정정) — (1) 3,493명은
    실제 활성 사용자 수(임직원 대상 실사용 규모)이며, 2차 PoC 검증 모집단을
    거쳐 실서비스로 전환된 뒤의 활성 사용자 수임을 확인. (2) 계획 대비 2주
    조기 달성 대상은 PoC 고도화가 아닌 실서비스 활성화임을 확인. 문서 근거
    없음, pending documentary source.
  - user-attested 2026-07-27 (같은 세션, 귀속 확정) — MongoDB(NoSQL) 사용처를
    소유자가 이 서비스(AI코치=AI 건강검진 챗봇)로 확정. "Unattributed
    Technologies" 보류 섹션에서 이관됨. 문서 근거 없음, pending documentary
    source.
  - user-attested 2026-08-12 (네이버웹툰 지원 세션, 적대 검증 갭 인터뷰에서
    소유자 직접 확인) — (1) "변경 이유가 같은 것만" 컴포넌트 추상화 기준은
    이 챗봇 프로젝트 한정으로 수립·적용됐고, 비즈36.5·AI코치·바이오에이지
    3개 서비스 공통 컴포넌트 레이어의 서비스 간 판정에 이 기준을 적용한
    사실은 없음. (2) Storybook 스토리 210개 수치는 핵심 성과 등 전면 계층에
    볼드 수치로 격상하지 않고 경력기술서 본문 서술까지만 사용하기로 소유자
    결정.
  - user-attested 2026-08-12 (같은 세션, 게이트 보완 갭 인터뷰) — "Vitest
    약 2,600 테스트 케이스" 수치는 `metric-registry.md` 미등재·문서 근거
    미확보 상태이므로 이력서 문면(경력기술서 포함)에서 제외하고, 반복 QA
    3시간→30분(EXP-03, `metric-qa-time`) 등 확정치로 대체하기로 소유자
    결정.
- Reusable keywords: AI 서비스 제품화, LLM 챗봇, SSE Streaming, Markdown Renderer,
  XSS 필터링, Config-Driven UI, Base-Theme, feature flag, PoC 고도화,
  컴포넌트 추상화, 변경 이유 기반 공통화, 오류 분류 체계, 오류 처리 경계,
  Nginx, FastAPI, Chromatic, Web Vitals, LLM 릴레이, AI 오케스트레이션,
  i18n, PostHog, GA4, Vitest, Storybook, 다국어, 코드베이스 규모, 다나아데이터
  스쿼드, Docker, MongoDB, NoSQL
- Notes for tailoring: AI/플랫폼/프론트엔드 아키텍처 직무에서 최우선 사례로 사용.
  `2026_상반기종합평가`는 2026년 상반기 평가 자료이므로 2025.07~2025.10 프로젝트의
  후속 안정화/확장 성과를 함께 입증하는 보조 근거로만 사용. 신규 고객사 실명 "웰체크"는
  소유자 동의로 외부 문서에 사용 가능(user-attested 2026-07-23). "10주->2주" 수치를
  인용할 때는 반드시 위 Metrics의 스코프 정정(10주=최초 구현, 2주=웰체크 FE 납품
  기준)을 함께 확인하고, "챗봇 전체를 2주 만에 구축"처럼 과장 해석하지 않는다.
  **코드베이스 규모 가드레일(user-attested 2026-07-24)**: 실측 수치(LOC, 파일 수,
  모듈 수 등)는 소유자 직접 제공이나 문서 근거 미확보이므로 고부담 외부 문서에서는
  소유자에게 뒷받침 자료 확인을 요청하는 것이 안전하다.
  **Vitest 테스트 케이스 수 제외 가드레일(user-attested 2026-08-12)**: "약
  2,600 테스트 케이스" 수치는 이력서·경력기술서를 포함한 어떤 문면에도 사용하지
  않는다(registry 미등재·문서 근거 미확보, 소유자 결정) — 반복 QA 시간
  3시간→30분(`metric-qa-time`, confirmed) 등 확정치로 대체할 것. 테스트 파일
  315개·테스트 코드 약 3.4만 LOC는 이 결정의 대상이 아니다.
  **Storybook 스토리 210개 노출 수위 가드레일(user-attested 2026-08-12)**:
  이 수치는 여전히 문서 근거 미확보(구두 제공) 상태이며, 추가로 소유자가
  "핵심 성과" 등 이력서/포트폴리오 전면 계층에 볼드 수치로 격상하지 않고
  경력기술서 본문 서술까지만 사용하기로 결정함(2026-08-12 네이버웹툰 세션).
  헤드라인·요약 카드·강조 블록에 이 수치를 단독 볼드로 배치하지 말 것.
  **컴포넌트 추상화 기준 적용 범위 가드레일(user-attested 2026-08-12)**:
  "변경 이유가 같은 것만" 공통화 기준은 이 챗봇 프로젝트(EXP-01) 내부 판단
  한정. EXP-03의 비즈36.5·AI코치·바이오에이지 3개 서비스 공통 컴포넌트
  레이어 판정 근거로 이 기준을 인용하지 말 것 — 상세는 위 Actions
  [적용 범위 가드레일] 블록 참조.
  **기술 스택 가드레일**: Nginx·FastAPI·Chromatic·Web Vitals는 추가 확인 필요([확인
  필요] 마커 참조) — 사용 위치·목적이 특정되지 않았으므로 단정 서술 금지.
  Docker도 동일하게 구체 사용처가 [확인 필요] 상태이며 문서 근거가 없으므로
  (user-attested 2026-07-27), 고부담 외부 문서에서는 소유자에게 뒷받침 자료
  확인을 요청할 것. **Nest.js·Zustand는 이 항목에 없음** — 2026-07-27 소유자
  정정으로 바이오에이지 소속임이 확인돼 EXP-06으로 이관됨. 이 항목(EXP-01)의
  기술 스택으로 다시 추가하지 말 것.
  **조직 구조 가드레일(user-attested 2026-07-27)**: "다나아데이터 스쿼드"·
  부서 20명/스쿼드 10명·3개 서비스(비즈36.5·AI코치·바이오에이지) FE 총괄은
  문서 근거 없는 소유자 구두 확인 사실이다. 총괄 범위에 에스크미는 포함되지
  않음(EXP-06과 정합).
  **병합 노트**: AI 건강검진 챗봇=AI코치는 동일 서비스. "2025 대웅제약 성과 평가
  기반 사업 기여" 항목의 AI코치 화면·기능 수치와 연결해 사용 가능.
  **MongoDB 가드레일(user-attested 2026-07-27)**: MongoDB(NoSQL)는 이 서비스
  (AI코치=AI 건강검진 챗봇) 사용으로 귀속 확정됐으나 구체 용도(어느 데이터,
  어느 기능)는 아직 특정되지 않았고 문서 근거도 없다 — 고부담 외부 문서에서는
  뒷받침 자료 확인을 요청할 것.
  **활성 사용자·조기 달성 가드레일(user-attested 2026-07-27)**: (1) 3,493명은
  "PoC 참여자 수"가 아니라 실서비스 전환 후 실제 활성 사용자 수(임직원 대상
  실사용 규모)로 서술할 것 — "3,493명 규모 PoC 운영"처럼 PoC로만 한정해
  서술하지 않는다. (2) "계획 대비 2주 조기"는 실서비스 활성화 달성 기준이며
  PoC 고도화 완료 기준이 아니다 — 두 표현을 혼용하지 않는다. 두 정정 모두
  문서 근거 없는 소유자 구두 확인이므로 고부담 외부 문서에서는 뒷받침 자료
  확인을 요청할 것.

### B2B 임직원 건강 플랫폼 풀스택 내재화

- Period: 2025.11 ~ 2026.02
- Context: 외주 중심으로 운영되던 검진 예약 서비스를 내부 개발/운영 가능한 임직원
  건강 플랫폼으로 전환.
  **[병합 노트 — user-attested 2026-07-25, grill-me base-resume 세션]**: 이
  플랫폼 = 비즈36.5(비즈케어)와 동일 서비스임을 소유자가 확인. 단순
  내재화가 아니라 2019년 레거시를 React로 전면 개편해 상품성을 높여 회사가
  고객사에 판매할 수 있는 "임직원 건강검진 통합플랫폼"으로 도약·고도화하는
  프로젝트였음. 따라서 "2025 대웅제약 성과 평가 기반 사업 기여" 항목(EXP-06)의
  "비즈케어 UI/UX 전면 개편 주도 → 대웅제약 대상 판매 1.0억(조직 KR 세부)"
  사실이 이 플랫폼의 성과 앵커로 연결됨 — 두 항목 상호 참조.
  (user-attested 2026-07-25, grill-me base-resume 세션)
- Problem: jQuery/Thymeleaf 화면, Spring Boot 서버 로직, MySQL 데이터 구조가
  기능별로 결합돼 변경 영향 파악이 어려웠고 Web/Admin/App 권한과 데이터 출력
  정책이 달랐다. 당시 BE-FE가 분리되지 않은 모놀리식 구조였고 Spring Boot가
  RESTful하지 않았으며 Thymeleaf와 강결합되어 있어 SPA 형태로 한 번에 전환할
  수 없었다 (user-attested 2026-07-23 — headhunter-advisor 인터뷰에서 사용자
  직접 확인).
- Role: 서비스/데이터 구조 분석, MySQL/Spring Boot/REST API/Web/Admin 개발, WebView 앱 운영 및 CI/CD 구축. 9주 내 108개 페이지·82개 화면 전환은 본인이 단독으로 수행(팀 산출이 아닌 개인 기여) (user-attested 2026-07-23 — headhunter-advisor 인터뷰에서 사용자 직접 확인)
- Actions:
  - 기존 소스와 DB 스키마 분석, 화면 요청부터 Controller/Service/Query/DB/화면 출력까지 데이터 흐름 정리
  - 건강관리 신규 기능에 필요한 MySQL 데이터 모델, Spring Boot 서버 로직, REST API, Web/Admin 화면 End-to-End 개발
  - 2019년에 작성된 레거시 스파게티 코드를 걷어내고 재활용 가능한 컴포넌트 구조로 빠르게 UI/UX를 개편하는 것을 목표로 설정 (user-attested 2026-07-23 — headhunter-advisor 인터뷰에서 사용자 직접 확인)
  - jQuery/Thymeleaf와 React가 화면 단위로 공존하는 점진적 전환 구조 설계 — BE-FE 미분리·비RESTful Spring Boot·Thymeleaf 강결합 제약으로 SPA를 한 번에 도입할 수 없어, island-loader 패턴을 활용해 React를 SPA는 아니지만 화면 단위로 컴포넌트를 재사용할 수 있는 수준으로 구현 (user-attested 2026-07-23 — headhunter-advisor 인터뷰에서 사용자 직접 확인)
  - island-loader 패턴을 선택한 이유: (a) 이후 목표였던 Next.js 전환을 쉽게
    하기 위한 사전 단계였고, (b) island-loader로 컴포넌트를 재활용하는 것이
    풀 리라이트 대비 비용적으로 더 저렴하다고 판단 — 트레이드오프 판단 근거:
    jQuery/React 장기 공존 시 두 프레임워크 유지비·이벤트/DOM 소유권 충돌
    리스크, 전면 재작성 시 일정 지연·대규모 회귀 리스크를 모두 고려한 결과
    화면 단위 점진 전환(island-loader)이 최적 경로라고 판단. 이 구조 덕분에
    9주 내 UI/UX 개편을 빠르게 완료할 수 있었음
    (user-attested 2026-07-23 — headhunter-advisor 인터뷰에서 사용자 직접 확인)
  - **[교체 우선순위 기준]** 108페이지·82화면 전체를 변경 빈도가 높거나
    장애가 잦은 영역부터 우선순위 순서대로 단독 전환 — "우선순위 기준"은
    교체 '순서'를 정하는 기준이었을 뿐, 일부만 선별 교체한 것이 아님.
    기존 Metrics("9주 내 108개 페이지·82개 화면 전환")과 충돌 없음
    (user-attested 2026-07-23, headhunter-advisor 인터뷰; 확인 해소
    2026-07-24).
  - 사용자 권한, 메뉴, 브랜딩, 데이터 출력 정책을 공통 기준으로 정리
  - Jenkins 빌드/검증/배포 파이프라인과 WebView 호환성 검증 기준 수립
  - **[반응형 웹 — user-attested 2026-08-10, 티빙 grill-me 세션]**
    미디어 쿼리 기반으로 PC/모바일 화면 크기를 구분 대응하는 반응형 웹 개발을
    수행. 특히 이 서비스는 WebView로 모바일에서 제공되었기 때문에 모바일
    뷰포트 대응을 중점적으로 신경 씀.
    문서 근거 없음, pending documentary source.
  - **[배포 자동화 — user-attested 2026-07-25, grill-me base-resume 세션]**
    기존에 FileZilla로 수동 이관·빌드하던 배포를 본인이 직접 Jenkins
    빌드·검증·배포 파이프라인으로 전환. 배포 리드타임 10분→2분(80% 단축) —
    이 수치는 "2025 대웅제약 성과 평가 기반 사업 기여"(EXP-06) Metrics의
    "Jenkins CI/CD 배포 리드타임 10분→2분"과 동일 사건. 이중 계상 방지:
    두 항목에서 같은 수치를 각각 독립 성과처럼 표기하지 않는다.
    Jenkins 파이프라인은 본인이 직접 수행.
  - **[배포 구조 — 개발/운영 분리, user-attested 2026-07-27, 이력서 재작성
    세션에서 소유자 구두 확인, 문서 근거 없음]** 개발 서버는 Jenkins
    파이프라인으로 빌드·배포하고, 운영 서버는 Docker 기반 Blue-Green 무중단
    배포 구조로 운영. 이 Blue-Green 배포 구조는 본인이 직접 구축·수행함.
    바로 위 [배포 자동화] 블록(FileZilla→Jenkins 전환, 리드타임 10분→2분)과
    같은 배포 체계의 상세 구성 — 별개 사건 아님.
  - **[UI 회귀 검증 — user-attested 2026-07-25, grill-me base-resume 세션]**
    82개 화면 전환의 반복 UI 검증 대부분을 Playwright 기반 AI E2E 테스트가
    사람 대신 수행. 이 Playwright 도입은 "품질·개발·운영 자동화 및 FE AX
    기준 수립"(EXP-03) 항목의 "Playwright 단독 도입"과 동일 사건이며 이
    프로젝트(EXP-02)에 적용된 것(별도 도구·사건 아님) — 두 항목 상호 참조.
    이중 계상 방지: 두 항목에서 각각 독립 도입처럼 표기하지 않는다.
  - **[WebView→React Native 마이그레이션 및 RN 앱 스토어 출시·운영 —
    user-attested 2026-08-17, CJ푸드빌(뚜레쥬르 APP 리빌딩) 지원 세션 갭
    인터뷰에서 소유자 직접 확인. 문서 근거 없음, pending documentary source.]**
    비즈36.5를 WebView 방식에서 React Native로 마이그레이션한 경험. RN 앱을
    App Store(iOS)·Google Play(Android)에 출시·운영. 스토어 등록·심사(리뷰)
    대응·버전/배포 관리·크래시 모니터링·업데이트 운영 전 과정을 본인이 직접
    수행. 사용자 규모 약 4,000명(소유자 구두 확인, 문서 근거 없음).
    **[EXP-02 관계 스코프 가드레일 — 미확정]**: 이 WebView→RN 마이그레이션과
    기존 EXP-02 기록의 "108페이지·82화면 web을 island-loader로 React 점진
    전환"·"WebView로 모바일 제공"과의 관계(동일 서비스의 모바일 앱 계층인지,
    시점 선후 관계)는 미확정 [확인 필요]. 이력서/문면에서 "web 점진
    전환(island-loader)"과 "WebView→RN 마이그레이션"을 모순되게 병렬하거나
    하나의 단일 타임라인으로 단정하지 말 것 — 면접 대비 항목으로 둔다.
    **[사용자 규모 혼동 방지 가드레일]**: 비즈36.5 앱 사용자 약 4,000명은
    EXP-01의 "AI코치 활성 사용자 3,493명"과 다른 서비스의 수치다 — 두 수치를
    혼용하거나 합산하지 말 것. 삼성물산 앱 약 100명(EXP-04)도 별개.
  - **[WebView 인터페이스 및 네이티브 모듈 브릿지 직접 설계·구현 —
    user-attested 2026-08-17, 같은 세션. 문서 근거 없음, pending documentary
    source.]**
    WebView 단계의 웹↔네이티브 인터페이스(WebView 인터페이스 계열)와 RN
    마이그레이션 후 네이티브 모듈 브릿지를 직접 설계·구현. 브릿지로
    주고받은 데이터 범주: 카메라·파일·푸시 토큰·로그인/인증 토큰·딥링크·
    스크롤/네비게이션 이벤트 등(EXP-04 삼성물산과 동일 범주).
    **[브릿지 방식 표기 가드레일]**: 비즈36.5 프로젝트에서는 WebView 인터페이스
    + RN 네이티브 모듈 브릿지 두 방식 모두 경험. postMessage/JS Interface
    (Android)/WKScriptMessageHandler(iOS) 등 구체 API 명칭은 소유자가 명시
    확인하지 않았으므로 "WebView 인터페이스"·"네이티브 모듈 브릿지" 수준으로만
    서술하고 특정 API를 단정하지 말 것([확인 필요]).
- Technologies: React, TypeScript, jQuery, Thymeleaf, Java, Spring Boot, REST API,
  MySQL, Tailwind CSS, Jenkins CI/CD, WebView, iOS, Android, Playwright,
  Docker (운영 서버 Blue-Green 무중단 배포, user-attested 2026-07-27 — 문서
  근거 없음),
  React Native, App Store 출시·운영, Google Play 출시·운영, 네이티브 모듈 브릿지,
  WebView 인터페이스
  (user-attested 2026-08-17, CJ푸드빌 지원 세션 갭 인터뷰 — 문서 근거 없음)
- Result:
  - 외주 의존 서비스의 기능 변경과 배포를 내부 대응 가능한 운영 구조로 전환
  - 고객사별 CI/메뉴/기능 노출 변경에 반복 대응 가능한 SaaS형 기반 확보
- Metrics:
  - 9주 내 108개 페이지, 82개 화면을 임직원 건강 플랫폼으로 전환 — island-loader 패턴 기반 컴포넌트 재사용 구조로 달성했으며 108개 페이지·82개 화면 전환은 본인 단독 수행 (근거: 위 Role/Actions, user-attested 2026-07-23 — headhunter-advisor 인터뷰에서 사용자 직접 확인)
  - 건강관리 신규 기능 3건을 데이터 모델부터 서버/API/화면까지 End-to-End 개발
  - 고객사별 CI/메뉴/기능 노출 변경을 1주 내 대응 가능한 구조 구축
  - **[RN 앱 사용자 규모 — user-attested 2026-08-17, CJ푸드빌(뚜레쥬르 APP
    리빌딩) 지원 세션 갭 인터뷰에서 소유자 직접 확인. 문서 근거 없음,
    pending documentary source.]**
    비즈36.5 RN 앱 사용자 약 4,000명.
    ※ 이 수치는 EXP-01 AI코치 활성 사용자 3,493명과 다른 서비스의 수치 —
    혼용·합산 금지. EXP-04 삼성물산 앱 약 100명과도 별개.
- Evidence / links:
  - `sources/이력서_20260624.pdf`
  - `extracted/이력서_20260624.txt`
  - `sources/2026_상반기종합평가.xlsx`
  - `extracted/2026_상반기종합평가.md`
  - user-attested 2026-07-23 (headhunter-advisor 인터뷰에서 사용자 직접 확인) —
    108개 페이지·82개 화면 전환 단독 수행 여부, BE-FE 미분리·비RESTful Spring
    Boot·Thymeleaf 강결합이라는 기술적 배경, island-loader 패턴 채택 배경과
    이유(Next.js 전환 사전 단계, 풀 리라이트 대비 비용 절감), 트레이드오프
    판단 근거(jQuery/React 장기 공존 시 이벤트/DOM 소유권 충돌·유지비 리스크
    vs 전면 재작성의 일정 지연·대규모 회귀 리스크).
  - user-attested 2026-07-23 (확인 해소 2026-07-24): 교체 우선순위 기준
    (변경/장애 빈도)은 교체 '순서'를 정한 것이며 108페이지·82화면 전체를
    우선순위 순서대로 전환한 것 — 일부 선별 전환이 아님. 기존 Metrics와
    충돌 없음.
  - user-attested 2026-07-25 (grill-me base-resume 세션) — 이 플랫폼=비즈36.5
    (비즈케어) 동일 서비스 확인(병합 노트). 프로젝트 본질 재정의: 단순 내재화가
    아니라 2019년 레거시 React 전면 개편 → 임직원 건강검진 통합플랫폼으로
    도약·고도화. 배포 자동화: FileZilla 수동 이관 → Jenkins 파이프라인으로
    본인이 직접 전환, 리드타임 10분→2분(EXP-06 Metrics와 동일 사건 — 이중
    계상 방지). UI 회귀 검증: Playwright AI E2E 82개 화면 자동화(EXP-03
    Playwright 도입과 동일 사건 — 이중 계상 방지).
  - user-attested 2026-07-27 (이력서 재작성 세션에서 소유자 구두 확인) —
    배포 구조 상세: 개발 서버 Jenkins 파이프라인 빌드·배포, 운영 서버 Docker
    기반 Blue-Green 무중단 배포(본인 직접 수행). 문서 근거 없음, pending
    documentary source.
  - user-attested 2026-08-17 (CJ푸드빌(뚜레쥬르 APP 리빌딩) 지원 세션 갭
    인터뷰에서 소유자 직접 확인. 문서 근거 없음, pending documentary source.)
    — (1) 비즈36.5를 WebView 방식에서 React Native로 마이그레이션한 경험.
    RN 앱을 App Store·Google Play 출시·운영, 스토어 등록·심사 대응·버전/
    배포 관리·크래시 모니터링·업데이트 운영 전 과정 본인 직접 수행.
    사용자 약 4,000명. (2) WebView 단계 웹↔네이티브 인터페이스(WebView
    인터페이스 계열)와 RN 마이그레이션 후 네이티브 모듈 브릿지를 직접
    설계·구현. 브릿지 데이터 범주: 카메라·파일·푸시 토큰·로그인/인증 토큰·
    딥링크·스크롤/네비게이션 이벤트 등. 구체 API 명칭(postMessage/JS Interface/
    WKScriptMessageHandler 등)은 소유자 명시 확인 없음([확인 필요]).
    (3) "WebView로 모바일 제공" 기록(island-loader web 점진 전환)과의 선후
    관계 및 동일 서비스 모바일 앱 계층 여부는 미확정([확인 필요] — 면접
    대비 항목).
- Reusable keywords: B2B 플랫폼, 풀스택 내재화, Spring Boot, MySQL, Web/Admin,
  WebView, Jenkins CI/CD, SaaS형 구조, island-loader 패턴, 점진적 SPA 전환,
  임직원 건강검진 통합플랫폼, 레거시 전면 개편, 배포 자동화, Playwright E2E,
  비즈케어, 비즈36.5, Docker, Blue-Green 무중단 배포, 반응형 웹, 미디어 쿼리,
  React Native 앱 출시, App Store, Google Play, 스토어 배포 운영,
  크래시 모니터링, 네이티브-웹 브릿지, 네이티브 모듈, 네이티브 모듈 브릿지,
  WebView 인터페이스, WebView→RN 마이그레이션
- Notes for tailoring: 풀스택/플랫폼/운영 안정화 직무에 적합. 108개 페이지·
  82개 화면 전환은 개인 단독 기여이므로 "본인이 단독으로 수행"이라는 개인
  기여 프레이밍을 사용할 수 있다. island-loader 패턴 채택은 당시 모놀리식·
  비RESTful·Thymeleaf 강결합 제약 하의 기술적 의사결정(전면 SPA 전환 대신
  화면 단위 컴포넌트 재사용, Next.js 전환의 사전 단계, 비용 효율)으로 서술할
  것 — 풀 SPA 전환을 했다고 과장하지 않는다.
  **병합 노트 가드레일(user-attested 2026-07-25)**: 이 플랫폼=비즈36.5(비즈
  케어)이므로 EXP-06의 "비즈케어 판매 1.0억"은 이 프로젝트의 상업적 성과
  앵커다. 단, 금액은 조직/팀 KR 세부 수치이며 개인 단독 성과 아님(EXP-06
  팀 KR 가드레일 참조).
  **이중 계상 가드레일(user-attested 2026-07-25)**: (1) Jenkins 배포 리드타임
  10분→2분은 EXP-06 Metrics와 동일 사건 — 동일 맥락에서 두 번 수치화하지
  않는다. (2) Playwright AI E2E 82개 화면 자동화는 EXP-03 Playwright 도입과
  동일 사건 — 두 항목에서 각각 독립 도입처럼 표기하지 않는다.
  **배포 구조 가드레일(user-attested 2026-07-27)**: 개발 서버 Jenkins
  빌드·배포 / 운영 서버 Docker 기반 Blue-Green 무중단 배포는 문서 근거 없는
  소유자 구두 확인 사실이다. 고부담 외부 문서에서는 뒷받침 자료 확인을
  요청할 것.
  **WebView→RN 마이그레이션 관계 가드레일(user-attested 2026-08-17)**:
  이 마이그레이션과 기존 "island-loader로 108페이지·82화면 web 점진 전환" +
  "WebView로 모바일 제공" 기록과의 시점 선후 관계 및 동일 서비스 모바일 앱
  계층 여부는 미확정([확인 필요]). 두 사실(web island-loader 전환, WebView→RN
  마이그레이션)을 하나의 단일 타임라인으로 단정하거나 모순되게 병렬하지 말 것
  — 면접 대비 항목으로 둔다.
  **RN 앱 사용자·브릿지 가드레일(user-attested 2026-08-17)**: 비즈36.5 앱
  사용자 약 4,000명은 문서 근거 없는 소유자 구두 확인이며, EXP-01 AI코치
  활성 사용자 3,493명·EXP-04 삼성물산 앱 약 100명과 각각 별개 서비스의
  수치다 — 혼용·합산 금지. WebView 인터페이스·네이티브 모듈 브릿지의 구체
  API 명칭은 소유자 명시 확인 없음([확인 필요]) — "WebView 인터페이스"·
  "네이티브 모듈 브릿지" 수준으로만 서술할 것.

### 품질·개발·운영 자동화 및 FE AX 기준 수립

- Period: 2026년 상반기
- Context: AI코치, 비즈36.5, 바이오에이지 운영 서비스와 공통 컴포넌트 증가
  **[가드레일 상호 참조 — user-attested 2026-08-12, 네이버웹툰 지원 세션]**:
  이 3개 서비스에 걸친 공통 컴포넌트 레이어(아래 Storybook 항목)에서 무엇을
  공통으로 올리고 무엇을 서비스별로 남길지 판정할 때 EXP-01의 "변경 이유가
  같은 것만" 공통화 기준을 적용했다는 사실은 없음(소유자 확인) — 상세는
  EXP-01 Actions [적용 범위 가드레일] 블록 참조.
  **[공통/로컬 판정 주체·시점 — user-attested 2026-08-12, 네이버웹툰 세션
  게이트 보완 갭 인터뷰]**: 3개 서비스(비즈36.5·AI코치·바이오에이지) 운영
  중 신규 화면을 개발할 때, 해당 컴포넌트를 팀 공통으로 올릴지 서비스
  로컬로 둘지는 본인이 개발 시점에 직접 판정했음을 소유자가 확인.
  **[구조 가드레일 — user-attested 2026-08-12, 같은 세션]**: 이 공통
  컴포넌트는 평면 구조였음(소유자 확인) — 기초(프리미티브) 계층과 도메인
  조합 계층을 구분하는 계층 구조는 없었다. 이력서/포트폴리오 문면에서
  "프리미티브/도메인 계층" 등 컴포넌트 계층 구조를 서술하지 말 것 — 상세는
  아래 Notes for tailoring 참조.
- Problem: 수동 발화 테스트, 반복 UI 개발, 배포 전후 확인, 운영 지표 조회가 병목이 되었고 AI 생성 코드의 품질/보안/일관성을 검증할 기준이 필요했다.
- Role: 테스트/배포/운영 데이터 확인 절차 자동화 및 팀 개발 기준 수립.
  Playwright E2E 자동화는 본인이 단독으로 판단·도입했고 팀이 이를 채택함.
  도입 동기는 AI를 활용한 인력 효율화 및 최대한의 자동화 노력.
  Storybook은 기획자와 소통하고 UI를 빠르게 확정하기 위한 수단으로 시작해
  디자인시스템급 공통 컴포넌트 체계 수준으로 발전시킴.
  FE AX SOP는 FE AX 전환 노하우를 사내 공식 문서로 정리한 것으로 팀 자산으로
  채택됨. (user-attested 2026-07-23 — headhunter-advisor 인터뷰)
  FE AX SOP와 Playwright 검증 체계는 팀원 10명 전원이 사용 중(채택률 100%).
  담당자(본인) 부재 시에도 같은 기준으로 검증·배포가 가능한 체계 완성.
  (user-attested 2026-07-24, grill-me base-resume 세션)
  소유자 포지셔닝 의도(user-attested 2026-07-25, grill-me base-resume 세션):
  이 항목은 "AI 자동화 수준 + 조직 자산화 + 리더십·학습 능력 + 조직
  생산성 향상"을 보여주는 AI 테크 리더 항목으로 규정 — Notes for tailoring
  참조.
- Actions:
  - E2E 발화 테스트, LLM 응답 검증, 타입/테스트/빌드, 배포 전후 확인을 품질
    흐름으로 통합 — 소유자는 이 체계를 "하네스 엔지니어링 구축"으로 규정:
    사람이 판정하지 않아도 같은 기준으로 품질이 걸러지는 구조.
    (user-attested 2026-07-25, grill-me base-resume 세션)
  - Playwright 기반 주요 사용자 흐름과 회귀 시나리오 자동화 — 본인이 단독으로
    판단·도입, AI 활용 인력 효율화·자동화 목적, 팀 채택으로 이어짐
    (user-attested 2026-07-23 — headhunter-advisor 인터뷰).
    **[배포 파이프라인 필수 게이트 — user-attested 2026-07-25, grill-me
    base-resume 세션]** Playwright E2E 검증이 배포 파이프라인의 필수 게이트로
    편입돼 있음: 미통과 시 배포 차단, CI 자동 실행. 팀 표준 정착의 강제
    메커니즘.
    **[동일 사건 참조 — user-attested 2026-07-25, grill-me base-resume 세션]**
    이 Playwright 도입은 "B2B 임직원 건강 플랫폼 풀스택 내재화"(EXP-02)에서
    82개 화면 전환의 반복 UI 검증 자동화에 적용된 것이며, EXP-02의 [UI 회귀
    검증] 블록과 동일 사건임. 이중 계상 방지: EXP-02와 EXP-03에서 각각
    독립 도입처럼 표기하지 않는다.
  - **[UI/UX E2E 테스트 도구 — 본인 구축]** 채팅 화면을 JSON 시나리오로
    step 단위 자동 조작하는 UI/UX E2E 테스트 도구를 본인이 직접 구축.
    멀티 viewport 실행(desktop 1280×800 / tablet 768×1024 / mobile
    375×812)과 시각 회귀 검증(baseline diff, 픽셀 비교 threshold 기본
    2%) 기능을 갖춤. 위 Playwright 기반 E2E 자동화의 구체 구현체 중
    하나로 판단됨 — 별도 사건으로 확대 해석 금지.
    (user-attested 2026-08-11, 문서 근거 미확보)
  - **[LLM 채팅 응답 검수 도구 — 본인 구축]** 엑셀(.xlsx) 질문 목록을
    챗봇 화면에 자동 입력하고, 마크다운·표·버튼이 포함된 LLM 응답을
    회귀 검수(스크린샷/JSON/HTML 갤러리 저장)하는 도구를 본인이 직접
    구축. UI 전반 E2E가 아닌 LLM 응답 회귀 검수 전용 도구 — 바로 위
    UI/UX E2E 테스트 도구와는 별개 사건.
    (user-attested 2026-08-11, 문서 근거 미확보)
  - Storybook 중심의 컴포넌트 개발/검증 절차 수립 — 기획자와의 UI 확정 소통
    수단으로 시작해 디자인시스템급 공통 컴포넌트 체계로 발전
    (user-attested 2026-07-23 — headhunter-advisor 인터뷰)
    **[회귀 방지 장치 3종 — user-attested 2026-08-12, 네이버웹툰 세션
    게이트 보완 갭 인터뷰]** 공통 컴포넌트 변경이 3개 서비스(비즈36.5·
    AI코치·바이오에이지)로 퍼질 때 회귀를 (a) Storybook 스토리 확인,
    (b) TypeScript 타입/빌드 검사, (c) E2E(Playwright)·수동 회귀 확인
    세 가지로 방지했음을 소유자가 확인. 공통 컴포넌트 자체는 평면 구조였고
    프리미티브/도메인 계층 구분은 없었음(위 Context [구조 가드레일] 참조).
  - GA4/PostHog 기반 운영 데이터 대시보드 구축
  - AI 생성 코드의 컨텍스트 관리, 금지 패턴, 보안 위험, 검증 절차를 FE AX SOP로
    문서화 — FE AX 전환 노하우를 사내 공식 문서로 정리, 팀 자산으로 채택됨
    (user-attested 2026-07-23 — headhunter-advisor 인터뷰)
  - Codex·Claude Code 등 AI 코딩 에이전트를 활용한 개발과, 생성 코드의 검증·금지
    패턴·보안 기준 수립 (user-attested 2026-07-22 — AX본부 JD 대응 세션에서 사용자
    직접 확인. 문서 근거 미확보, pending documentary source)
  - **[GitLab MR 기반 코드 리뷰 — user-attested 2026-08-10, 티빙 grill-me 세션]**
    대웅제약 재직 중 GitLab MR(Merge Request) 기반 코드 리뷰 문화를 실무로
    경험 — 리뷰를 받는 쪽(작성자)과 동료 코드를 리뷰하는 쪽(리뷰어) 모두
    수행(양방향). 추가로 AI 코드 리뷰 도구를 MR 리뷰 흐름에 도입·활용하는
    경험 있음(AI 코드 리뷰가 기존 GitLab MR 리뷰 프로세스에 편입됨).
    ※ GitHub PR 실무 경험은 아님 — 반드시 "GitLab MR"로 정확히 표기할 것.
    문서 근거 없음, pending documentary source.
  - 외부 컨퍼런스 참석·학습으로 얻은 인사이트를 사내 개발 세미나(12회)로 이식하는
    구조 운영 — 외부 발표가 아닌 내부 공유 세미나임. 세미나 12회 수치는 "2025 대웅제약
    성과 평가 기반 사업 기여" 항목의 Actions와 동일 출처.
    (user-attested 2026-07-24, grill-me base-resume 세션)
- Technologies: Playwright, Storybook, Jest, ESLint, TypeScript, Jenkins, GitLab CI/CD, GA4, PostHog, Codex, Claude Code, Figma, Jira, Slack, Confluence, Notion
  (Figma·Jira·Slack·Confluence·Notion은 협업 도구 — user-attested 2026-07-27,
  이력서 재작성 세션에서 소유자 구두 확인. 대웅제약 재직 전반의 공통 협업
  도구이며 이 프로젝트에 한정된 것은 아님, 문서 근거 없음)
- Result:
  - QA, 운영 확인, 반복 컴포넌트 개발의 수작업 의존도를 낮추고 팀 개발 기준을 조직
    자산화
  - Playwright E2E 자동화를 단독으로 판단·도입해 빌드·배포 시간을 단축하고 무결점
    빌드·배포 가능한 상태를 확보함 (user-attested 2026-07-23 — headhunter-advisor
    인터뷰. 정량 수치 미확보 — 수치 창작 금지)
  - 표준화 결과로 소유자가 확인한 세 가지 효과
    (user-attested 2026-07-25, grill-me base-resume 세션):
    (a) 검증 인력 효율 향상 — 반복 검증 자동 판정 대체;
    (b) Storybook 기반 UI 조기 확정으로 기획자 커뮤니케이션 비용 절감
        (기획-개발 검증 리드타임 2일→1일과 연결);
    (c) 공통 컴포넌트·SOP·문서 48건 기반의 유지보수성 향상.
- Metrics:
  - Playwright E2E 시나리오 5종 (user-attested 2026-07-24, grill-me base-resume 세션
    — 소유자 결정으로 이력서에서 사용하는 표현. "600여 건 회귀 시나리오" 표현은
    이력서·자기소개서에서 폐기하고 "E2E 시나리오 5종"을 사용할 것.
    ※ 600여 건은 평가문서 원문 수치이나 소유자가 이력서 표기 단위로 5종을 확정.
    두 값의 관계(5종 시나리오 내 케이스 총합과 600여 건의 관계)는 미해소
    [확인 필요 — 소유자에게 확인 예정])
  - 반복 QA 시간 3시간 → 30분 (user-attested 2026-07-24, grill-me base-resume 세션
    — 소유자가 최종 확정한 수치. 기존 세 기록의 관계는 아래 주석 참조:
    ① 원본 평가문서: 3시간→1시간.
    ② user-attested 2026-07-23 (headhunter-advisor 인터뷰): 2시간→30분 — 당시 갱신.
    ③ user-attested 2026-07-24 (grill-me base-resume 세션): 3시간→30분으로 최종 확정
       — ①의 시작값(3시간)과 ②의 종착값(30분)을 결합한 소유자 override.
    문서 근거 미확보(pending documentary source). 고부담 외부 문서에서는
    원본 평가문서 값을 우선하거나 소유자에게 문서 근거 확보 요청 권장.)
  - 운영 데이터 확인 절차 3단계 -> 1단계
  - 반복 컴포넌트 개발 시간 90분 -> 15분, 약 83% 단축
  - 기획-개발 검증 리드타임 2일 -> 1일
  - 테스트 커버리지 98% 수준 확보
- Evidence / links:
  - `sources/이력서_20260624.pdf`
  - `extracted/이력서_20260624.txt`
  - `sources/2026_상반기종합평가.xlsx`
  - `extracted/2026_상반기종합평가.md`
  - user-attested 2026-07-23 (headhunter-advisor 인터뷰에서 사용자 직접 확인) —
    Playwright E2E 자동화 단독 판단·도입·팀 채택, 빌드·배포 무결점 상태 확보(정성
    성과, 정량 미확보), 반복 QA 시간 2시간→30분으로 갱신(원본 문서 3시간→1시간
    override, 문서 근거 미확보), Storybook 기획자 소통 수단 배경, FE AX SOP 사내
    공식 문서 채택
  - user-attested 2026-07-24 (grill-me base-resume 세션) — FE AX SOP·Playwright
    검증 체계 팀원 10명 전원 채택(채택률 100%) 확인. 담당자 부재 시에도 동일 기준
    검증·배포 가능 체계 완성. 반복 QA 시간 최종값 3시간→30분으로 소유자 확정
    (세 기록의 관계는 Metrics 주석 참조). Playwright 이력서 표기 단위 "E2E 시나리오
    5종"으로 확정, "600여 건 회귀 시나리오" 표현 이력서에서 폐기. 외부 컨퍼런스
    인사이트→사내 개발 세미나(12회) 이식 구조 확인(외부 발표 아님).
  - user-attested 2026-07-27 (이력서 재작성 세션에서 소유자 구두 확인) — 협업
    도구(Figma·Jira·Slack·Confluence·Notion) 사용 확인. 문서 근거 없음, pending
    documentary source.
  - user-attested 2026-08-11 (소유자 구두 확인, 문서 근거 미확보) — 본인이 직접
    구축한 UI/UX E2E 테스트 도구(JSON 시나리오 기반 채팅 화면 step 자동 조작,
    멀티 viewport desktop/tablet/mobile, 시각 회귀 baseline diff threshold 2%)와
    LLM 채팅 응답 검수 도구(엑셀 질문 목록 자동 입력, 마크다운·표·버튼 포함 LLM
    응답 회귀 검수, 스크린샷/JSON/HTML 갤러리 저장) 두 건 모두 본인 제작임을 확인.
  - user-attested 2026-08-12 (네이버웹툰 지원 세션, 적대 검증 갭 인터뷰) —
    이 항목의 3개 서비스 공통 컴포넌트 레이어(Storybook 기반) 판정에 EXP-01
    "변경 이유가 같은 것만" 기준을 적용한 사실이 없음을 소유자가 확인.
    상세는 EXP-01 Actions [적용 범위 가드레일] 블록 참조.
  - user-attested 2026-08-12 (네이버웹툰 지원 세션, 게이트 보완 갭 인터뷰) —
    (1) 3개 서비스(비즈36.5·AI코치·바이오에이지) 운영 중 신규 화면 개발
    시 컴포넌트를 팀 공통/서비스 로컬 중 어디로 둘지는 본인이 개발 시점에
    직접 판정. (2) 공통 컴포넌트 변경 확산 시 회귀 방지 장치 3종
    (Storybook 스토리 확인·TypeScript 타입/빌드 검사·E2E(Playwright)·수동
    회귀 확인). (3) 공통 컴포넌트는 평면 구조였고 프리미티브/도메인 계층
    구분은 없었음. 문서 근거 없음, pending documentary source.
- Reusable keywords: Playwright, Storybook, FE AX, SOP, 품질 자동화, 운영 데이터
  대시보드, 회귀 테스트, AI 생성 코드 검증, E2E 자동화 단독 도입, Figma, Jira,
  Slack, Confluence, Notion, 협업 도구, GitLab MR, 코드 리뷰, AI 코드 리뷰,
  UI/UX E2E 테스트 도구, 시각 회귀 테스트, visual regression, 멀티 viewport,
  LLM 응답 회귀 검수, 공통/로컬 판정, 회귀 방지 장치, 평면 구조 컴포넌트
- Notes for tailoring: 생산성/품질/AI 개발 프로세스 개선을 강조할 때 사용.
  **AI 테크 리더 포지셔닝(user-attested 2026-07-25, grill-me base-resume 세션)**:
  소유자가 이 항목을 "AI 자동화 수준 + 조직 자산화 + 리더십·학습 능력 + 조직
  생산성 향상"을 보여주는 AI 테크 리더 항목으로 규정. AI 테크 리더십을 강조하는
  JD 대응 시 이 항목을 주요 근거로 활용 가능.
  **하네스 엔지니어링 프레이밍(user-attested 2026-07-25)**: 소유자가 이 표준화
  체계를 "하네스 엔지니어링 구축"으로 규정했으므로, 서술 시 단순 테스트 자동화가
  아니라 "사람이 판정하지 않아도 같은 기준으로 품질이 걸러지는 구조 구축"임을
  강조할 것.
  **Playwright CI 게이트(user-attested 2026-07-25)**: 배포 파이프라인 필수 게이트
  편입(미통과 시 배포 차단, CI 자동 실행)이 확인됐으므로 "팀 표준 강제 메커니즘"
  프레이밍 사용 가능.
  **공통 컴포넌트 레이어 판정 기준 가드레일(user-attested 2026-08-12)**: 이
  항목의 3개 서비스(비즈36.5·AI코치·바이오에이지) 공통 컴포넌트 레이어에서
  "무엇을 공통으로 올리고 무엇을 서비스별로 남길지" 판정할 때 EXP-01의
  "변경 이유가 같은 것만" 기준을 적용했다는 근거는 없다 — 두 판단을 같은
  기준으로 연결해 서술하지 말 것.
  **반복 QA 시간 가드레일(user-attested 2026-07-24 최종 확정)**: 최종 수치는
  3시간→30분. 단, 원본 평가문서는 3시간→1시간이고 문서 근거 미확보 상태이므로
  고부담 외부 문서에서는 원본 문서 값(3시간→1시간)을 우선하거나 소유자에게
  문서 근거 확보를 요청하는 것이 안전하다. 세 기록의 관계(①원본 3시간→1시간,
  ②헤드헌터 인터뷰 2시간→30분, ③최종 확정 3시간→30분)는 Metrics 주석 참조.
  **Playwright 규모 가드레일**: 이력서에는 "E2E 시나리오 5종" 표현 사용,
  "600여 건 회귀 시나리오"는 이력서·자기소개서에서 사용하지 않는다(소유자 확정).
  **공통/로컬 판정 주체 가드레일(user-attested 2026-08-12)**: 3개 서비스
  운영 중 신규 화면 개발 시 컴포넌트를 팀 공통으로 올릴지 서비스 로컬로
  둘지는 본인이 개발 시점에 직접 판정했다고 서술 가능(소유자 확인) — 단,
  위 "공통 컴포넌트 레이어 판정 기준 가드레일"과 정합적으로, 그 판정에
  EXP-01의 "변경 이유가 같은 것만" 기준을 적용했다고는 서술하지 말 것.
  **회귀 방지 장치 가드레일(user-attested 2026-08-12)**: 공통 컴포넌트
  변경이 3개 서비스로 퍼질 때의 회귀 방지 수단은 Storybook 스토리 확인·
  TypeScript 타입/빌드 검사·E2E(Playwright)·수동 회귀 확인 3종으로 한정해
  서술할 것 — 그 외 수단(예: 별도 정적 분석 도구, 자동 스냅샷 diff 서비스
  등)을 추가로 있었던 것처럼 서술하지 않는다.
  **컴포넌트 구조 가드레일(user-attested 2026-08-12)**: 공통 컴포넌트는
  평면 구조였다(소유자 확인) — "기초/프리미티브 계층"과 "도메인 조합
  계층"을 구분하는 계층형 디자인 시스템 구조가 있었던 것처럼 서술하지
  말 것. "디자인시스템급 공통 컴포넌트 체계"라는 기존 표현(Role 참조)은
  유지 가능하나, 계층 구조(atomic design 등)를 갖췄다는 식으로 구체화하지
  않는다.
  **팀 채택 가드레일**: FE AX SOP·Playwright 검증 체계는 팀원 10명 전원 채택
  (채택률 100%), 담당자 부재 시에도 동일 기준 운용 가능 체계로 표기 가능.

### 삼성물산 데이터·모바일 서비스 고도화

- Period: 2024.10 ~ 2025.04
- Context: 데이터 플랫폼과 React Native 모바일 애플리케이션 고도화.
  팀 규모: 삼성물산 프로젝트 팀원 10명 (user-attested 2026-07-27, 이력서
  재작성 세션에서 소유자 구두 확인, 문서 근거 없음).
- Problem: Web 대시보드의 대용량 테이블/시계열 데이터 렌더링과 모바일 앱의
  반복 API 호출 및 플랫폼별 동작 차이가 사용자 대기와 운영 부담을 만들었다.
  모바일 앱의 장비 목록·인력 목록 검색 화면은 수만 건 규모의 데이터가 한 번에
  내려오는 구조였다 (user-attested 2026-07-23 — headhunter-advisor 인터뷰).
- Role: 대용량 데이터 시각화, Spring REST API/데이터 연동, React Native iOS/Android
  개발 및 배포. FE(Vue 렌더링 최적화)와 BE(DB 인덱싱·DTO 투영) 전 과정을 본인이
  직접 수행한 풀스택 기여임 (user-attested 2026-07-23 — headhunter-advisor
  인터뷰에서 사용자 직접 확인)
- Actions:
  - Vue 3, ECharts, RealGrid 기반 대용량 데이터 화면 개발
  - 테이블/차트 렌더링 생명주기 분리와 Lazy Rendering 적용 — 구체 기제:
    - **[FE]** 대용량 데이터를 한 번에 로드하지 않고 동기/비동기로 분리해 단계적
      반영; Vue 렌더링 생명주기에 맞춰 데이터를 순차 바인딩해 초기 화면을 먼저
      그린 뒤 나머지를 채우는 방식(Lazy Rendering의 구체 구현)으로 초기 렌더링
      블로킹을 제거 (user-attested 2026-07-23 — headhunter-advisor 인터뷰)
    - **[BE]** DB 인덱싱 처리와 DTO 기반 필요 필드만 투영(projection)해 응답 자체를
      경량화, 화면 로딩 단축 (user-attested 2026-07-23 — headhunter-advisor 인터뷰)
    - 측정 조건(데이터 행 수·네트워크 환경)은 문서로 특정되지 않음 — 2.5초→1초대
      수치는 기존 그대로 유지하되 조건 창작 금지
  - Spring REST API와 필터링/정렬 로직 설계, 역할별 데이터 조회/표현 구조 개발
  - React Native 앱 검색/조회 흐름 개선 및 플랫폼별 이슈 대응 — 장비 목록·인력
    목록 검색 화면(수만 건 규모) 담당. 구체 기제 (user-attested 2026-07-23 —
    headhunter-advisor 인터뷰):
    - **[진단]** "API 호출이 많아 느릴 것"이라 추정하지 않고, API 응답 시간과
      실제 검색 결과가 화면에 노출되는 시점을 분리해 측정함으로써 클라이언트
      렌더링이 주요 병목임을 특정. 기존 코드는 전달받은 배열을 한 번에 순회해
      모든 목록 컴포넌트를 렌더링(배열 map 전량 렌더)하는 구조였음.
    - **[개입 1]** 배열 map 렌더링을 React Native FlatList 기반 가상화 렌더링으로
      전환 — 가시 영역과 주변 항목만 우선 렌더하고 스크롤에 따라 추가 렌더하는
      방식으로 전환.
    - **[개입 2]** 각 항목의 key 안정적 지정, renderItem 함수 및 목록 아이템
      컴포넌트의 불필요한 재생성·재렌더링 제거.
    - **[개입 3]** 항목 높이가 일정한 화면에 getItemLayout을 적용해 위치 측정
      비용 절감.
    - 효과가 컸던 개입은 debounce/캐싱/서버 쿼리 개선보다 FlatList 가상화 +
      재렌더링 제거였음.
    - 향후 개선 방향(미적용): 서버 페이지네이션·검색 결과 개수 제한은 실제
      구현된 것이 아니라 "향후 더 안정적 구조"로 인식한 수준임 — 실제 구현한
      것처럼 서술 금지.
  - **[상태 관리 범위 구분]** 모든 상태를 전역으로 올리지 않고, 서버 상태는
    React Query(TanStack Query), 화면 로컬 상태는 로컬 state, 여러 화면에서
    공유되는 값만 Recoil 전역으로 구분. 과도한 전역화 시 소변경에도 다수
    화면 재렌더·데이터 동기화 오류 발생, 반대로 로컬만 고집 시 props
    전달·중복 API 증가 문제가 생긴다는 트레이드오프 판단에 기반. 검증
    관점: 불필요 재렌더링·중복 요청·상태 버그·코드 복잡도 감소 여부
    (user-attested 2026-07-23 — headhunter-advisor 인터뷰)
  - **[API 호출 설계 — 사용자 행동 단위]** 검색 입력마다 API를 호출하지
    않고 debounce 적용, 동일 조건 재조회는 React Query 캐시 사용, 중복
    요청 취소로 race condition 방지. 화면 단위가 아닌 사용자 행동 단위로
    API를 설계한 독립 판단. (FlatList 가상화 기제와 별개의 데이터 요청
    설계 판단.) 검증 관점: API 호출 수·응답 순서 오류·서버 부하·검색
    결과 노출 시간 (user-attested 2026-07-23 — headhunter-advisor 인터뷰)
  - **[클라이언트 필터링과 서버 검색의 경계 판단]** 데이터가 적을 때는
    한 번 받아 클라이언트에서 필터링, 데이터가 많아지면 서버 검색+
    페이지네이션으로 전환하는 경계를 규모에 따라 판단. 검증 관점: 데이터
    규모 증가에도 검색 시간 유지·메모리 안정성·API 호출 적정성
    (user-attested 2026-07-23 — headhunter-advisor 인터뷰)
  - **[웹/RN 공통화 범위 제한]** 비즈니스 로직·타입은 웹/RN 간 공유하되
    UI 컴포넌트는 플랫폼별로 분리. 공통화 범위를 제한해 플랫폼별 요구
    대응 속도와 공통 규칙 일관성을 함께 유지하는 설계 판단. 검증 관점:
    플랫폼별 요구 대응 속도·공통 규칙 일관성
    (user-attested 2026-07-23 — headhunter-advisor 인터뷰)
  - **[RN 앱 스토어 출시·운영 — user-attested 2026-08-17, CJ푸드빌(뚜레쥬르
    APP 리빌딩) 지원 세션 갭 인터뷰에서 소유자 직접 확인. 문서 근거 없음,
    pending documentary source.]**
    삼성물산 현장 앱을 React Native로 개발해 App Store(iOS)·Google Play(Android)
    양쪽에 출시·운영. 스토어 등록·심사(리뷰) 대응·버전/배포 관리·크래시
    모니터링·업데이트 운영 전 과정을 본인이 직접 수행. 사용자 규모 약
    100명(소유자 구두 확인, 문서 근거 없음).
    **[사용자 규모 가드레일]**: 삼성물산 앱 약 100명은 EXP-02 비즈36.5
    앱 약 4,000명·EXP-01 AI코치 활성 사용자 3,493명과 각각 별개 서비스의
    수치다 — 혼용·합산 금지.
  - **[네이티브 모듈 브릿지 직접 설계·구현 — user-attested 2026-08-17, 같은
    세션. 문서 근거 없음, pending documentary source.]**
    RN 네이티브 모듈 브릿지를 직접 설계·구현. 브릿지로 주고받은 데이터
    범주: 카메라·파일·푸시 토큰·로그인/인증 토큰·딥링크·스크롤/네비게이션
    이벤트 등.
    **[브릿지 방식 표기 가드레일]**: 삼성물산 프로젝트의 브릿지는 RN
    네이티브 모듈 브릿지로 소유자가 확인. postMessage/JS Interface(Android)/
    WKScriptMessageHandler(iOS) 등 구체 API 명칭은 소유자가 명시 확인하지
    않았으므로 "네이티브 모듈 브릿지" 수준으로만 서술하고 특정 API를
    단정하지 말 것([확인 필요]).
- Technologies: Vue 3, React Native, TypeScript, ECharts, RealGrid, Java, Spring,
  REST API, MyBatis, Oracle, Recoil, TanStack Query (React Query), SQLite,
  Firebase FCM,
  App Store 출시·운영, Google Play 출시·운영, 네이티브 모듈 브릿지
  (user-attested 2026-08-17, CJ푸드빌 지원 세션 갭 인터뷰 — 문서 근거 없음)
  **[DB 정정 — user-attested 2026-07-27, 이력서 재작성 세션]**: 삼성물산
  프로젝트 DB는 Oracle. 기존 기록의 "MySQL" 표기는 오기였으므로 Oracle로
  정정함(MyBatis 사용 사실은 유지, 변경 없음). 문서 근거 없음, 소유자 구두
  확인.
  **[SQLite 재확인 — user-attested 2026-07-27, 이력서 재작성 세션]**: 소유자가
  이력서 기술 스택 표(데이터베이스 행)를 재작성하며 SQLite 사용 사실을
  구두로 재확인. 단, 이 재확인 시점에 특정 프로젝트를 다시 지목하지는
  않았음 — 은행 내 유일한 기존 SQLite 기록인 이 항목(EXP-04, React Native
  로컬 저장소 추정)에 동일 사실로 결부해 기록함. 만약 추후 다른 프로젝트
  귀속이 확인되면 그쪽으로 재이관할 것. 문서 근거 없음, pending documentary
  source.
- Result:
  - 대용량 데이터 조회와 모바일 검색 체감 성능 개선
- Metrics:
  - 대용량 데이터 대시보드 렌더링 시간 2.5초 -> 1초대
  - React Native 앱 검색 응답 시간 5초 -> 1초, 80% 단축
  - **[앱 사용자 규모 — user-attested 2026-08-17, CJ푸드빌 지원 세션 갭
    인터뷰에서 소유자 직접 확인. 문서 근거 없음, pending documentary
    source.]** 삼성물산 현장 앱 사용자 약 100명.
- Evidence / links:
  - `sources/이력서_20260624.pdf`
  - `extracted/이력서_20260624.txt`
  - user-attested 2026-07-23 (headhunter-advisor 인터뷰에서 사용자 직접 확인) —
    FE 동기/비동기 분리·Vue 렌더링 생명주기 순차 바인딩(Lazy Rendering 구현),
    BE DB 인덱싱·DTO projection을 통한 응답 경량화, 위 FE·BE 전 과정이 본인 단독
    풀스택 기여임 확인. 측정 조건(행 수·네트워크)은 문서 미특정.
  - user-attested 2026-07-23 (headhunter-advisor 인터뷰에서 사용자 직접 확인) —
    React Native 검색 성능 개선 구체 기제: 장비 목록·인력 목록(수만 건 규모),
    측정 기반 병목 진단(API 응답 시간 vs 화면 노출 시점 분리 측정 → 클라이언트
    렌더링이 주 병목), 배열 map 전량 렌더 → FlatList 가상화 전환, key 안정화 +
    renderItem·아이템 컴포넌트 재렌더 제거, getItemLayout 적용. 서버 페이지네이션
    등은 미적용(향후 방향으로만 인식). 효과적 개입은 FlatList 가상화 + 재렌더링
    제거.
  - user-attested 2026-07-23 (headhunter-advisor 인터뷰에서 사용자 직접 확인) —
    정성적 기술 결정 사례: 상태 관리 범위 구분(React Query/로컬 state/Recoil
    경계), API 호출 사용자 행동 단위 설계(debounce·캐시·race condition 방지),
    클라이언트 필터링↔서버 검색 경계 판단, 웹/RN 공통화 범위 제한(로직·타입
    공유·UI 분리).
  - user-attested 2026-07-27 (이력서 재작성 세션에서 소유자 구두 확인) — 팀
    규모(삼성물산 프로젝트 팀원 10명) 신규 확인. DB 정정: 기존 "MySQL" 표기는
    오기이며 실제 DB는 Oracle(MyBatis는 그대로 유지). 문서 근거 없음, pending
    documentary source.
  - user-attested 2026-07-27 (같은 세션, 기술 스택 재확인) — SQLite 사용
    사실을 소유자가 재확인(구체 프로젝트 재지목은 없었음, 은행 내 유일한
    기존 SQLite 기록인 이 항목에 결부). 문서 근거 없음, pending documentary
    source.
  - user-attested 2026-08-17 (CJ푸드빌(뚜레쥬르 APP 리빌딩) 지원 세션 갭
    인터뷰에서 소유자 직접 확인. 문서 근거 없음, pending documentary source.)
    — (1) RN 현장 앱을 App Store·Google Play 양쪽에 출시·운영, 스토어 등록·
    심사 대응·버전/배포 관리·크래시 모니터링·업데이트 운영 전 과정 본인 직접
    수행. 사용자 약 100명. (2) RN 네이티브 모듈 브릿지를 직접 설계·구현.
    브릿지 데이터 범주: 카메라·파일·푸시 토큰·로그인/인증 토큰·딥링크·스크롤/
    네비게이션 이벤트 등. 구체 API 명칭(postMessage/JS Interface/
    WKScriptMessageHandler 등)은 소유자 명시 확인 없음([확인 필요]).
- Reusable keywords: 데이터 시각화, Vue 3, ECharts, RealGrid, React Native,
  REST API, Lazy Rendering, DB 인덱싱, DTO projection, 풀스택, 성능 개선,
  FlatList 가상화, 클라이언트 렌더링 최적화, 측정 기반 병목 진단,
  getItemLayout, 상태 관리 경계, React Query, debounce, race condition 방지,
  클라이언트/서버 검색 경계, 웹/RN 공통화, Oracle,
  React Native 앱 출시, App Store, Google Play, 스토어 배포 운영,
  크래시 모니터링, 네이티브-웹 브릿지, 네이티브 모듈, 네이티브 모듈 브릿지
- Notes for tailoring: 데이터 플랫폼, 모바일 앱, 대시보드 직무에 활용.
  2.5초→1초대 수치를 인용할 때는 측정 조건(데이터 규모·네트워크)이 문서로
  특정되지 않았음을 인지하고, 조건을 창작하거나 새 수치를 추가하지 않는다.
  FE·BE 기제를 함께 서술할 때 풀스택 기여(user-attested 2026-07-23)를 명시할
  수 있다. React Native 5초→1초 개선을 서술할 때는 반드시 FlatList 가상화 +
  재렌더링 제거를 주요 개입으로 표기하고, debounce/캐싱/서버 쿼리 개선보다
  효과가 컸다는 점을 함께 병기할 것. 서버 페이지네이션·검색 결과 개수 제한은
  미적용(향후 방향 인식)이므로 실제 구현처럼 서술하지 않는다.
  **DB 정정 가드레일(user-attested 2026-07-27)**: 이 프로젝트의 DB는 Oracle이다
  — 과거 기록의 "MySQL" 표기를 그대로 재사용하지 말 것. 팀 규모(10명)는 문서
  근거 없는 소유자 구두 확인이므로 고부담 외부 문서에서는 뒷받침 자료 확인을
  요청할 것.
  **RN 앱 스토어 출시·운영 가드레일(user-attested 2026-08-17)**: 삼성물산 앱
  사용자 약 100명은 EXP-02 비즈36.5 앱 약 4,000명·EXP-01 AI코치 활성 사용자
  3,493명과 서로 다른 서비스의 수치다 — 혼용·합산 금지. 두 수치 모두 문서
  근거 없는 소유자 구두 확인이므로 고부담 외부 문서에서는 뒷받침 자료 확인을
  요청할 것.
  **네이티브 모듈 브릿지 가드레일(user-attested 2026-08-17)**: 삼성물산
  프로젝트에서는 RN 네이티브 모듈 브릿지를 사용했음이 확인됨. 단,
  postMessage/JS Interface(Android)/WKScriptMessageHandler(iOS) 등 구체 API
  명칭은 소유자 명시 확인 없음 — "네이티브 모듈 브릿지" 수준으로만 서술하고
  특정 API를 단정하지 말 것([확인 필요]).

### 한국미스미 글로벌 B2B 커머스 개선 및 Next.js 전환

- Period: 2022.06 ~ 2024.10
- Context: 글로벌 B2B 커머스의 레거시 유지보수, 성능/SEO/다국어/모니터링 개선.
  PHP/jQuery 레거시를 Next.js로 전면 전환하는 프로젝트로, **한국미스미와 일본미스미가
  전사적으로 참여한 크로스보더 프로젝트**였음 (user-attested 2026-07-23 —
  headhunter-advisor 인터뷰에서 사용자 직접 확인)
  **[3-프로젝트 구성 — user-attested 2026-07-25, grill-me base-resume 세션]**:
  2022.06~2024.10 기간은 다음 3개 프로젝트로 구성됨. 성과 수치 귀속:
  - **유지보수·성능 개선**: 페이지 접근 시간 8초→2초 단축의 귀속 프로젝트.
  - **Next.js 전환**: PHP 서비스 대비 평균 로딩 속도 약 50% 개선의 귀속
    프로젝트.
  - **(인터랙션) 기능 고도화**: 사용자 체류 시간 32% 증가의 귀속 프로젝트
    (측정 도구·기간 상세 [확인 필요]).
  수치를 인용할 때는 위 귀속을 확인하고, 다른 프로젝트의 성과로 혼용하지 않는다.
- Problem: PHP/jQuery 기반 레거시 환경에서 유지보수성과 페이지 성능, SEO, 다국어
  대응, 오류 추적이 필요했다.
- Role: 사용자 기능 개발, PHP/jQuery 레거시 분석, Next.js 전환, 렌더링/성능/SEO/
  다국어/배포/모니터링 구조 개선. 한국 팀 내에서 React를 가장 많이 다뤄본 유일한
  숙련자로서 **한국 측 실질적 React 리드(최숙련자)** 역할을 수행 — 공식 직책(PL 등)
  이 아닌 "팀 내 최숙련자로서의 실질적 리드"이며, 공식 직함으로 단정하지 않는다.
  일본미스미 직원들과 **일본어로 직접** 소통하며 전환을 완료함 — JLPT 1급 실전
  활용 사례로 이력서에서 연결 가능 (user-attested 2026-07-25, grill-me base-resume
  세션). **전체 아키텍처 구조는 일본 본사(일본쪽)가 설계**했고, 한국 web에 맞게
  마이그레이션·변경하는 작업을 본인 포함 6명 팀원이 수행함 (user-attested
  2026-07-23 — headhunter-advisor 인터뷰에서 사용자 직접 확인)
- Actions:
  - PHP/jQuery 기반 B2B 쇼핑몰을 React/Next.js/TypeScript 구조로 전환
  - 일본 본사가 설계한 아키텍처 기반으로 한국 web에 맞게 마이그레이션·변경 수행
    (본인 포함 6명 팀 — 아키텍처 원설계자는 일본 본사)
  - 일본미스미 직원들과 직접 소통하며 한국 측 전환 작업 조율 및 완료
  - Lighthouse, GA, Adobe Analytics, Datadog 기반 성능/SEO/오류 추적 운영
  - 아래 개별 최적화 개입으로 평균 로딩 개선 및 UX 향상 달성(일본 본사 설계
    아키텍처 위에서의 한국 web 성능 개선 개입 — 아키텍처 원설계 아님):
    - **[코드 스플리팅]** React dynamic import 기반 페이지 단위 dynamic loading
      적용으로 초기 로딩 시 불필요한 JS 제거 (user-attested 2026-07-23 —
      headhunter-advisor 인터뷰)
    - **[번들 최적화]** 빌드 시 chunk 크기 압축(번들 청크 최적화) 수행
      (user-attested 2026-07-23 — headhunter-advisor 인터뷰)
    - **[이미지 최적화]** next/image(Image 태그) 본격 활용으로 이미지 로딩
      최적화 (user-attested 2026-07-23 — headhunter-advisor 인터뷰)
    - **[사전 로딩]** next/link(Link 태그)의 prefetch 기능을 활용한 사전
      페이지 로딩 적용 (user-attested 2026-07-23 — headhunter-advisor 인터뷰)
    - Lazy Loading, 비동기 API, 폰트 최적화 (기존 항목 유지)
  - SEO·다국어 대응은 Next.js 전환 시 프로젝트 요구사항에 따른 것으로,
    본인이 전략적으로 주도·설계한 것이 아님 (user-attested 2026-07-23 —
    headhunter-advisor 인터뷰)
  - **[Next.js 전환 목적]** 일본 본사 주도의 전 지사 아키텍처 통일 프로젝트로,
    결과로 Datadog 관측성·다국어·UI/UX 현대화·로딩 속도 개선 등 서비스 전반
    업그레이드가 이루어짐. (user-attested 2026-07-24, grill-me base-resume 세션)
  - **[렌더링 경계 분리 — SSR/CSR 구분]** 일본 본사가 설계한 아키텍처
    위에서, 전체 페이지를 SSR 또는 CSR 하나로 통일하지 않고, 초기 노출이
    중요한 영역은 서버 렌더링(SSR), 상호작용이 많은 영역은 클라이언트
    렌더링(CSR)으로 분리하는 구현 판단을 수행. (전체 아키텍처 원설계는
    일본 본사이며, 이 항목은 "주어진 아키텍처 위에서의 한국 web 렌더링
    경계 구현 판단"으로 스코프를 한정함 — 아키텍처 귀속 가드레일과
    일관.) 검증 관점: 초기 HTML·LCP·hydration 시간·인터랙션 지연
    (user-attested 2026-07-23 — headhunter-advisor 인터뷰)
  - **[반응형 웹 — user-attested 2026-08-10, 티빙 grill-me 세션]**
    미디어 쿼리 기반으로 PC/모바일 화면 크기를 구분 대응하는 반응형 웹
    개발을 수행.
    문서 근거 없음, pending documentary source.
- Technologies: Next.js, React, TypeScript, JavaScript, Redux,
  RxJS [실사용 확인(user-attested 2026-07-25, grill-me base-resume 세션) —
  구체적 쓰임(어느 기능·패턴) [확인 필요]], i18next, PHP, jQuery, Twig,
  Vercel, Datadog, Google Lighthouse, Google Analytics, Adobe Analytics
- Result:
  - 레거시 B2B 커머스의 평균 로딩 속도와 접근 성능 개선
- Metrics:
  - 페이지 접근 시간 8초 -> 2초 단축 (귀속: 유지보수·성능 개선 프로젝트)
  - Next.js 전환 후 기존 PHP 서비스 대비 평균 로딩 속도 약 50% 개선
    (귀속: Next.js 전환 프로젝트)
  - 사용자 체류 시간 32% 증가 — 인터랙션 기능 고도화 이후의 수치. 소유자
    확인, 원본 이력서 표현 유래 (user-attested 2026-07-25, grill-me
    base-resume 세션). 귀속: 기능 고도화 프로젝트.
    측정 도구·기간 상세 [확인 필요 — 면접 대비 확인 항목]
  - **[서비스 규모 — user-attested 2026-08-10, 티빙 grill-me 세션]**
    월 방문자 약 112만, 상품 SKU 약 10만. 재직 당시 소유자가 Google
    Analytics·Adobe Analytics 대시보드를 직접 확인해 파악한 수치.
    문서 근거 없음, pending documentary source.
- Evidence / links:
  - `sources/이력서_20260624.pdf`
  - `extracted/이력서_20260624.txt`
  - user-attested 2026-07-23 (headhunter-advisor 인터뷰에서 사용자 직접 확인) —
    (1) 프로젝트 성격: PHP/jQuery → Next.js 전면 전환, 한국미스미·일본미스미 전사
    참여 크로스보더 프로젝트. (2) 본인 역할: 한국 팀 내 React 최숙련자로서 실질적
    React 리드(공식 직책 아님), 일본미스미 직원과 직접 소통하며 전환 완료. (3)
    아키텍처 귀속: 전체 아키텍처 구조는 일본 본사 설계, 한국 web 마이그레이션·변경은
    본인 포함 6명 팀이 수행 — 아키텍처 원설계자로 표기 금지. (4) 정성적 기술
    결정 사례: 주어진 아키텍처 위에서의 SSR/CSR 렌더링 경계 분리 구현 판단
    (초기 노출 중요 영역=SSR, 상호작용 많은 영역=CSR) — 일본 본사 아키텍처
    범위와 일관되게 "한국 web 구현 판단"으로 스코프 한정.
  - user-attested 2026-07-24 (grill-me base-resume 세션) — Next.js 전환이 일본
    본사 주도의 전 지사 아키텍처 통일 프로젝트였으며, 결과로 Datadog 관측성·
    다국어·UI/UX 현대화·로딩 속도 개선 등 서비스 전반 업그레이드가 이루어졌음
    확인.
  - user-attested 2026-07-25 (grill-me base-resume 세션, 경력기술서 5번 확정) —
    (1) 일본미스미 개발자들과의 크로스보더 소통이 일본어로 직접 이루어짐 — JLPT
    1급 실전 활용 사례. (2) 사용자 체류 시간 32% 증가 — 인터랙션 기능 고도화
    이후 수치, 원본 이력서 표현 유래, 측정 도구·기간 상세 [확인 필요]. (3)
    2022.06~2024.10 기간의 3-프로젝트 구성 및 성과 수치 귀속 확정 — 8초→2초
    (유지보수·성능 개선), 50% 개선(Next.js 전환), 체류 시간 32%(기능 고도화).
    (4) RxJS 실사용 확인 — 구체적 쓰임(어느 기능·패턴) [확인 필요].
  - user-attested 2026-07-27 (이력서 재작성 세션에서 소유자 구두 확인) — 팀
    규모(한국미스미 프로젝트 팀원 6명) 재확인. 기존 Role의 "본인 포함 6명
    팀원이 수행" 기록과 일치, 변경 없음.
  - user-attested 2026-08-10 (티빙 grill-me 세션) — 반응형 웹(미디어 쿼리 기반
    PC/모바일 대응) 개발 수행 확인. 서비스 규모: 월 방문자 약 112만·상품 SKU
    약 10만을 소유자가 재직 당시 GA·Adobe Analytics 대시보드에서 직접 확인.
    두 사실 모두 문서 근거 없음, pending documentary source.
- Reusable keywords: B2B 커머스, Next.js 전환, 레거시 개선, 성능 최적화, SEO,
  모니터링, 크로스보더 프로젝트, 한일 협업, React 리드, 마이그레이션,
  SSR/CSR 렌더링 경계, LCP, hydration, 렌더링 분리, 아키텍처 통일,
  Datadog 관측성, UI/UX 현대화, 일본어 직접 소통, JLPT, 체류 시간, RxJS,
  반응형 웹, 미디어 쿼리, 월 방문자 112만, 대규모 트래픽
- Notes for tailoring: 커머스/프론트엔드 성능 개선 사례로 활용. **아키텍처
  귀속 가드레일(user-attested 2026-07-23)**: 전체 아키텍처 구조는 일본 본사가
  설계했으므로 본인을 아키텍처 원설계자로 표기하지 않는다 — "한국 web 마이그
  레이션 리드"로만 표기. **직책 가드레일**: "팀 내 최숙련자로서의 실질적 React
  리드"로만 표기하고, PL 등의 공식 직함으로 단정하지 않는다. **팀 기여
  가드레일**: 마이그레이션 실행은 본인 포함 6명 팀 — "혼자 전부 전환"으로
  과장 금지. 기존 수치(페이지 접근 8초→2초, 평균 로딩 50% 개선)는 그대로
  유지, 새 수치 창작 금지. **SSR/CSR 렌더링 경계 가드레일**: 이 구현 판단은
  일본 본사 아키텍처 위에서의 "한국 web 구현 판단"으로만 표기하고,
  아키텍처 설계 자체를 본인이 주도한 것처럼 서술하지 않는다.
  **일본어 소통 연결(user-attested 2026-07-25)**: 일본미스미 개발자와의
  소통이 일본어로 직접 이루어진 사실은 JLPT 1급 실전 활용 사례로 이력서에서
  어학 자격과 연결해 표기 가능. 단, 소통 대상(어떤 업무, 어느 단계)의 구체
  상세는 면접 대비 항목으로 두고, 연결 표기 시 과장하지 않는다.
  **체류 시간 가드레일(user-attested 2026-07-25)**: "사용자 체류 시간 32%
  증가"는 기능 고도화 프로젝트의 귀속 수치이며, 측정 도구·기간 상세가
  [확인 필요] 상태다. 외부 이력서에 이 수치를 사용하기 전에 소유자에게
  측정 도구·기간 확인을 요청할 것. 다른 프로젝트(유지보수·성능 개선,
  Next.js 전환)의 성과와 혼용 금지.
  **3-프로젝트 귀속 가드레일(user-attested 2026-07-25)**: 8초→2초는
  유지보수·성능 개선, 50%는 Next.js 전환, 체류 시간 32%는 기능 고도화로
  각각 귀속이 확정되었다. 서술 시 수치와 프로젝트를 혼용하지 않는다.
  **RxJS 가드레일(user-attested 2026-07-25)**: RxJS 실사용은 확인됐으나
  구체적 쓰임(어느 기능·패턴)은 [확인 필요]. 면접에서 구체 사용 패턴을
  질문받을 수 있으므로 소유자 확인 후 외부 문서에 상세 서술할 것.
  **서비스 규모 가드레일(user-attested 2026-08-10)**: 월 방문자 약 112만·
  상품 SKU 약 10만은 소유자가 재직 당시 GA·Adobe Analytics 대시보드에서
  직접 확인한 수치다. 이력서·자기소개서에서 이 수치를 사용할 때는 반드시
  "GA·Adobe Analytics 기준" 스코프를 병기할 것. 문서 근거 없음(pending
  documentary source)이므로 고부담 외부 문서에서는 소유자에게 뒷받침 자료
  확인을 요청할 것.

### 2025 대웅제약 성과 평가 기반 사업 기여

- Period: 2025년
- Context: 에스크미, AI코치, 생체나이, 비즈케어 관련 성과
  **[병합 노트 — user-attested 2026-07-24, grill-me base-resume 세션]**: AI코치 =
  AI 건강검진 챗봇은 동일 서비스임을 소유자가 확인. 이 항목의 "AI코치 신규 화면
  11건·기능 13건" 수치는 "AI 건강검진 챗봇 제품화 및 플랫폼 확장" 항목과 동일
  서비스의 수치. 두 항목 간 상호 참조: 챗봇 아키텍처·기술 상세는 해당 항목을
  참조.
  **[병합 노트 — user-attested 2026-07-25, grill-me base-resume 세션]**: 비즈케어
  = 비즈36.5 = "B2B 임직원 건강 플랫폼 풀스택 내재화"(EXP-02) 항목의 플랫폼과
  동일 서비스임을 소유자가 확인. 이 항목의 "비즈케어 UI/UX 전면 개편 주도 →
  대웅제약 대상 판매 1.0억(조직 KR 세부)" 사실은 EXP-02의 상업적 성과 앵커로
  연결됨 — EXP-02와 상호 참조.
- Problem: 외주/분산 구조 내재화, AI코치 신규 개발, 생체나이 서비스 이관, 운영 리스크 제거가 필요했다.
- Role: AI코치 신규 개발, 비즈케어 내재화, 생체나이 UI/운영 리스크 개선, 데모/서비스 도입 지원. 프로젝트별 기여 성격 — 비즈케어: UI/UX를 전면 개편해 대웅제약 대상 판매로 이어진 사례를 본인이 주도, 생체나이: 외주로 도입된 V2 버전을 본인이 유지보수·수정하여 서울성모병원에 납품, 에스크미: 한국 KMI를 대상으로 유지보수 지원, AI코치: 비즈케어의 사이드 상품으로 패키지 형태 추가 판매(파생 매출)에 기여 (user-attested 2026-07-23 — headhunter-advisor 인터뷰에서 사용자 직접 확인)
- Actions:
  - 비즈케어 외주/분산 구조 내재화 및 고도화 — UI/UX를 전면 개편해 대웅제약 대상
    판매로 이어지는 성과에 본인이 주도적으로 기여
    (user-attested 2026-07-23 — headhunter-advisor 인터뷰에서 사용자 직접 확인)
  - AI코치 신규 개발 및 실서비스 전환 주도 — 비즈케어의 사이드 상품으로 패키지 형태
    추가 판매되는 파생 매출 구조에 해당
    (user-attested 2026-07-23 — headhunter-advisor 인터뷰에서 사용자 직접 확인)
  - 생체나이(바이오에이지) 서비스 UI와 데이터 운영 리스크 제거 — 외주로 도입된 V2
    버전을 본인이 유지보수·수정하여 서울성모병원에 납품.
    **[Electron CA]** 바이오에이지 CA(Client Agent)는 Electron 기반 데스크톱
    애플리케이션이며, 소유자가 해당 서비스를 유지보수한 경험 있음
    (user-attested 2026-08-10, 네이버웹툰 grill-me 세션). 세부 작업 범위
    (메인 프로세스/IPC/자동 업데이트/패키징/렌더링·캐싱·오프라인 여부)는
    [확인 필요] — 이력서에는 "Electron 기반 Client Agent 유지보수" 범위로만
    노출하고, 세부 Electron 역량(IPC 설계·패키징 등)을 단정 서술하지 않는다.
    면접 대비로 세부 범위 소유자 정리 권장.
    **[Electron CA 기능 확정]** 위 [확인 필요]를 부분 해소: 이 Electron 기반
    데스크톱 클라이언트의 명칭은 "Report Export Service Manager"이며, 기능은
    "리포트 자동 추출"(스케줄러 주기 기반으로 리포트 파일을 자동 다운로드해
    이미지/PDF로 저장)로 서술 가능. 다만 메인 프로세스/IPC/자동 업데이트/
    패키징/렌더링·캐싱/오프라인 여부 등 구현 세부는 여전히 미확인이므로
    이 범위를 넘는 단정 서술은 금지. 소유자가 유지보수한 앱이므로(위
    [Electron CA] 참조) 이력서 동사는 "유지보수"를 유지하고 "구축"은 쓰지
    않는다. (user-attested 2026-08-11, 문서 근거 미확보)
    **[운영관리 시스템 화면]** 바이오에이지 운영관리 시스템의 리포트 관리·
    표준코드 관리 화면을 본인이 개발/수정함.
    (user-attested 2026-08-11, 문서 근거 미확보)
    **[AWS 인프라]** 바이오에이지 프로젝트에서 AWS S3를 활용해 서버리스 환경에서
    개발·배포·빌드를 수행했으며 AWS EC2도 함께 활용함
    (user-attested 2026-07-24, 소유자 갭 인터뷰).
    GCP는 이 프로젝트 및 대웅 재직 전 기간 통틀어 활용한 경험 없음
    [GCP 갭 — 확인됨: user-attested 2026-07-24]
    (user-attested 2026-07-23 — headhunter-advisor 인터뷰에서 사용자 직접 확인)
  - 에스크미 한국 KMI를 대상으로 유지보수 지원
    (user-attested 2026-07-23 — headhunter-advisor 인터뷰에서 사용자 직접 확인,
    원본 평가 문서에 없던 신규 항목)
  - 개발 세미나 12회 운영, 기술 문서 48건 축적
- Technologies: AI코치, WebView, React, Next.js, Nest.js, Zustand, PostgreSQL,
  AWS S3, AWS EC2, 서버리스 배포, Jenkins CI/CD, Storybook, PostHog,
  Tailwind CSS, Electron (바이오에이지 CA 유지보수 — user-attested 2026-08-10,
  세부 범위 [확인 필요], 문서 근거 없음)
  - Electron [확인 필요] 부분 해소: 명칭 "Report Export Service Manager",
    기능 "리포트 자동 추출"(스케줄러 기반 리포트 파일 자동 다운로드·
    이미지/PDF 저장) — 위 [Electron CA 기능 확정] 블록 참조. 구현 세부
    (IPC/패키징 등)는 여전히 미확인. 이력서 동사는 "유지보수" 유지, "구축"
    금지. (user-attested 2026-08-11, 문서 근거 미확보)
  - React · Next.js · Nest.js: 바이오에이지(생체나이) 서비스의 기술 스택에 포함됨
    (user-attested 2026-07-25, 포트폴리오 재작성 세션).
    [확인 필요 — 각 스택의 구체 역할: 어느 부분이 Next.js 렌더링이고 어느 부분이
    Nest.js 서버인지 면접 대비 소유자 확인 필요]
    ※ Nest.js는 이 은행 내 최초 등장 스택임 — 면접에서 구체 활용 범위·패턴을
    질문받을 수 있으므로 소유자 확인 전까지 심화 역량으로 단정하지 않는다.
    참고: 이 스택은 outputs/portfolio.pdf(2026-07-25 재작성판) 바이오에이지 페이지
    "핵심 기술" 행에 동일하게 사용됨.
    **[귀속 재확인 — user-attested 2026-07-27, 이력서 재작성 세션]** Nest.js가
    "백엔드 개발에 사용됨"이라는 사실이 2026-07-27 세션에서 별도로 재확인됐고,
    소유자가 이를 바이오에이지 서비스 소속으로 명시적으로 확인함 — EXP-01에
    임시로 기록됐던 항목을 이 항목으로 귀속 정정. 동일 사건이며 별도 사용처
    아님(위 [확인 필요]는 "어느 부분이 렌더링/서버인지"의 세부 역할 질문으로,
    귀속 자체는 해소됨).
  - Zustand: 바이오에이지(생체나이) 서비스의 상태관리 라이브러리로 사용됨
    (user-attested 2026-07-27, 이력서 재작성 세션 — 소유자 구두 확인, 문서
    근거 없음). 원래 EXP-01에 임시 귀속으로 기록됐던 항목을 소유자 정정에
    따라 이 항목으로 이관함. 구체 사용 화면·범위는 [확인 필요].
  - PostgreSQL: 바이오에이지(생체나이) 서비스에서 사용 중임을 소유자가 귀속
    확정 (user-attested 2026-07-27, 같은 세션). "Unattributed Technologies"
    보류 섹션에서 이관됨. 구체 용도(어느 데이터, 어느 기능)는 [확인 필요].
    문서 근거 없음, pending documentary source.
  - AWS S3 실사용 및 서버리스 환경 개발·배포·빌드 파이프라인 경험 확인됨
    (user-attested 2026-07-24, 바이오에이지 프로젝트).
    **[AWS 스코프 정밀화 — user-attested 2026-08-10, 티빙 grill-me 세션]**
    S3·EC2는 구성된 환경 위에서 배포 파이프라인을 운영한 범위이며, 버킷/
    인스턴스를 본인이 직접 설계·구축한 것은 아님. 이력서 동사는 "활용·운영"을
    쓰고 "구축"은 쓰지 않는다. 문서 근거 없음, pending documentary source.
  - AWS EC2 활용 경험 확인됨 (user-attested 2026-07-24).
    (AWS EC2도 위 S3 스코프 정밀화와 동일한 "운영 범위" 가드레일 적용:
    인스턴스 직접 설계·구축 아님, 동사는 "활용·운영"으로 한정.
    user-attested 2026-08-10, 티빙 grill-me 세션)
  - **[CloudFront 갭 — user-attested 2026-08-10, 티빙 grill-me 세션]**
    CloudFront 활용 경험 없음 확정 — 미기재 대상. 향후 CloudFront 관련
    JD 대응 시 갭으로 처리할 것. 문서 근거 없음.
  - [GCP 갭] GCP 활용 경험 없음 — 소유자가 명시적으로 "GCP는 활용해본 적 없음"
    확인. 향후 GCP 관련 JD 대응 시 갭으로 처리할 것.
    (user-attested 2026-07-24, 소유자 갭 인터뷰)
- Result:
  - 매출 지표와 서비스 안정성, 내재화 속도 개선
- Metrics:
  - 원문 기준 총 4.66억 원 매출 창출, KR1 목표 대비 93.2%
  - 원문 세부 항목: 비즈케어 1.0억, AI코치 0.2억, 생체나이 2.5억, 에스크미 0.9억. 세부 항목 합계는 4.6억으로 총액 4.66억과 차이가 있어 외부 문서에서는 총액 또는 세부 항목 중 하나만 사용 권장
  - 생체나이 기존 고객 112처 중 93처, 83% 안정 전환
  - AI코치 신규 화면 11건, 신규 기능 13건 개발
  - 2차 PoC 검증 모집단 기준 사용성 4.18점, 만족도 4.06점, 완성도 4.05점.
    3,493명은 이 PoC를 거쳐 실서비스로 전환된 뒤의 실제 활성 사용자 수 —
    EXP-01("AI 건강검진 챗봇 제품화 및 플랫폼 확장") Metrics의 [활성 사용자
    수 — 정정] 항목과 동일 사건(user-attested 2026-07-27, 소유자 구두 확인,
    문서 근거 없음). 이중 계상 방지: 두 항목에서 각각 독립 수치처럼 표기하지
    않는다.
  - HTTP/2 전환으로 네트워크 비용 1,200KB -> 900KB, 25% 감소
  - 평균 응답 속도 1.2s -> 0.7s
  - FE 에러 0건
  - Jenkins CI/CD 배포 리드타임 10분 -> 2분, 80% 단축
  - 비즈케어 내재화 3일 내 완료
- Evidence / links:
  - `sources/연종합평가2025_정다훈.xlsx`
  - `extracted/연종합평가2025_정다훈.md`
  - user-attested 2026-07-23 (headhunter-advisor 인터뷰에서 사용자 직접 확인) — 프로젝트별 기여 성격(비즈케어 UI/UX 개편 주도, 생체나이 외주 V2 유지보수·수정 후 서울성모병원 납품, 에스크미 한국 KMI 유지보수 지원, AI코치 비즈케어 파생 패키지 판매) 및 4.66억(세부 4개 항목 포함)이 개인이 아닌 조직/팀 전체 KR 목표 수치라는 확인
  - user-attested 2026-07-27 (이력서 재작성 세션에서 소유자 구두 확인, 갭 정정) —
    Nest.js·Zustand가 바이오에이지(생체나이) 서비스 소속임을 명시적으로 확인.
    EXP-01("AI 건강검진 챗봇 제품화 및 플랫폼 확장")에 임시로 기록됐던 두 항목을
    이 항목(바이오에이지)으로 귀속 이관함. 문서 근거 없음, pending documentary
    source.
  - user-attested 2026-07-27 (같은 세션, 은행-이력서 불일치 정정) — 3,493명은
    2차 PoC 검증 모집단이 실서비스로 전환된 뒤의 실제 활성 사용자 수임을 확인
    (EXP-01 Metrics [활성 사용자 수 — 정정] 항목과 동일 사건). 문서 근거 없음,
    pending documentary source.
  - user-attested 2026-07-27 (같은 세션, 귀속 확정) — PostgreSQL 사용처를
    소유자가 이 서비스(바이오에이지)로 확정. "Unattributed Technologies"
    보류 섹션에서 이관됨. 문서 근거 없음, pending documentary source.
  - user-attested 2026-08-11 (소유자 구두 확인, 문서 근거 미확보) — 바이오에이지
    운영관리 시스템의 리포트 관리·표준코드 관리 화면을 본인이 개발/수정했음을
    확인. Electron 기반 데스크톱 클라이언트의 명칭이 "Report Export Service
    Manager"이며 기능은 "리포트 자동 추출"(스케줄러 기반 리포트 파일 자동
    다운로드·이미지/PDF 저장)임을 확인 — 위 [Electron CA]의 [확인 필요]를
    기능 범위에 한해 해소(구현 세부는 여전히 미확인).
- Reusable keywords: 매출 기여, 내재화, AI코치, 생체나이, 비즈케어, FE 에러 0건, CI/CD, 기술 세미나, Zustand, PostgreSQL, Electron, Client Agent, Report Export Service Manager, 리포트 자동 추출, 운영관리 시스템, 리포트 관리, 표준코드 관리
- Notes for tailoring: 사업성과/조직기여/내재화 관점이 필요한 자기소개서에 활용. 비즈케어와 비즈36.5, 생체나이와 바이오에이지는 문맥에 따라 함께 쓰이는 명칭이므로 제출 문서에서는 하나의 명칭으로 통일. **팀 KR 가드레일(user-attested 2026-07-23, headhunter-advisor 인터뷰)**: Metrics의 총 4.66억 및 세부 항목(비즈케어 1.0억/AI코치 0.2억/생체나이 2.5억/에스크미 0.9억)은 조직/팀 전체 KR 목표 수치이며 본인 개인의 매출 성과가 아니다. 본인은 4개 프로젝트 전부에 FE 개발자로 직간접 기여했지만 기여 강도는 프로젝트마다 다르다(비즈케어=UI/UX 개편 주도, 생체나이=외주 V2 유지보수·수정 후 납품, 에스크미=유지보수 지원, AI코치=비즈케어 파생 패키지 판매). 자기소개서·이력서 작성 시 이 총액/세부 금액을 본인 단독 성과처럼 서술하지 말고, 반드시 "팀/조직 성과에 기여" 프레이밍과 위 Role의 프로젝트별 기여 성격을 함께 명시할 것 — writer/tailor는 팀 성과를 개인 성과처럼 과장하지 않는다.
  **PostgreSQL 가드레일(user-attested 2026-07-27)**: PostgreSQL은 바이오에이지
  서비스 사용으로 귀속 확정됐으나 구체 용도(어느 데이터, 어느 기능)는 아직
  특정되지 않았고 문서 근거도 없다 — 고부담 외부 문서에서는 뒷받침 자료
  확인을 요청할 것.
  **AWS 스코프 가드레일(user-attested 2026-08-10, 티빙 grill-me 세션)**:
  S3·EC2는 구성된 환경 위에서 배포 파이프라인을 운영한 범위이며, 버킷/인스턴스를
  본인이 직접 설계·구축한 것은 아님. 이력서·자기소개서에서 동사는 "활용·운영"을
  쓰고 "구축"은 쓰지 않는다. CloudFront는 무경험 확정(미기재 대상). 두 사실 모두
  문서 근거 없음, pending documentary source.

### 비즈36.5 Node.js(Express) BFF 신규 구축 및 AI 챗봇 Python 로직 기여

- Period: 2025.07 ~ 재직중 중 대웅제약 AI추진팀 기간 내 (정확한 시작월 [확인 필요])
- Context: 대웅제약 AI추진팀 / 비즈36.5(비즈케어) B2B 헬스케어 플랫폼 및 AI 건강검진
  챗봇
- Problem: 신규 기능에서 React 프론트가 여러 백엔드 데이터를 집계·가공해 받아야 했고,
  AI 챗봇 응답의 프롬프트 구성·후처리 품질을 개선해야 했다. 더 넓게는 모놀리식
  구조에서 BE-FE를 분리하려는 전략의 일환이었고, RESTful API를 점진적으로 도입해
  Spring Boot/Thymeleaf의 강결합을 개선하려는 목적도 있었다.
- Role: 프론트 전용 BFF API 신규 구축(팀 공동), AI 챗봇 서버의 Python 프롬프트·후처리
  로직 기여(팀 공동). AI 챗봇 Python 기여 범위에는 VectorDB·RAG 구현 참여,
  Langchain 활용 파인튜닝 경험 포함 — 단, 소유자 자평 "깊이는 깊지 않음"이므로
  "참여·경험" 수준으로 한정하며 "설계·주도·독립 구축"으로 표기 금지
  (user-attested 2026-07-24, 소유자 갭 인터뷰)
- Actions:
  - 비즈36.5에서 React 프론트 전용 데이터 집계·프록시(BFF) REST API를 Node.js(Express)로
    신규 구축 (기존 Spring Boot 대체가 아닌 신규 개발)
  - 비동기 I/O 이점과 프론트–백엔드 TypeScript 스택 통일을 위해 Node를 선택
  - BE-FE 미분리 모놀리식 구조를 분리하는 전략의 일환으로, RESTful API를 점진 도입해
    Spring Boot/Thymeleaf 강결합을 개선하는 방향으로 BFF를 구축(팀 공동)
  - AI 챗봇(Python) 서버의 프롬프트 구성·응답 후처리(Markdown/표/링크 변환 등) 로직
    일부를 직접 수정·기여
  - **[VectorDB·RAG 구현 참여]** 대웅 AI 챗봇에서 VectorDB와 RAG(Retrieval-Augmented
    Generation) 구현에 참여함. 팀 맥락에서의 참여이며 독립 설계·주도는 아님.
    (user-attested 2026-07-24, 소유자 갭 인터뷰)
  - **[Langchain 활용 파인튜닝 경험]** Langchain을 활용한 LLM 파인튜닝 과정에 경험함.
    소유자 자평 "깊이는 깊지 않음" — 참여·경험 범위이며 심화 전문성 주장 금지.
    (user-attested 2026-07-24, 소유자 갭 인터뷰)
  - **[Python pandas 데이터 처리]** Python pandas 라이브러리로 데이터 처리 경험 있음.
    소유자 자평 "그렇게 깊이는 깊지 않음" — 기초·경험 수준이며 데이터 엔지니어링
    수준의 전문성 주장 금지.
    (user-attested 2026-07-24, 소유자 갭 인터뷰)
- Technologies: Node.js, Express, TypeScript, Python, LangChain, VectorDB, RAG,
  pandas, REST API, SSE
- Result:
  - React 프론트의 다중 백엔드 데이터 연동을 단일 BFF 계층으로 단순화
  - AI 챗봇 응답 포맷·프롬프트 품질 개선에 기여
  - VectorDB·RAG·Langchain 파인튜닝 실사용 환경 참여 경험 확보
- Metrics:
  - 정량 지표 미확보 (있으면 추후 추가)
- Evidence / links:
  - user-attested 2026-07-05 (grilling 세션에서 사용자 직접 확인)
  - user-attested 2026-07-23 (headhunter-advisor 인터뷰에서 사용자 직접 확인) — BFF
    구축이 모놀리식 구조에서 BE-FE를 분리하려는 전략의 일환이었고, RESTful API 점진
    도입으로 Spring Boot/Thymeleaf 강결합을 개선하려는 목적도 있었다는 전략적 배경
    확인 (팀 공동 범위는 변경 없음)
  - user-attested 2026-07-24 (소유자 갭 인터뷰, GS리테일 AX 지원 계기) —
    VectorDB·RAG 구현 참여, Langchain 활용 파인튜닝 경험, Python pandas 데이터 처리
    경험 확인. 소유자 자평 "깊이는 깊지 않음" — 전부 참여·경험 범위로 한정.
    문서 근거 미확보 (user-attested only, 면접 대비 needs_confirmation 성격).
  - 문서 근거 미확보 — 이력서 PDF·평가 문서에는 미기재. pending documentary source.
- Reusable keywords: Node.js, Express, BFF, TypeScript 스택 통일, 비동기 I/O,
  Python, LLM 프롬프트, 응답 후처리, 풀스택, VectorDB, RAG, LangChain, 파인튜닝,
  pandas, 데이터 처리
- Notes for tailoring: Node/Python이 필수·우대인 포지션(두산로보틱스 Fullstack 등)에서
  사용. 반드시 "신규 BFF 구축(팀 공동)"·"Python 로직 일부 기여(팀 공동)" 범위로만
  표기. "Spring Boot를 Node로 대체", "Python AI 서버 구축/개발" 같은 표현은 사실과
  다르므로 금지. 정량 지표가 없으므로 수치 창작 금지.
  **[AI/데이터 기여 범위 가드레일 — user-attested 2026-07-24]**: VectorDB·RAG 구현
  참여 및 Langchain 파인튜닝, pandas 데이터 처리는 소유자가 "깊이는 깊지 않음"으로
  자평한 참여·경험 수준이다. 이력서·자기소개서에서 이 항목들을 인용할 때는
  "참여", "활용 경험", "기여" 표현만 허용하며 "주도", "설계", "구축", "전문" 등
  심화 역량으로 확대하지 않는다. 문서 근거가 없으므로 고부담 외부 문서에서는
  소유자에게 뒷받침 자료 확인을 요청하는 것이 안전하다.

### AI 소프트웨어 사이드 프로젝트 (개인)

- Period: [확인 필요 — 시작·종료 시점 불명]
- Context: 업무 외 개인 시간에 AI 소프트웨어를 직접 제작한 사이드 프로젝트.
  (user-attested 2026-07-24, grill-me base-resume 세션)
- Problem: [확인 필요 — 구체 문제/목적 미확인]
- Role: 개인 단독 제작.
- Actions: [확인 필요 — 구체 프로젝트명·내용 미확인]
- Technologies: LangChain, HuggingFace, RAG, VectorDB (체득 스택으로 소유자가
  언급. user-attested 2026-07-24, grill-me base-resume 세션). 세부 사용 방식
  및 추가 기술 [확인 필요].
- Result: ML·LLM 스택(LangChain·HuggingFace·RAG·VectorDB)을 사이드 프로젝트를
  통해 직접 체득. (user-attested 2026-07-24, grill-me base-resume 세션)
- Metrics: [확인 필요 — 정량 지표 없음]
- Evidence / links:
  - user-attested 2026-07-24 (grill-me base-resume 세션) — 소유자가 AI
    소프트웨어를 사이드 프로젝트로 직접 제작해 ML·LLM 스택을 체득했다고
    확인. 구체 프로젝트명·내용·기간은 미확인 [확인 필요].
- Reusable keywords: LangChain, HuggingFace, RAG, VectorDB, ML, LLM, AI,
  사이드 프로젝트, 자기계발, 개인 프로젝트
- Notes for tailoring: AI/ML 스택 경험을 묻는 JD 대응 시 보조 근거로 활용
  가능. **반드시 [확인 필요] 항목(프로젝트명·내용·기간)을 소유자에게 확인한
  뒤에만 외부 문서에 기재할 것.** 비즈36.5 BFF·AI 챗봇 항목의 업무 내
  LangChain/VectorDB/RAG 참여 경험(EXP-07)과 혼용하지 않는다 — 사이드
  프로젝트(개인)와 업무 참여(팀)를 구분해 서술.

## Achievement Fragments

Use this section for short, validated bullet material that can be remixed.

- AI 건강검진 챗봇을 PoC 검증(사용성 4.18점·서비스 만족도 4.06점·완성도 4.05점)
  후 실서비스로 전환했고, 전환 후 임직원 대상 실제 활성 사용자 3,493명을
  확보했다(활성 사용자 수치 정정: user-attested 2026-07-27, 문서 근거 없음).
  계획 대비 2주 조기로 실서비스 활성화를 달성했다(user-attested 2026-07-27,
  문서 근거 없음 — PoC 고도화 자체의 일정 단축이 아님에 유의).
- SSE 기반 실시간 응답과 Markdown 렌더링 안정화로 AI 답변 출력 시간을 10초에서 4초로 60% 단축했다.
- Config-Driven UI와 Base-Theme 구조로 신규 고객사(웰체크) 온보딩 시 FE 커스터마이징 납품 기간을 10주(최초 챗봇 구현 기간)에서 2주(FE 납품 기준, LLM/BE 일정 별도)로 단축 가능한 구조를 설계했다.
- B2B 임직원 건강 플랫폼을 9주 내 108개 페이지·82개 화면으로 전환하고, 신규 건강관리 기능 3건을 End-to-End로 개발했다.
- Playwright E2E 자동화를 단독으로 판단·도입해 600여 건의 회귀 시나리오를 자동화하고
  무결점 빌드·배포 가능한 상태를 확보했다. 반복 QA 시간은 3시간 → 30분으로 단축됨
  (user-attested 2026-07-24, grill-me base-resume 세션 최종 확정치; 원본 평가문서
  값 3시간→1시간, 문서 근거 미확보 — EXP-03 Metrics 가드레일 참조).
- 운영 데이터 확인 절차를 3단계 수작업에서 1단계 자동화 대시보드로 전환했다.
- 반복 컴포넌트 개발 시간을 90분에서 15분으로 약 83% 단축했다.
- 대용량 데이터 대시보드 렌더링 시간을 2.5초에서 1초대로 개선했다.
- React Native 앱 검색 응답 시간을 5초에서 1초로 80% 단축했다.
- PHP 기반 B2B 커머스를 Next.js/React/TypeScript 구조로 전환하며 평균 로딩 속도를 약 50% 개선했다.
- 2025년 비즈케어·AI코치·생체나이·에스크미 전반에서 원문 기준 총 4.66억 원 매출 기여를 기록했다.

## Unattributed Technologies (Pending Project Attribution)

Use this section for stack items the owner has confirmed as real experience but
has **not yet attributed to a specific project/EXP entry**. Do not guess or
assign these to an EXP entry based on plausibility — a prior mistake (Nest.js /
Zustand initially recorded under the wrong EXP entry, corrected 2026-07-27)
showed that guessing attribution creates rework and reviewer-facing
inconsistency. Once the owner names the project, move the row into that EXP's
Technologies field (with a note) and delete it from here.

| Technology | Status | Source | Note |
| --- | --- | --- | --- |
| _(현재 비어 있음 — 2026-07-27 기준 대기 항목 없음)_ | | | |

**해소 이력(참고용, 표에서 제거됨)**: PostgreSQL과 MongoDB(NoSQL)가 이 표에
있었으나 2026-07-27 같은 세션에서 소유자가 귀속을 확정해 이관됨 — PostgreSQL
→ EXP-06("2025 대웅제약 성과 평가 기반 사업 기여", 바이오에이지) Technologies,
MongoDB(NoSQL) → EXP-01("AI 건강검진 챗봇 제품화 및 플랫폼 확장", AI코치와
동일 서비스) Technologies. 두 항목 모두 [확인 필요] — 사용 프로젝트 미상
표시는 해제됐고, 출처는 `user-attested 2026-07-27 구두 확인, 문서 근거 없음`
그대로 유지됨. 상세는 각 EXP의 Technologies/Evidence 참조.

**Note (SQLite는 이 표에 없었음)**: SQLite는 은행에 기존 기록이 있어(EXP-04
"삼성물산 데이터·모바일 서비스 고도화" Technologies, `sources/이력서_20260624.pdf`
근거) 이 표에 넣지 않고 해당 EXP-04 항목에 2026-07-27 재확인 노트로
결부시켰다 — 상세는 EXP-04 Technologies/Evidence 참조.

**섹션 유지 방침**: 위 해소로 표가 비었지만, 귀속 미상 스택을 추정 없이
대기시키는 이 섹션의 컨벤션 자체는 앞으로도 유용하므로 삭제하지 않고
유지한다. 새로운 귀속 미상 기술이 확인되면 이 표에 행을 추가할 것.

## Metrics To Verify

Numbers here are not ready to use until confirmed.
Do not use these metrics in final copy until their status is changed to
`confirmed`.

| Claim | Source | Status |
| --- | --- | --- |
| 정보처리기사 발급일(월) | `sources/이력서_20260624.pdf` | confirmed — 취득월 2020.08 (user-attested 2026-07-22). 원본 PDF는 미표기였으나 소유자 확인 |
| TOEIC 825점 취득일 | `extracted/이력서_20260624.txt` | confirmed — 취득일 2024.05 |
| JLPT 1급 취득일 | `extracted/이력서_20260624.txt` | confirmed — 취득일 2018.08 |
| 연봉 5,700만원 포함 여부 | `sources/이력서_20260624.pdf` | user confirmation required |
| 테스트 커버리지 98%의 기준(라인/브랜치/시나리오) | `extracted/연종합평가2025_정다훈.md`(L68), `extracted/이력서_20260624.txt`(L200) | value confirmed as "98% 수준" — 라인/브랜치/시나리오 세부 기준은 원본 미기재이므로 "98% 수준"으로만 표기, 특정 기준 단정 금지 |
| 답변 화면 정상 출력률 100%의 검증 범위 | `extracted/2026_상반기종합평가.md`(L10), `extracted/이력서_20260624.txt`(L129) | confirmed — 400건 기준. 사용 시 "400건 발화 검증 기준" 스코프를 항상 함께 표기 |
| FE 에러 0건의 측정 기간/범위 | `sources/연종합평가2025_정다훈.xlsx` | scope confirmation needed |
| 만족도 점수의 척도(5점 만점 여부) | `extracted/연종합평가2025_정다훈.md`(L18,25), `extracted/이력서_20260624.txt`(L127) | values confirmed (3,493명 검증, 사용성 4.18/만족도 4.06/완성도 4.05, "4점 이상" 목표). 명시적 "5점 만점" 문구는 원본에 없으므로 "5점 만점" 단정 금지 |
| 2025년 총 4.66억 매출과 세부 항목 4.6억의 차이 | `sources/연종합평가2025_정다훈.xlsx` | reconciliation needed |
| 신규 AI 챗봇 구축 기간 10주->2주 단축의 범위 | `experience-bank.md`(EXP-01 Metrics), headhunter-advisor 인터뷰 (user-attested 2026-07-23) | confirmed — 10주는 챗봇 최초 구현 기간, 2주는 신규 고객사(웰체크) 온보딩 시 Base-Theme을 활용한 FE 커스터마이징 납품 기간(FE 납품 기준, LLM/BE 일정 별도). 사용 시 이 스코프를 항상 함께 표기하고 "챗봇 전체를 2주 만에 구축"이라는 확대 해석 금지 |
| 2020.10~2022.05 내담씨앤씨 초기 프로젝트 상세 | `sources/이력서_20260624.pdf` | needs source detail |
| 반복 QA 시간 최종 확정값 (3시간→30분) 문서 근거 | user-attested 2026-07-24 grill-me base-resume 세션 (최종 override). 세 기록의 관계: ①원본 평가문서 3시간→1시간, ②user-attested 2026-07-23 headhunter-advisor 인터뷰 2시간→30분, ③user-attested 2026-07-24 grill-me 세션 3시간→30분으로 소유자 최종 확정(①시작값+②종착값 결합) | pending documentary source — 소유자가 3시간→30분으로 최종 확정했으나 뒷받침 문서 미확보. 고부담 외부 문서에서는 원본 평가문서 값(3시간→1시간) 우선하거나 소유자 문서 근거 확보 후 사용 권장. 이력서 본문(EXP-03 Metrics)은 이미 3시간→30분으로 반영 완료. |
| AI 발화 응답 평균 2초대 문서 근거 | user-attested 2026-07-24 grill-me base-resume 세션. 네트워크에서 데이터 수신 기준 — 기존 "출력 시간 10초→4초"와 측정 대상이 다름(10초→4초는 출력 완료까지 전체 시간, 2초대는 네트워크 수신 기준 별도 지표). | pending documentary source — 소유자 직접 확인이나 뒷받침 문서 미확보. 이력서 본문(EXP-01 Metrics)에는 두 수치의 측정 대상 차이 주석과 함께 수록. 두 수치를 동일 맥락에서 혼용 금지. |
| Playwright 600여 건(평가문서) ↔ E2E 시나리오 5종(코드베이스 실측)의 관계 | 평가문서 원문: "600여 건 회귀 시나리오". 코드베이스 실측: "E2E 시나리오 5종". 소유자 결정 2026-07-24: 이력서·자기소개서에는 5종 사용, 600여 건 폐기. | 미해소 — 5종 시나리오 내 케이스 총합과 600여 건의 관계(5종이 600여 건을 포함하는지, 별개 카운팅인지)는 소유자에게 미확인. 외부 문서에는 소유자 확정 표현 "E2E 시나리오 5종"만 사용하고, 관계 해소 전까지 600여 건 수치는 사용하지 않는다. |
