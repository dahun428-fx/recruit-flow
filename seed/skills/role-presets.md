# Role Presets (직무군 타겟팅 프리셋)

과거 지원 이력에서 역추출한 직무군별 타겟팅 프리셋. 출처:
`target-companies.md`의 6개 엔트리(CJ ENM·NHN두레이·두산로보틱스·넥스트증권·
카카오페이증권·쿠팡이츠) + 엔트리 없이 초안만 있는 2개(밀리의서재·AX본부 —
`outputs/millie-*`, `outputs/ax-harness-*`에서 역추출, targeting 기록 부재로
근거 약함). **전례 신뢰도 구분**: 제출본 전례(doosan·cj-enm·millie·nhn)가
1급, 미제출 초안 전례(coupang·kakaopay·next-sec·ax)는 참고용 — 특히
kakaopay 초안은 점수 게이트 FAIL(66/68) 상태였으므로 그 타겟팅 결정을
모범 전례로 삼지 않는다. 새 회사 지원 시 `tailor`는 JD를 분석해 **프리셋 하나를
선택**하고, 프리셋과 다른 부분(예외)만 하이라이트한 **타겟팅 브리프**를
소유자에게 선승인받는다. 브리프가 승인되면 초안 방향은 확정된 것으로 보고,
이후 소유자 리뷰는 신규 작문 diff로 좁힌다 (fast lane — `AGENTS.md` 참조).

프리셋의 신설·수정은 소유자 승인 필요. 승인된 브리프의 회사 고유 결정은
`target-companies.md` 해당 엔트리에 남겨 프리셋을 지속 보강한다.

## 타겟팅 브리프 형식 (선승인 대상, 1페이지 이내)

```markdown
## 브리프: <회사 / 직무>
- 프리셋: <아래 중 하나> (선택 근거 한 줄)
- 프리셋 대비 예외: (핵심 — 이것만 읽어도 승인 판단 가능해야 함)
  - <예외 1: 예. "이 JD는 웹소켓 명시 → 갭 인터뷰 필요">
- 강조 경험 순서: EXP-.. → EXP-.. → EXP-..
- 뺄 것 / 축소할 것:
- 키워드 매핑: (JD 요건 ↔ 근거 요약)
- Screen profile 제안: <Balanced|AI-Product|Platform-DS|Scale-Perf> + Pass bar
- 레인(잠정): <fast|full> + 근거 한 줄 (초안 후 재판정됨)
- 리스크/갭: (공통 가드 외 회사 고유분만)
- 갭 인터뷰 항목: (은행/experience-bank에 근거 없는 JD 요건 → 소유자 질문 목록)
```

## 공통 가드 (모든 프리셋 공통 — 브리프에 재기재하지 않는다)

- **경력 연수**: "총 5년 9개월"(2020.10~2026.07 기준, 시점 재계산) 정확 표기.
  "6년차"는 요약 산문에서만 허용, 수치 병기 금지. "7년차" 등 상향 표기 금지.
- **무경험 스택 날조 금지**: gRPC · GraphQL · WebSocket(실무) · TCP/UDP · Go ·
  Angular · Vite/ESBuild · Emotion · PNPM · GitHub Actions · Jira/Confluence.
  인접 경험(SSE, REST, Next.js 번들링, Jenkins/GitLab CI/CD)으로만 표기.
  웹소켓은 사이드 프로젝트 구현(user-attested 2026-07-22)을 자소서에서만.
- **C-01**: Node BFF·Python 기여는 "신규 BFF 구축"·"로직 일부 기여" 범위,
  "팀 공동" 문구는 이력서 노출 금지(사실은 experience-bank에 유지).
- **needs_scope 지표**(사용성 4.18·400건 출력률·커버리지 98%·매출 4.66억·FE
  에러 0건): 스코프 병기 없이 본문 강조 금지. 병기 유지 여부는 브리프에서 확정
  (두산 전례: 병기 유지 / 쿠팡 전례: 미노출 → 회사별 결정).
  [기록 충돌 — 소유자 확인 필요: kakaopay 엔트리 (g)의 "쿠팡 전례 동일"은
  쿠팡 기록(미노출)과 모순되며 두산 전례(병기 유지)를 의도한 것으로 보임.]
- **금지어**: "공통 구조 확보"→"공통 컴포넌트 구조 설계", "조직 자산화"→"정착"
  (S-01 계열, `feedback-rules.md`가 정본).

## 프리셋

### fe-platform — 서비스/플랫폼 프론트엔드

- 신호: SPA 서비스 개발·운영, 디자인시스템/공통 컴포넌트, 안정 운영,
  레거시 전환, AI 기능 "도입" (전례: NHN두레이, 밀리)
- 강조 순서: EXP-01(AI 실서비스 도입) → EXP-02(고객사별 운영·점진 전환) →
  EXP-03(품질·테스트·공유 문화) → EXP-05(성능) → EXP-04
- 헤드라인 계열: "서비스 프론트엔드 안정 운영, 디자인시스템·공통 컴포넌트,
  성능 품질 개선, AI 기능 도입을 함께 다루는 Frontend Engineer" (nhn)
- 키워드 코어: React·Vue 3·TypeScript, SPA, 디자인시스템, 공통 컴포넌트,
  Storybook, 성능 최적화, 레거시 전환, SSE·AI 도입, 빌드 프로세스, 학습·공유
- Screen profile: **Platform-DS**

### ai-product — AI 제품/Product Engineer

- 신호: "AI로 비즈니스 문제 해결", Product Engineer 지향, AI Coding
  Agent/생성형 AI 명시, 특정 스택 비고정 (전례: CJ ENM)
- 강조 순서: EXP-01(AI 챗봇 제품화) → EXP-03(FE AX SOP·AI Agent) →
  EXP-05(대규모 서비스) → EXP-04
- 헤드라인 계열: "React·Vue 서비스 개발과 AI 기반 프론트엔드 생산성 개선을
  연결하는 Frontend Engineer" (cj-enm)
- 키워드 코어: AI 서비스 제품화, LLM·SSE Streaming, Markdown Renderer,
  AI Agent, FE AX SOP, 디자인 시스템, 테스트 자동화, Product Engineer
- Screen profile: **AI-Product**

### fullstack — 풀스택/플랫폼 엔지니어

- 신호: 백엔드~프론트 전체 스택, API 설계, 데이터 파이프라인, 내부 도구,
  업무 자동화 (전례: 두산로보틱스)
- 강조 순서: EXP-02(End-to-End 내재화) → EXP-07(Node BFF) → EXP-04(API
  설계·데이터) → EXP-03(자동화) → EXP-01(실시간 스트리밍)
- 헤드라인 계열: "API·BFF부터 React UI·배포 자동화까지 구현하는 Fullstack
  Developer" (doosan) — "Frontend 중심" 병기는 회사 판단
- 키워드 코어: TypeScript, End-to-End, REST API 설계, MySQL·Spring Boot,
  Node.js(Express) BFF, 모듈화·계층 분리, SSE, CI/CD, 업무 자동화
- Screen profile: 전례 미지정 — **Platform-DS** 제안(승인 필요)
- 주의: "실시간 통신" 라벨 금지 → "SSE 단방향 이벤트 스트리밍"으로 표기,
  "클린 아키텍처 지향"→"계층 분리·의존성 정리" (doosan 전례)

### fintech — 금융/증권 프론트엔드

- 신호: 백오피스·운영 데이터·대시보드(백오피스형) 또는 MTS·실시간·웹뷰
  (트레이딩형). 공통: 금융 도메인 무경험 → 전이 어필만, 도메인 창작 금지
- 강조 순서 (백오피스형, 전례: 넥스트증권): EXP-04(대용량 대시보드·역할별
  조회) → EXP-02(Web/Admin E2E) → EXP-05(성능) → EXP-03
- 강조 순서 (트레이딩형, 전례: 카카오페이증권): EXP-01(웹뷰·SSE 실시간) →
  EXP-05(SSR·CSR) → EXP-03(테스트·LLM 도구·멘토링) → EXP-04
- 헤드라인 계열: "복잡한 운영 데이터 관리 시스템과 웹 성능을 직접 설계하는
  프론트엔드 개발자" (next-sec) / "웹뷰 기반 실시간 서비스를 설계하고 팀 개발
  기준을 세우는 Frontend Engineer" (kakaopay)
- 키워드 코어: React·Next.js·TypeScript·TanStack Query, 관리자/백오피스,
  데이터 대시보드·테이블, 역할별 조회, 성능 최적화, 웹뷰, 실시간(SSE),
  단위·E2E 테스트
- Screen profile: 두 하위형 모두 전례 미지정(next-sec·kakaopay 엔트리에 태그
  없음) — 백오피스형 **Balanced**, 트레이딩형 **Scale-Perf**를 제안하며 둘 다
  승인 필요

### commerce — 커머스/대규모 웹 플랫폼

- 신호: 웹 아키텍처 설계·리드, PC·모바일 웹, 성능·생산성, 컴포넌트화·모듈화,
  E-commerce/O2O (전례: 쿠팡이츠 Staff)
- 강조 순서: EXP-05(커머스 아키텍처·성능) → EXP-01(Config-Driven·컴포넌트화)
  → EXP-03(품질·생산성·가이드) → EXP-04(모바일)
- 헤드라인 계열: "PC·모바일 웹 아키텍처를 설계하고 성능·생산성을 끌어올리는
  Frontend Engineer" (coupang)
- 키워드 코어: 웹 아키텍처, PC·모바일 웹, React·Vue·Node.js, 성능 최적화,
  컴포넌트화·모듈화, Config-Driven UI, Storybook, 크로스팀, E-commerce
- Screen profile: **Scale-Perf** 제안(승인 필요)

### ax-harness — AI 하네스/AX 엔지니어링

- 신호: AI 활용 표준화, 프로토타입→제품화, 재사용 표준, 데이터 가공,
  비개발 직군 협업 (전례: AX본부)
- 강조 순서: EXP-03(FE AX SOP·하네스) → EXP-01(AI 제품화) → EXP-07(Python·
  SQL·BFF) → EXP-02
- 헤드라인 계열: "현업과 가설을 정의하고, AI를 활용해 프로토타입을 배포·운영하며
  그 경험을 재사용 표준으로 정리하는 Product Engineer" (ax 기반 — 원문의
  "6년차"는 공통 가드(헤드라인 연차 표기 금지)에 걸려 제거함; 재사용 시 주의)
- 키워드 코어: AI Coding Agent(Codex·Claude Code), 검증·금지 패턴·보안 기준,
  E2E 자동화, 판정 기준, Python·SQL 데이터 가공, 재사용 표준
- Screen profile: **AI-Product** 제안(승인 필요)
- 주의: ax 초안은 유일하게 하다체 — 재사용 시 문체 결정 필요

## 프리셋 밖 신호 (브리프에서 예외로 다뤄야 하는 것)

- 팀 리드/멘토링 명시 요구 → 세미나 12회·SOP·기준 수립으로 간접 입증만,
  직함·인원수 주장 금지 (kakaopay·coupang 전례)
- 구축형(설치형)·협업툴 자체 개발 요구 → 고객사별 배포·유지보수 전이 어필만
  (nhn 전례: "구축형 내재화" 표현 정정 이력 있음)
- 관측성 특정 도구(OpenTelemetry 등) → 보유 도구(Datadog·GA4·PostHog·
  Lighthouse)로 방법론만 어필 (kakaopay 전례)
- 연차 상향 요구(7년+) → 정확 표기 + 상향지원 여부는 소유자 결정 (kakaopay·
  coupang 전례)
