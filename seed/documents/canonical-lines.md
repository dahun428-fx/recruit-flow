# Canonical Lines (확정 문장 은행)

소유자가 **승인한 이력서 문장**을 경험별 불릿 단위로 축적하는 은행이다.
`experience-bank.md`가 팩트(근거)의 정본이라면, 이 파일은 **승인된 프로즈**의
정본이다. 목적: writer/tailor가 새 회사 변형을 만들 때 "작문"이 아니라
"재조립 + JD에 필요한 부분만 신규 작문"으로 동작하게 하여, 소유자 리뷰를
신규 작문 diff로 좁힌다.

## 운영 규칙

- **적재 기준**: 소유자가 실제 제출했거나 승인한 버전의 문장만 `approved`로
  적재한다. 미제출 초안의 문장은 `candidate`로 적재하고 배치 승인을 기다린다.
  `candidate` 문장은 재조립 소스로 쓸 수 있으나, 쓰인 부분은 신규 작문과
  동일하게 diff 리뷰 대상이다.
- **검증 면제**: `approved` 문장을 **무수정 재사용**한 부분은 reviewer의
  정밀 팩트 검증을 면제한다(fast lane). 단 한 글자라도 수정되면 신규 작문으로
  취급한다. no-fabrication 검증 체계는 이 면제 위에서만 좁혀진다 — 은행
  자체의 신뢰가 깨지면 안 되므로, 적재는 소유자 승인 없이 하지 않는다.
- **승격 루프**: 새 회사 버전이 최종화(제출 또는 소유자 확정)될 때마다, 그
  버전에서 신규 작문·수정된 문장을 이 은행에 `approved`로 승격 제안한다.
  렌더 단계 직후 일괄 제안한다 (`AGENTS.md` Resume Engine과 동일 시점).
  기록 주체는 최상위 에이전트만이며 서브에이전트는 이 파일을 편집하지
  않는다.
- **변형 관리**: 같은 주장(claim)의 다른 표현은 variant로 나란히 둔다.
  직무군 태그가 선택 기준이다. 낡거나 대체된 표현은 삭제하지 않고
  `retired`로 표기한다(어느 제출본에 쓰였는지 이력이 남아야 하므로).
  `retired` 문장은 재사용 금지 — 내용이 필요하면 신규 작문으로 다시 쓴다.
- **시점 민감 문장**: 연차·기간·"현재" 표현이 든 문장은 승인 시점 기준이다.
  재사용 시 반드시 오늘 날짜로 재계산하고, 문구가 달라지면 신규 작문으로
  취급한다 (`time-bound: true` 태그를 점진 적용; 태그가 없어도 연차·기간
  수치가 든 문장은 시점 민감으로 간주한다).
- **금지**: 이 파일에 새 사실(수치·역할·기간)을 만들어 넣지 않는다. 모든
  문장은 `experience-bank.md`/`profile.md`의 근거 범위 안에 있어야 하며,
  근거 추가는 archivist를 통해 experience-bank에 먼저 이뤄져야 한다.

## 태그 스키마

```yaml
- line: "문장 원문 (verbatim)"
  exp: EXP-01            # experience-bank 경험 ID (SUMMARY = 요약/자기소개 프로즈)
  roles: [fe, fullstack] # 직무군 태그, 아래 목록 참조
  section: 경력기술       # 경력기술 | 요약 | 헤드라인
  status: approved       # approved | candidate | retired
  sources: [doosan, nhn] # 출처 버전 (회사 슬러그)
  approved: 2026-07-22   # 승인일 (candidate면 생략)
```

직무군 태그: `fe`(프론트엔드) · `fullstack`(풀스택/플랫폼) ·
`ai-product`(AI 제품/챗봇) · `fintech`(금융/백오피스) ·
`commerce`(커머스) · `ax`(AI 하네스/생산성). 신설은 소유자 승인 필요.

경험 ID 매핑 (experience-bank.md 헤딩 순):

| ID | 경험 |
| --- | --- |
| EXP-01 | AI 건강검진 챗봇 제품화 및 플랫폼 확장 |
| EXP-02 | B2B 임직원 건강 플랫폼 풀스택 내재화 |
| EXP-03 | 품질·개발·운영 자동화 및 FE AX 기준 수립 |
| EXP-04 | 삼성물산 데이터·모바일 서비스 고도화 |
| EXP-05 | 한국미스미 글로벌 B2B 커머스 개선 및 Next.js 전환 |
| EXP-06 | 2025 대웅제약 성과 평가 기반 사업 기여 |
| EXP-07 | 비즈36.5 Node.js(Express) BFF 신규 구축 및 AI 챗봇 Python 로직 기여 |

출처 슬러그: `doosan` 두산로보틱스 · `cj-enm` CJ ENM · `millie` 밀리의서재 ·
`nhn` NHN두레이 (이상 제출본) · `coupang` 쿠팡이츠 · `kakaopay` 카카오페이증권 ·
`next-sec` 넥스트증권 · `ax` AX 하네스 (이상 미제출 초안).

---

## 문장 은행

approved 238건 / candidate 290건 / retired 0건 (크로스 중복으로 candidate 원문이 approved에 흡수된 32건 별도), 적재 2026-07-23.
제출본 4개(doosan·cj-enm·millie·nhn) 추출분은 `approved`, 미제출 초안 4개(coupang·kakaopay·next-sec·ax) 추출분은 `candidate`.
보조 파일 슬러그는 본 회사 슬러그로 통일(dooray·dooray-career→nhn, millie-career→millie, cj-enm-rewrite→cj-enm, next→next-sec).
candidate 항목 `note:` 앞머리의 E-ID는 추출 파일의 variant 참조용 ID다. ax 초안은 전체가 하다체(다른 초안은 합니다체)다.

### EXP-01 · AI 건강검진 챗봇 제품화 및 플랫폼 확장

```yaml
# --- approved (제출본) ---
- line: "AI 건강검진 챗봇 실시간 응답 UI 및 Markdown 렌더링 구조 구현"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
- line: "SSE 기반 실시간 LLM 응답과 Base-Theme·Config-Driven UI 기반 모듈화 구조 구축"
  exp: EXP-01
  roles: [fullstack]
  section: 헤드라인
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 위 헤드라인 변형 (variant-a=doosan)
- line: "AI 기능 실서비스 도입과 Base-Theme·Config-Driven UI 기반 공통 컴포넌트 구조 구축"
  exp: EXP-01
  roles: [fe]
  section: 헤드라인
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 위 헤드라인 변형 (variant-b=dooray)
- line: "AI코치 — AI 건강검진 챗봇 실서비스 전환 및 FE 공통 품질 기준 구축"
  exp: EXP-01
  roles: [fe]
  section: 헤드라인
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: EXP-01+EXP-03 통합 헤드라인 (dooray-career)
- line: "대웅제약 | AI 실시간 서비스 도입·공통 컴포넌트 구조"
  exp: EXP-01
  roles: [fullstack]
  section: 헤드라인
  status: approved
  sources: [doosan]
  approved: 2026-07-23
- line: "SSE 기반 LLM 응답 처리와 렌더링 구현"
  exp: EXP-01
  roles: [fullstack]
  section: 헤드라인
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 핵심 성과 소제목
- line: "AI 서비스의 실시간 응답 UI와 Markdown 렌더링 구조 구현"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
  note: 핵심 성과 소제목
- line: "AI 기능의 실서비스 도입"
  exp: EXP-01
  roles: [fe]
  section: 헤드라인
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 핵심 성과 소제목
- line: "AI 서비스 제품화 및 실시간 응답 UI 구축"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 핵심 성과 소제목
- line: "AI 서비스 실시간 응답 UI와 Markdown 렌더링 구조 구현"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 핵심 성과 소제목 (millie-career)
- line: "고객사별 정책을 Config와 공통 컴포넌트로 분리"
  exp: EXP-01
  roles: [fullstack]
  section: 헤드라인
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 핵심 성과 소제목
- line: "공통 컴포넌트·설정 기반 UI 구조 설계"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
  note: 핵심 성과 소제목
- line: "디자인시스템·공통 컴포넌트 구조 설계 및 운영"
  exp: EXP-01
  roles: [fe]
  section: 헤드라인
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 핵심 성과 소제목
- line: "확장 가능한 디자인 시스템·플랫폼 UI 구조 설계"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 핵심 성과 소제목
- line: "SSE로 내려오는 답변의 중지·재시도·오류 상태를 화면과 맞추고, Markdown·표·링크·차트를 React 컴포넌트로 바꿨습니다. AI 답변이 화면에 뜨는 시간을 10초에서 4초로 줄이고, 발화 400건 검증에서 화면 정상 출력률 100%를 확인했습니다."
  exp: EXP-01
  roles: [fullstack]
  section: 요약
  status: approved
  sources: [doosan]
  approved: 2026-07-23
- line: "AI 건강검진 챗봇에서 SSE 기반 실시간 응답, 답변 중지·재시도·오류 상태 처리, Markdown·표·링크·차트 렌더링 구조를 구현했습니다. LLM 답변 출력 시간을 10초에서 4초로 줄이며, 비정형 AI 응답을 안정적인 프론트엔드 화면 경험으로 전환했습니다."
  exp: EXP-01
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
- line: "SSE 기반 실시간 LLM 응답 스트리밍, 답변 중지·재시도·오류 상태 처리, Markdown·표·링크·차트 렌더링 구조를 실서비스에 도입했습니다. XSS 필터링과 오류 가드레일을 적용해 비정형 AI 응답을 안정적인 화면 경험으로 전환했습니다. AI 답변 출력 시간을 10초에서 4초로 단축하고, 400건 발화 검증 기준 답변 화면 정상 출력률 100%를 달성했습니다."
  exp: EXP-01
  roles: [fe]
  section: 요약
  status: approved
  sources: [nhn]
  approved: 2026-07-23
- line: "PoC 수준의 LLM 챗봇을 실서비스로 전환. SSE 기반 실시간 스트리밍, 답변 중지·재시도·오류 상태 처리, Markdown·표·링크·차트를 화면 컴포넌트로 변환하는 전용 렌더링 계층을 구축해 AI 답변 출력 10초 → 4초로 개선"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [millie]
  approved: 2026-07-23
- line: "AI 건강검진 챗봇에서 SSE 기반 실시간 응답, 답변 중지·재시도·오류 상태 처리, Markdown·표·링크·차트 렌더링 구조를 구현. LLM 답변 출력 시간을 10초 → 4초, 초기 진입을 30초 → 6초로 줄이고 Lighthouse 91점 확보"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: (millie-career)
- line: "고객사마다 다른 UI·문구·기능 노출을 Config-Driven UI·Base-Theme로 나누고, 반복되는 화면을 공통 컴포넌트·Custom Hook으로 정리했습니다. 반복 컴포넌트 개발·검증 시간을 90분에서 15분으로 줄였습니다."
  exp: EXP-01
  roles: [fullstack]
  section: 요약
  status: approved
  sources: [doosan]
  approved: 2026-07-23
- line: "고객사별 UI, 문구, 테마, 기능 노출 조건을 Config-Driven UI와 Base-Theme 구조로 분리하고, Storybook 기반 공통 컴포넌트 개발·검증 절차를 수립했습니다. 신규 서비스나 고객사별 화면 확장 시 반복 구현을 줄이고 재사용 가능한 프론트엔드 구조를 확보했습니다."
  exp: EXP-01
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
- line: "고객사별 UI, 문구, 테마, 기능 노출 조건을 Config-Driven UI와 Base-Theme 구조로 분리하고, Storybook 기반 공통 컴포넌트 개발·검증 절차를 수립했습니다. 디자인시스템에 준하는 공통 컴포넌트 구조를 구축해 신규 서비스·고객사별 화면 확장 시 반복 구현 공수를 줄이고 재사용 가능한 컴포넌트 자산을 확보했습니다. 반복 컴포넌트 개발·검증 시간을 90분에서 15분으로 단축했습니다."
  exp: EXP-01
  roles: [fe]
  section: 요약
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: cj-enm 공통 컴포넌트 블럽의 변형
- line: "고객사별 UI·테마·문구·기능 노출 조건을 Config-Driven UI와 Base-Theme로 분리하고 공통 컴포넌트·Storybook으로 표준화해 신규 AI 챗봇 구축 기간을 10주 → 2주(80%) 단축 가능한 구조 확보"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [millie]
  approved: 2026-07-23
- line: "3,493명 대상 AI 건강검진 챗봇 PoC를 실사용 가능한 서비스 형태로 고도화"
  exp: EXP-01
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn]
  approved: 2026-07-23
  note: dooray는 뒤에 " (AI 기능 실서비스 도입)" 추가
- line: "3,493명 대상 AI 건강검진 챗봇 PoC를 실서비스로 전환"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 항목 변형
- line: "LLM 답변 출력 10초 → 4초, 초기 진입 30초 → 6초, Lighthouse 91점"
  exp: EXP-01
  roles: [fe, fullstack, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, nhn, coupang, kakaopay, next-sec]
  approved: 2026-07-23
  note: 미제출 초안 동일 문장 흡수(E1-25; next만 "(성능 최적화)" 태그 추가)
- line: "LLM 답변 출력 10초 → 4초, 초기 진입 30초 → 6초 개선"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
  note: 위 항목 변형
- line: "SSE 기반 실시간 LLM 응답 스트리밍·오류 가드레일 실서비스 도입 (SSE 실시간 스트리밍)"
  exp: EXP-01
  roles: [fullstack]
  section: 경력기술
  status: approved
  sources: [doosan]
  approved: 2026-07-23
- line: "Config-Driven UI·Base-Theme 기반 공통 컴포넌트 구조 설계 및 운영 (모듈화·클린 아키텍처)"
  exp: EXP-01
  roles: [fullstack]
  section: 경력기술
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 원문에서 앞 불릿과 줄바꿈 없이 붙어 있음(포맷 결함)
- line: "Config-Driven UI·Base-Theme 기반 디자인시스템 구조 설계 및 공통 컴포넌트 개발·운영"
  exp: EXP-01
  roles: [fe]
  section: 경력기술
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 위 항목 변형
- line: "목업 수준의 AI 건강검진 챗봇을 실사용 가능한 서비스로 고도화해야 했습니다. 초기 PoC는 답변 생성 후 일괄 출력하는 구조라 체감 대기 시간이 길었고, Markdown·표·링크·차트 등 비정형 실시간 응답을 안정적으로 렌더링하는 체계와 고객사별 화면·테마·기능 노출 조건을 일관되게 관리하는 구조가 없었습니다."
  exp: EXP-01
  roles: [fe, fullstack]
  section: 경력기술
  status: approved
  sources: [doosan, nhn]
  approved: 2026-07-23
  note: 문제 문단. dooray는 "비정형 실시간 응답" 대신 "비정형 응답"
- line: "목업 수준의 AI 건강검진 챗봇을 실제 사용 가능한 서비스로 고도화해야 했습니다. 초기 PoC는 답변 생성 후 일괄 출력하는 구조라 체감 대기 시간이 길었고, Markdown·표·링크·차트 등 비정형 응답을 안정적으로 렌더링하고 오류 상황을 처리하는 체계가 부족했습니다."
  exp: EXP-01
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
  note: 위 문제 문단 변형 (cj-enm·cj-enm-rewrite·millie-career)
- line: "목업 수준 AI 챗봇을 실서비스로 고도화해야 했습니다. 초기 PoC는 답변 생성 후 일괄 출력이라 체감 대기가 길었고, Markdown·표·링크 등 비정형 응답의 안정적 렌더링·오류 대응 체계가 부족했습니다."
  exp: EXP-01
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 문제 문단 변형 (압축판)
- line: "목업 수준의 AI 건강검진 챗봇(AI코치)을 3,493명이 검증하는 실사용 서비스로 고도화하고, 서비스 확대에 맞춰 AI코치를 비롯한 비즈36.5·바이오에이지 운영 서비스 전반의 프론트엔드 공통 품질·개발 기준을 세워야 했다."
  exp: EXP-01
  roles: [fe]
  section: 경력기술
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 위 문제 문단 변형 (평서형·EXP-03 결합, dooray-career)
- line: "AI 개발자와 API 응답 형식, 스트리밍 방식, 오류 정책을 조율"
  exp: EXP-01
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn]
  approved: 2026-07-23
  note: doosan은 뒤에 " (API 설계 협업)" 추가
- line: "AI 개발자와 API 응답 형식, 스트리밍 방식, 오류 정책을 조율하고 SSE 기반 실시간 응답·중지·재시도·오류 상태 흐름 설계"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: millie는 "응답 형식·스트리밍·오류 정책을 조율하고," 로 ·연결 (millie·millie-career)
- line: "SSE 기반 실시간 응답, 답변 중지·재시도·오류 상태 흐름 설계"
  exp: EXP-01
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, coupang, kakaopay, next-sec]
  approved: 2026-07-23
  note: doosan " (SSE 실시간 스트리밍)", dooray " (AI 기능 도입)" 추가. 미제출 초안 동일 문장 흡수(E1-38; coupang "(SSE 실시간 스트리밍)", kakaopay "(실시간 스트리밍)" 태그, next 태그 없음)
- line: "SSE 기반 실시간 응답, 답변 중지·재시도·오류 상태 흐름 설계·구현"
  exp: EXP-01
  roles: [fe]
  section: 경력기술
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 위 항목 변형 (dooray-career)
- line: "프론트엔드 아키텍처 설계·개발 및 AI·백엔드 응답 형식·스트리밍·오류 정책 조율"
  exp: EXP-01
  roles: [fe]
  section: 경력기술
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: (dooray-career)
- line: "Markdown 전용 렌더링 계층을 구현해 표·목록·링크·차트를 React 컴포넌트로 변환"
  exp: EXP-01
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie, coupang, kakaopay, next-sec]
  approved: 2026-07-23
  note: 미제출 초안 동일 문장 흡수(E1-40; coupang만 "(컴포넌트화)" 태그)
- line: "Markdown 전용 렌더링 계층 구현(표·목록·링크·차트를 React 컴포넌트로 변환), XSS 필터링·404·500·LLM 오류 가드레일 적용"
  exp: EXP-01
  roles: [fe]
  section: 경력기술
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 위 항목 변형 (가드레일 결합형, dooray-career)
- line: "XSS 필터링과 404·500·LLM 오류 가드레일을 적용해 비정형 응답 출력 안정성 확보"
  exp: EXP-01
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie]
  approved: 2026-07-23
  note: doosan 원문은 앞 Python 불릿과 붙어 있음(포맷 결함). millie는 "가드레일로 비정형 응답 출력 안정성 확보"
- line: "React Query 캐싱, 코드 스플리팅, 이미지 최적화, HTTP/2 전환으로 초기 진입·네트워크 병목 개선"
  exp: EXP-01
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie]
  approved: 2026-07-23
  note: millie·dooray-career는 쉼표 대신 가운뎃점 연결
- line: "공통 화면·테마·컴포넌트를 Base-Theme로 분리하고 고객사별 차이를 Config-Driven UI로 관리"
  exp: EXP-01
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie, coupang, next-sec]
  approved: 2026-07-23
  note: doosan " (모듈화)", dooray " (디자인시스템 구조 수립)" 추가. 미제출 초안 동일 문장 흡수(E1-44; coupang만 "(모듈화)" 태그)
- line: "Base-Theme·Config-Driven UI 기반 공통 컴포넌트 구조 구축(고객사별 화면·테마·문구·기능 노출 조건 분리)"
  exp: EXP-01
  roles: [fe]
  section: 경력기술
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 위 항목 변형 (dooray-career)
- line: "3,493명 규모 PoC 운영"
  exp: EXP-01
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn]
  approved: 2026-07-23
- line: "만족도 조사 기준 사용성 4.18, 서비스 만족도 4.06, 완성도 4.05 확보"
  exp: EXP-01
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn]
  approved: 2026-07-23
- line: "3,493명 규모 PoC 운영 / 만족도 조사 기준 사용성 4.18 · 서비스 만족도 4.06 · 완성도 4.05"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 두 항목 결합형 (millie·millie-career)
- line: "3,493명 규모 PoC를 실사용 가능한 서비스로 전환, 만족도 조사 기준 사용성 4.18·서비스 만족도 4.06·완성도 4.05 확보"
  exp: EXP-01
  roles: [fe]
  section: 경력기술
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 위 항목 변형 (dooray-career)
- line: "AI 답변 출력 시간을 10초에서 4초로 단축"
  exp: EXP-01
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, coupang, kakaopay]
  approved: 2026-07-23
  note: 미제출 초안 동일 문장 흡수(E1-49; next는 "AI 답변 출력 시간을 10초에서 4초로 단축 (60% 단축)")
- line: "초기 서비스 진입 시간을 30초에서 6초로 단축"
  exp: EXP-01
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, coupang, kakaopay]
  approved: 2026-07-23
  note: 미제출 초안 동일 문장 흡수(E1-50; next는 "초기 서비스 진입 시간을 30초에서 6초로 단축 (80% 단축)")
- line: "Lighthouse 91점 확보"
  exp: EXP-01
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, coupang, kakaopay, next-sec]
  approved: 2026-07-23
  note: 미제출 초안 동일 문장 흡수(E1-52)
- line: "AI 답변 출력 10초 → 4초(60%), 초기 진입 30초 → 6초(80%), Lighthouse 91점"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 세 항목 결합형; millie-career는 백분율 없이 "AI 답변 출력 10초 → 4초, 초기 진입 30초 → 6초, Lighthouse 91점"
- line: "AI 답변 출력 시간 10초→4초(60%), 초기 서비스 진입 30초→6초(80%) 단축"
  exp: EXP-01
  roles: [fe]
  section: 경력기술
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 위 항목 변형 (dooray-career)
- line: "400건 발화 검증 기준 답변 화면 정상 출력률 100% 달성"
  exp: EXP-01
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn]
  approved: 2026-07-23
  note: millie·millie-career는 "달성" 없이 동일 문구; dooray-career는 "400건 발화 검증 기준 답변 화면 정상 출력률 100%, Lighthouse 91점 달성"
- line: "신규 AI 챗봇 구축 기간을 10주에서 2주로 단축 가능한 공통 구조 확보"
  exp: EXP-01
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn]
  approved: 2026-07-23
  note: dooray-career는 "10주→2주로"; millie는 "신규 AI 챗봇 구축 10주 → 2주(80%) 단축 가능한 공통 구조 확보"; millie-career는 백분율 없음; millie 경력 불릿은 "신규 AI 챗봇 구축 기간 10주 → 2주, 80% 단축 가능한 공통 구조 설계"
- line: "SSE 기반 실시간 LLM 응답 스트리밍 UI 및 오류 가드레일 구현"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, nhn, millie]
  approved: 2026-07-23
  note: 기술 섹션 불릿. dooray는 " (AI 기능 실서비스 도입)" 추가
- line: "SSE 단방향 이벤트 스트리밍으로 LLM 응답의 중지·재시도·오류 상태와 UI 동기화 처리"
  exp: EXP-01
  roles: [fullstack]
  section: 경력기술
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 기술 섹션 불릿
- line: "Markdown 전용 렌더링 계층으로 표·목록·링크·차트를 컴포넌트로 변환"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
  note: 기술 섹션 불릿. doosan·dooray는 "React 컴포넌트로 변환"
- line: "고객사별 UI·테마·문구·기능 노출을 Config-Driven UI / Base-Theme로 분리"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, nhn, millie]
  approved: 2026-07-23
  note: 기술 섹션 불릿. doosan은 "공통 요소와 고객사별 차이를 Config-Driven UI / Base-Theme로 분리 (모듈화)"
- line: "공통 컴포넌트 기반 재사용 구조 운영"
  exp: EXP-01
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, nhn]
  approved: 2026-07-23
  note: 기술 섹션 불릿. dooray는 " (디자인시스템·신규 컴포넌트 개발·유지보수)" 추가
```

```yaml
# --- candidate (미제출 초안) ---
- line: "AI 서비스 초기 진입·응답 속도 개선"
  exp: EXP-01
  roles: [fe, commerce]
  section: 헤드라인
  status: candidate
  sources: [coupang]
  note: E1-01
- line: "웹뷰 기반 AI 서비스 실시간 응답 처리 및 진입 성능 개선"
  exp: EXP-01
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [kakaopay]
  note: E1-02 · variant-of E1-01
- line: "AI 서비스 제품화 및 초기 진입·응답 성능 개선"
  exp: EXP-01
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [next-sec]
  note: E1-03 · variant-of E1-01
- line: "AI 서비스 프로토타입을 실사용 제품으로 배포·운영 (프로토타입 구축 → 배포·운영)"
  exp: EXP-01
  roles: [ax, ai-product]
  section: 헤드라인
  status: candidate
  sources: [ax]
  note: E1-04 · variant-of E1-01
- line: "Config-Driven UI·Base-Theme 기반 웹 플랫폼 아키텍처 설계"
  exp: EXP-01
  roles: [fe, commerce]
  section: 헤드라인
  status: candidate
  sources: [coupang]
  note: E1-05
- line: "대웅제약 | AI 실시간 서비스 도입·공통 컴포넌트 아키텍처 구축"
  exp: EXP-01
  roles: [fe, commerce]
  section: 헤드라인
  status: candidate
  sources: [coupang]
  note: E1-06
- line: "대웅제약 | 웹뷰 기반 AI 실시간 서비스 도입·성능 개선"
  exp: EXP-01
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [kakaopay]
  note: E1-07 · variant-of E1-06
- line: "대웅제약 | AI 건강검진 챗봇 제품화 및 서비스 성능 개선"
  exp: EXP-01
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [next-sec]
  note: E1-08 · variant-of E1-06
- line: "AI 건강검진 챗봇 제품화 및 배포·운영"
  exp: EXP-01
  roles: [ax, ai-product]
  section: 헤드라인
  status: candidate
  sources: [ax]
  note: E1-09 · variant-of E1-06
- line: "SSE 기반 실시간 LLM 응답과 Base-Theme·Config-Driven UI 기반 모듈화 구조 설계"
  exp: EXP-01
  roles: [fe, commerce]
  section: 헤드라인
  status: candidate
  sources: [coupang]
  note: E1-10
- line: "SSE 기반 실시간 LLM 응답과 웹뷰 운영, Config-Driven UI 기반 모듈화 구조 설계"
  exp: EXP-01
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [kakaopay]
  note: E1-11 · variant-of E1-10
- line: "SSE 기반 실시간 응답과 Markdown 렌더링 계층 구축, 초기 진입·응답 성능 개선"
  exp: EXP-01
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [next-sec]
  note: E1-12 · variant-of E1-10
- line: "AI 건강검진 챗봇에서 SSE 기반 실시간 응답 스트리밍과 오류 가드레일을 실서비스에 도입해 답변 출력 시간을 10초에서 4초로, 초기 진입 시간을 30초에서 6초로 단축했고, 웹뷰 환경에서 React 화면을 운영하며 iOS·Android 호환성 검증 기준을 세웠습니다."
  exp: EXP-01
  roles: [fe, fintech]
  section: 요약
  status: candidate
  sources: [kakaopay]
  note: E1-13
- line: "SSE 기반 실시간 응답 처리와 Markdown 렌더링 계층 구축, React Query 캐싱·코드 스플리팅·HTTP/2 전환을 적용해 AI 답변 출력 시간을 10초에서 4초로, 초기 서비스 진입 시간을 30초에서 6초로 단축했습니다."
  exp: EXP-01
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, next-sec]
  note: E1-14 · 핵심 성과
- line: "3,493명 대상 PoC의 발화 400건 검증 기준 답변 화면 정상 출력률 100%, 같은 PoC 만족도 조사 기준 사용성 4.18·서비스 만족도 4.06·완성도 4.05를 확보했습니다."
  exp: EXP-01
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E1-15 · 핵심 성과
- line: "SSE 기반 실시간 응답 처리와 답변 중지·재시도·오류 상태 흐름을 설계해 웹뷰 환경 AI 건강검진 챗봇에 실서비스로 도입했습니다 (실시간 스트리밍·웹뷰)."
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E1-16 · 핵심 성과
- line: "Markdown 전용 렌더링 계층과 XSS 필터링, 404·500·LLM 오류 가드레일을 적용해 비정형 응답 출력 안정성을 확보했고, React Query 캐싱·코드 스플리팅·HTTP/2 전환으로 AI 답변 출력 시간을 10초에서 4초로, 초기 서비스 진입 시간을 30초에서 6초로 단축했습니다."
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E1-17 · 핵심 성과 · variant-of E1-14
- line: "3,493명 대상 PoC의 발화 400건 검증 기준 답변 화면 정상 출력률 100%, Lighthouse 91점을 확보했습니다."
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E1-18 · 핵심 성과
- line: "Lighthouse 91점을 확보했으며 3,493명 대상 PoC를 실서비스로 전환했습니다 (성능 최적화)."
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E1-19 · 핵심 성과
- line: "목업 수준의 AI 건강검진 챗봇을 3,493명 규모 PoC에서 실사용 가능한 서비스로 고도화했다. AI 답변 출력 시간을 10초 → 4초(약 60%), 초기 진입 시간을 30초 → 6초(약 80%)로 단축하고, 400건 발화 검증 기준 답변 화면 정상 출력률 100%·Lighthouse 91점을 확인하며 계획 대비 2주 빠르게 고도화를 마쳤다."
  exp: EXP-01
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E1-20 · 핵심 성과 · "계획 대비 2주 빠르게" 문구는 ax에만 존재
- line: "고객사마다 다른 테마·문구·기능 노출 조건을 Config-Driven UI와 Base-Theme 계층으로 분리했습니다."
  exp: EXP-01
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E1-21 · 핵심 성과
- line: "반복 컴포넌트 개발·검증 시간을 90분에서 15분으로 단축하고, 신규 AI 챗봇 구축 기간을 10주에서 2주로 줄일 수 있는 공통 컴포넌트 구조를 설계했습니다."
  exp: EXP-01
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E1-22 · 핵심 성과 · 90분→15분 지표는 EXP-03과 혼합됨
- line: "Config-Driven UI·Base-Theme 기반 공통 컴포넌트 구조 설계 및 운영"
  exp: EXP-01
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, next-sec]
  note: E1-23 · coupang은 뒤에 "(웹 아키텍처·모듈화)" 태그 있음, next는 태그 없음
- line: "SSE 기반 실시간 LLM 응답 스트리밍·오류 가드레일 실서비스 도입"
  exp: EXP-01
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay, next-sec]
  note: E1-24 · coupang "(SSE 실시간 스트리밍)", kakaopay "(실시간 스트리밍)", next 태그 없음
- line: "웹뷰 환경 React 화면 운영 및 iOS·Android 호환성 검증 기준 수립 (웹뷰 기반 개발)"
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E1-26 · 경력 요약 bullet과 경력기술서 주요 실행에 동일 문장 2회 출현
- line: "기획·AI·백엔드·운영 조직과 API 응답 정책·기능 노출 조건 조율, WBS·ETA 기반 일정 관리"
  exp: EXP-01
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay]
  note: E1-27
- line: "기획·AI·백엔드·운영 조직과 API 응답 정책 조율, WBS·ETA 기반 다중 우선순위 관리 (주도적 커뮤니케이션)"
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E1-28 · variant-of E1-27
- line: "기획·AI·백엔드·운영 조직과 API 응답 형식·스트리밍 방식·오류 정책을 직접 조율했습니다."
  exp: EXP-01
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay, next-sec]
  note: E1-29 · 핵심 성과 · kakaopay는 문장 끝에 " (목적 조직 협업)" 추가
- line: "목업 수준의 AI 건강검진 챗봇을 실사용 가능한 서비스로 고도화해야 했습니다."
  exp: EXP-01
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay, next-sec]
  note: E1-30 · 문제 문단
- line: "초기 PoC는 답변 생성 후 일괄 출력하는 구조라 체감 대기 시간이 길었고, Markdown·표·링크·차트 등 비정형 실시간 응답을 안정적으로 렌더링하는 체계와 고객사별 화면·테마·기능 노출 조건을 일관되게 관리하는 구조가 없었습니다."
  exp: EXP-01
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E1-31 · 문제 문단
- line: "초기 PoC는 답변 생성 후 일괄 출력하는 구조라 체감 대기 시간이 길었고, Markdown·표·링크·차트 등 비정형 실시간 응답을 안정적으로 렌더링하는 체계와 웹뷰 환경에서의 호환성 검증 기준이 없었습니다."
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E1-32 · 문제 문단 · variant-of E1-31
- line: "답변 생성 후 일괄 출력하는 구조라 체감 대기 시간이 길었고, Markdown·표·링크·차트 등 비정형 실시간 응답을 안정적으로 렌더링하는 체계가 없었습니다. 고객사별 화면·테마·기능 노출 조건을 일관되게 관리하는 구조도 필요했습니다."
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E1-33 · 문제 문단 · variant-of E1-31
- line: "목업 수준의 AI 챗봇을 실사용 서비스로 배포·운영해야 했고, LLM 답변 지연·Markdown/표/링크 렌더링·오류 대응·고객사별 화면 확장 방식이 부족했다."
  exp: EXP-01
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E1-34 · 문제 문단 · variant-of E1-30
- line: "AI 개발자·백엔드와 API 응답 형식·스트리밍 방식·오류 정책 조율"
  exp: EXP-01
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay]
  note: E1-35 · coupang "(크로스팀 협업 리드)", kakaopay "(크로스팀 협업)"
- line: "AI 개발자·백엔드와 API 응답 형식·스트리밍 방식·오류 정책 직접 조율 (주도적 커뮤니케이션)"
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E1-36 · variant-of E1-35
- line: "AI 개발자와 API 응답 형식·스트리밍·오류 정책 정의 (현업과 문제 정의)"
  exp: EXP-01
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E1-37 · variant-of E1-35
- line: "SSE 기반 실시간 응답과 중지/재시도/오류 상태를 포함한 대화 흐름 설계"
  exp: EXP-01
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E1-39 · variant-of E1-38(승인 항목에 흡수됨)
- line: "Markdown 렌더링 계층 구축, 표·목록·링크·차트의 React 컴포넌트 변환"
  exp: EXP-01
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E1-41 · variant-of E1-40(승인 항목에 흡수됨)
- line: "XSS 필터링과 404·500·LLM 오류 가드레일 적용으로 비정형 응답 출력 안정성 확보"
  exp: EXP-01
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay, next-sec]
  note: E1-42
- line: "XSS 필터링과 404/500/LLM 오류 가드레일 적용"
  exp: EXP-01
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E1-43 · variant-of E1-42
- line: "Base-Theme·Config-Driven UI로 고객사별 테마·문구·기능 노출 조건 분리 (재사용 표준화)"
  exp: EXP-01
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E1-45 · variant-of E1-44(승인 항목에 흡수됨)
- line: "React Query 캐싱, 코드 스플리팅, 이미지 최적화, HTTP/2 전환으로 초기 진입·네트워크 병목 개선 (웹 애플리케이션 성능 향상)"
  exp: EXP-01
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E1-46
- line: "React Query 캐싱·코드 스플리팅·이미지 최적화·HTTP/2 전환으로 초기 진입·네트워크 병목 개선"
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E1-47 · variant-of E1-46
- line: "React Query 캐싱·코드 스플리팅·HTTP/2 전환으로 초기 진입·네트워크 병목 개선 (성능 최적화)"
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E1-48 · variant-of E1-46
- line: "AI 답변 출력 10초 → 4초(약 60%), 초기 진입 30초 → 6초(약 80%)"
  exp: EXP-01
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E1-51 · 성과 · variant-of E1-49(승인 항목에 흡수됨)
- line: "3,493명 대상 PoC 운영, 3,493명 대상 만족도 조사 기준 사용성 4.18·서비스 만족도 4.06·완성도 4.05 확보"
  exp: EXP-01
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E1-53 · 성과
- line: "3,493명 대상 PoC의 400건 발화 검증 기준 답변 화면 정상 출력률 100% 달성"
  exp: EXP-01
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay]
  note: E1-54 · 성과
- line: "3,493명 대상 PoC를 실서비스로 전환"
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E1-55 · 성과
- line: "3,493명 규모 PoC를 실사용 서비스로 전환"
  exp: EXP-01
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E1-56 · 성과 · variant-of E1-55
- line: "400건 발화 검증 기준 답변 화면 정상 출력률 100%, Lighthouse 91점"
  exp: EXP-01
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E1-57 · 성과 · variant-of E1-54
- line: "신규 AI 챗봇 구축 기간을 10주에서 2주로 단축 가능한 공통 컴포넌트 구조 설계"
  exp: EXP-01
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay]
  note: E1-58 · 성과
- line: "신규 AI 챗봇 구축 기간을 10주에서 2주로 줄일 수 있는 공통 컴포넌트 구조 설계"
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E1-59 · 성과 · variant-of E1-58
- line: "신규 AI 챗봇 구축 기간을 10주 → 2주로 줄이는 것이 가능한 확장 방식 확보"
  exp: EXP-01
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E1-60 · 성과 · variant-of E1-58
- line: "SSE 단방향 스트리밍으로 LLM 응답의 중지·재시도·오류 상태와 UI 동기화 처리"
  exp: EXP-01
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay]
  note: E1-61 · 기술 섹션 불릿 · kakaopay만 "(실시간 스트리밍)" 태그
- line: "Markdown 전용 렌더링 계층으로 표·목록·링크·차트를 React 컴포넌트로 변환"
  exp: EXP-01
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay]
  note: E1-62 · 기술 섹션 불릿 · 제출본(doosan·dooray) 기술 섹션의 동일 변형이 approved 항목 note에 존재
- line: "React·Next.js 기반 웹뷰 환경 실시간 서비스 설계·개발·운영 (웹뷰 기반 FE)"
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E1-63 · 기술 섹션 불릿
- line: "TanStack Query 기반 서버 상태 캐싱·동기화로 초기 진입·네트워크 병목 개선"
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E1-64 · 기술 섹션 불릿
- line: "코드 스플리팅·이미지 최적화·HTTP/2 전환으로 초기 진입·네트워크 병목 개선"
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E1-65 · 기술 섹션 불릿 · variant-of E1-46
- line: "고객사별 테마·기능 노출 차이를 Config-Driven UI·Base-Theme 계층으로 분리 (모듈화·컴포넌트화)"
  exp: EXP-01
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E1-66 · 기술 섹션 불릿
- line: "고객사별 테마·기능 노출 조건을 Config-Driven UI·Base-Theme 계층으로 분리"
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E1-67 · 기술 섹션 불릿 · variant-of E1-66
- line: "고객사별 테마·기능 노출 차이를 Config-Driven UI·Base-Theme로 분리, 반복 컴포넌트 개발 90분 → 15분"
  exp: EXP-01
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E1-68 · 기술 섹션 불릿 · variant-of E1-66
- line: "Config-Driven UI·Base-Theme로 고객사별 화면 확장을 반복 대응 가능하게 정비"
  exp: EXP-01
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E1-69 · 기술 섹션 불릿 · variant-of E1-66
- line: "AI 챗봇 PoC를 실사용 서비스로 배포·운영하고 답변 렌더링·오류 대응을 안정화"
  exp: EXP-01
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E1-70 · 기술 섹션 불릿
```

### EXP-02 · B2B 임직원 건강 플랫폼 풀스택 내재화

```yaml
# --- approved (제출본) ---
- line: "B2B 임직원 건강 플랫폼 풀스택 내재화"
  exp: EXP-02
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
- line: "외주 서비스 내재화와 DB·백엔드·REST API·Web·Admin End-to-End 개발"
  exp: EXP-02
  roles: [fullstack]
  section: 헤드라인
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 위 헤드라인 변형
- line: "외주 서비스 내재화와 고객사별 권한·메뉴·기능 노출 정책 관리·유지보수"
  exp: EXP-02
  roles: [fe]
  section: 헤드라인
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 위 헤드라인 변형
- line: "WebView 하이브리드 임직원 건강 플랫폼 풀스택 내재화"
  exp: EXP-02
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 헤드라인 변형 (millie·millie-career)
- line: "비즈36.5 — 임직원 건강 플랫폼 풀스택 내재화"
  exp: EXP-02
  roles: [fe]
  section: 헤드라인
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: (dooray-career)
- line: "대웅제약 | B2B 플랫폼 풀스택 내재화"
  exp: EXP-02
  roles: [fullstack]
  section: 헤드라인
  status: approved
  sources: [doosan]
  approved: 2026-07-23
- line: "서버 기능·REST API·React 화면을 함께 개발"
  exp: EXP-02
  roles: [fullstack]
  section: 헤드라인
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 핵심 성과 소제목
- line: "하이브리드 앱(WebView)·멀티 프레임워크 개발"
  exp: EXP-02
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 핵심 성과 소제목
- line: "하이브리드 앱(WebView) 플랫폼 풀스택 내재화"
  exp: EXP-02
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 핵심 성과 소제목 (millie-career)
- line: "Spring Boot·MySQL로 데이터 모델과 서버 로직을 짜고 REST API를 설계해 Web/Admin 화면까지 개발했습니다. 외주로 돌아가던 검진 예약 서비스를 9주 만에 108개 페이지·82개 화면 규모의 임직원 건강 플랫폼으로 옮기고, 신규 건강관리 기능 3건을 DB부터 화면까지 직접 만들었습니다."
  exp: EXP-02
  roles: [fullstack]
  section: 요약
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: doosan 요약 2문단은 뒷문장이 "…옮겨, 외주 없이 내부에서 개발·운영할 수 있게 바꿨습니다."로 끝나는 변형
- line: "WebView 기반 B2B 플랫폼을 풀스택 내재화하고 Web·Admin·App 정책을 공통화. React·Next.js 웹, Vue 3 대시보드, React Native iOS/Android 앱을 모두 실무로 개발·배포하며 RN 앱 검색 응답 5초 → 1초(80%) 단축"
  exp: EXP-02
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 말미 지표는 EXP-04 소속
- line: "외주 의존 서비스를 WebView 기반 임직원 건강 플랫폼으로 전환하며 Web·Admin·App 정책을 공통 기준으로 정리하고 WebView 호환성 검증 체계를 수립. 9주 내 108개 페이지·82개 화면을 끊김 없는 사용자 경험으로 이관"
  exp: EXP-02
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: (millie-career)
- line: "MySQL 데이터 모델·Spring Boot 로직·REST API·Web/Admin 화면을 End-to-End 개발 (풀스택)"
  exp: EXP-02
  roles: [fullstack]
  section: 경력기술
  status: approved
  sources: [doosan]
  approved: 2026-07-23
- line: "MySQL·Spring Boot·REST API·Web/Admin·WebView·Jenkins CI/CD End-to-End 개발"
  exp: EXP-02
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, nhn, millie]
  approved: 2026-07-23
- line: "외주 중심으로 운영되던 검진 예약 서비스를 내부 개발·운영 가능한 임직원 건강 플랫폼으로 전환해야 했습니다. 기존 jQuery·Thymeleaf 화면과 Spring Boot·MySQL 구조가 기능별로 결합되어 변경 영향 범위 파악이 어려웠고, 고객사별 CI·메뉴·기능 노출 정책이 일관되지 않아 운영 대응 속도를 높이기 어려웠습니다."
  exp: EXP-02
  roles: [fe, fullstack]
  section: 경력기술
  status: approved
  sources: [doosan, nhn]
  approved: 2026-07-23
  note: 문제 문단
- line: "외주 중심으로 운영되던 검진 예약 서비스를 내부 개발·운영 가능한 임직원 건강 플랫폼으로 전환해야 했습니다. 기존 jQuery·Thymeleaf 화면과 Spring Boot·MySQL 구조가 기능별로 결합되어 변경 영향 범위 파악이 어렵고, Web·Admin·App 정책도 서로 달라 운영 대응 속도를 높이기 어려웠습니다."
  exp: EXP-02
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
  note: 위 문제 문단 변형 (cj-enm·cj-enm-rewrite)
- line: "외주 중심으로 운영되던 검진 예약 서비스를 내부 개발·운영 가능한 임직원 건강 플랫폼으로 전환해야 했습니다. 기존 jQuery·Thymeleaf 화면과 Spring Boot·MySQL 구조가 기능별로 결합되어 변경 영향 범위 파악이 어렵고, Web·Admin·App 정책도 서로 달라 WebView 환경에서 일관된 사용자 경험을 보장하기 어려웠습니다."
  exp: EXP-02
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 문제 문단 변형 (millie-career; millie는 압축형 "외주 중심 검진 예약 서비스를 … Spring Boot·MySQL이 기능별로 결합돼 변경 영향 범위 파악이 어렵고, Web·Admin·App 정책이 서로 달라 WebView 환경에서 일관된 사용자 경험을 보장하기 어려웠습니다.")
- line: "외주 중심으로 운영되던 검진 예약 서비스(비즈36.5)를 내부에서 개발·운영 가능한 임직원 건강 플랫폼으로 전환해야 했고, jQuery·Thymeleaf 화면과 Spring Boot·MySQL 구조가 기능별로 결합돼 변경 영향 파악과 고객사별 대응이 어려웠다."
  exp: EXP-02
  roles: [fe]
  section: 경력기술
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 위 문제 문단 변형 (평서형, dooray-career)
- line: "화면 요청부터 Controller·Service·Query·DB·화면 출력까지 데이터 흐름과 의존 관계를 정리"
  exp: EXP-02
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn]
  approved: 2026-07-23
  note: doosan " (레이어드 구조 분석)" 추가. dooray-career는 명사형 "…의존 관계 정리"; millie·millie-career는 "화면 요청 → Controller·Service·Query·DB → 화면 출력까지 데이터 흐름·의존 관계 정리"
- line: "신규 건강관리 기능의 MySQL 데이터 모델, Spring Boot 로직, REST API, Web/Admin 화면을 End-to-End 개발"
  exp: EXP-02
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, nhn, millie]
  approved: 2026-07-23
  note: doosan " (풀스택)" 추가 (millie는 millie-career 출처)
- line: "신규 건강관리 기능의 MySQL 모델·Spring Boot 로직·REST API 설계·변경, Web·Admin End-to-End 개발"
  exp: EXP-02
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 항목 변형
- line: "신규 건강관리 기능의 MySQL 데이터 모델·Spring Boot 서버 로직·REST API를 End-to-End 개발"
  exp: EXP-02
  roles: [fe]
  section: 경력기술
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 위 항목 변형 (dooray-career)
- line: "jQuery·Thymeleaf와 React가 화면 단위로 공존하는 점진적 전환 구조 설계"
  exp: EXP-02
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie, coupang, kakaopay, next-sec]
  approved: 2026-07-23
  note: doosan·dooray " (레거시 점진 전환)" 추가. 미제출 초안 동일 문장 흡수(E2-19; coupang·kakaopay는 "(레거시 점진 전환)" 태그, next는 태그 없음)
- line: "React·TypeScript 기반 Web/Admin 화면 개발 및 jQuery·Thymeleaf↔React 화면 단위 점진 전환 구조 설계"
  exp: EXP-02
  roles: [fe]
  section: 경력기술
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 위 항목 변형 (dooray-career)
- line: "사용자 권한, 메뉴, 브랜딩, 데이터 출력 정책을 공통 기준으로 정리"
  exp: EXP-02
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
- line: "사용자 권한, 메뉴, 브랜딩, 데이터 출력 정책을 공통 기준으로 정리해 고객사별 배포 대응 구조 확보"
  exp: EXP-02
  roles: [fe, fullstack]
  section: 경력기술
  status: approved
  sources: [doosan, nhn]
  approved: 2026-07-23
  note: 위 항목 변형. doosan " (모듈화)" 추가; dooray-career는 ·연결 "사용자 권한·메뉴·브랜딩·데이터 출력 정책을 공통 기준으로 정리해 고객사별 배포 대응 구조 확보"
- line: "Jenkins 빌드·검증·배포 파이프라인과 WebView 호환성 검증 기준 수립"
  exp: EXP-02
  roles: [fe, fullstack, ai-product, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie, kakaopay, next-sec]
  approved: 2026-07-23
  note: 미제출 초안 동일 문장 흡수(E2-31; kakaopay "(웹뷰 기반 운영)", next "(크로스 브라우저·반응형 웹)" 태그)
- line: "9주 내 108개 페이지·82개 화면을 임직원 건강 플랫폼으로 전환"
  exp: EXP-02
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie, coupang, kakaopay, next-sec]
  approved: 2026-07-23
  note: 미제출 초안 동일 문장 흡수(E2-33)
- line: "건강 데이터를 차트·대시보드로 시각화한 신규 기능 3건 End-to-End 개발"
  exp: EXP-02
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie]
  approved: 2026-07-23
- line: "건강관리 신규 기능 3건을 DB~서버~API~Web/Admin 전 구간 End-to-End 개발"
  exp: EXP-02
  roles: [fe]
  section: 경력기술
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 위 항목 변형 (dooray-career)
- line: "외주 의존 기능 변경·배포를 DB·백엔드·Web·Admin·App 전 영역에서 내부 대응 가능한 구조로 개선"
  exp: EXP-02
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie]
  approved: 2026-07-23
  note: dooray-career는 말미 "…구조로 전환"
- line: "고객사별 CI·메뉴·기능 노출 변경을 1주 내 대응 가능한 운영 구조 확보"
  exp: EXP-02
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie, coupang, kakaopay, next-sec]
  approved: 2026-07-23
  note: doosan·dooray에서는 경력 요약 불릿으로도 중복 등장. millie는 "고객사별 CI·메뉴·기능 노출 변경을 1주 내 대응, Jenkins CI/CD 직접 구축" (millie 출처는 millie-career). 미제출 초안 동일 문장 흡수(E2-37; coupang·kakaopay 핵심 성과에는 "...운영 구조를 구축했습니다" 서술형으로도 출현)
- line: "WebView 환경에서 웹·앱 정책을 공통화하고 호환성 검증 기준 수립"
  exp: EXP-02
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 기술 섹션 불릿 (millie·millie-career)
- line: "레거시 화면과 React가 화면 단위로 공존하는 점진적 전환 구조 설계"
  exp: EXP-02
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 기술 섹션 불릿 (millie·millie-career)
- line: "화면 요청부터 Controller·Service·Query·DB 조회까지 데이터 흐름 분석"
  exp: EXP-02
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, nhn]
  approved: 2026-07-23
  note: 기술 섹션 불릿. doosan은 "화면 요청부터 Controller·Service·Query·DB 조회까지 End-to-End 개발"
- line: "MySQL 데이터 모델링 및 신규 기능의 서버 로직·API·화면 End-to-End 개발"
  exp: EXP-02
  roles: [fullstack]
  section: 경력기술
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 기술 섹션 불릿
- line: "REST API 및 필터링·정렬·역할별 데이터 조회 로직 설계·구현"
  exp: EXP-02
  roles: [fullstack]
  section: 경력기술
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 기술 섹션 불릿
```

```yaml
# --- candidate (미제출 초안) ---
- line: "대웅제약 | B2B 임직원 건강 플랫폼 프론트 내재화"
  exp: EXP-02
  roles: [fe, commerce]
  section: 헤드라인
  status: candidate
  sources: [coupang]
  note: E2-01
- line: "대웅제약 | B2B 임직원 건강 플랫폼 내재화"
  exp: EXP-02
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [kakaopay]
  note: E2-02 · variant-of E2-01
- line: "대웅제약 | B2B 임직원 건강 플랫폼 내재화 및 Web·Admin 관리자 도구 개발"
  exp: EXP-02
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [next-sec]
  note: E2-03 · variant-of E2-01
- line: "B2B 임직원 건강 플랫폼 풀스택 내재화 및 배포·운영"
  exp: EXP-02
  roles: [ax, ai-product]
  section: 헤드라인
  status: candidate
  sources: [ax]
  note: E2-04 · variant-of E2-01
- line: "Web·Admin 관리자 도구 End-to-End 개발"
  exp: EXP-02
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [next-sec]
  note: E2-05
- line: "B2B 플랫폼 풀스택 내재화 및 배포·운영 (배포·운영 내재화)"
  exp: EXP-02
  roles: [ax, ai-product]
  section: 헤드라인
  status: candidate
  sources: [ax]
  note: E2-06
- line: "jQuery·Thymeleaf 레거시의 React 점진 전환과 공통 컴포넌트·정책 분리로 프론트 운영 구조 개선"
  exp: EXP-02
  roles: [fe, commerce]
  section: 헤드라인
  status: candidate
  sources: [coupang]
  note: E2-07
- line: "외주 서비스 내재화·고객사별 CI·메뉴·기능 노출 정책 공통화·WebView 앱 운영"
  exp: EXP-02
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [kakaopay]
  note: E2-08 · variant-of E2-07
- line: "외주 서비스 내재화·신규 기능 End-to-End 개발·고객사별 운영 구조 구축"
  exp: EXP-02
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [next-sec]
  note: E2-09 · variant-of E2-07
- line: "B2B 임직원 건강 플랫폼에서 신규 건강관리 기능 3건을 MySQL 데이터 모델부터 Spring Boot 로직·REST API·Web·Admin 화면까지 직접 개발했습니다."
  exp: EXP-02
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E2-10 · 핵심 성과
- line: "사용자 권한·메뉴·데이터 출력 정책을 공통 기준으로 정리해 고객사별 관리자 운영 구조를 일관되게 설계했고, 9주 내 108개 페이지·82개 화면을 임직원 건강 플랫폼으로 전환했습니다 (관리자 도구·데이터 조회·처리 인터페이스)."
  exp: EXP-02
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E2-11 · 핵심 성과
- line: "외주 중심으로 운영되던 검진 예약 서비스를 9주 내 108개 페이지·82개 화면의 임직원 건강 플랫폼으로 전환하고, 신규 건강관리 기능 3건을 MySQL 데이터 모델부터 서버·REST API·화면까지 직접 개발했다."
  exp: EXP-02
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E2-12 · 핵심 성과 · variant-of E2-10
- line: "Jenkins 빌드·검증·배포를 정비해 배포 리드타임을 10분 → 2분(약 80%)으로 단축했다."
  exp: EXP-02
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E2-13 · 핵심 성과 · 다른 세 드래프트는 이 지표를 EXP-03(자동화 프로젝트) 성과로 귀속 — 귀속 충돌, 승인 검토 필요
- line: "Web·Admin 관리자 도구 및 데이터 조회·처리 인터페이스 End-to-End 개발 (관리자/운영 시스템)"
  exp: EXP-02
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E2-14
- line: "외주 중심으로 운영되던 검진 예약 서비스를 내부 개발·운영 가능한 임직원 건강 플랫폼으로 전환해야 했습니다."
  exp: EXP-02
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay, next-sec]
  note: E2-15 · 문제 문단
- line: "jQuery·Thymeleaf 화면과 Spring Boot·MySQL 구조가 기능별로 결합되어 변경 영향 범위 파악이 어려웠고, 고객사별 CI·메뉴·기능 노출 정책이 일관되지 않아 운영 대응 속도를 높이기 어려웠습니다."
  exp: EXP-02
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay]
  note: E2-16 · 문제 문단
- line: "jQuery·Thymeleaf 화면, Spring Boot 서버 로직, MySQL 데이터 구조가 기능별로 결합돼 변경 영향 범위 파악이 어려웠고, 사용자 권한·메뉴·데이터 출력 정책이 Web과 Admin 간에 일관되지 않아 운영팀의 관리 부담이 컸습니다."
  exp: EXP-02
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E2-17 · 문제 문단 · variant-of E2-16
- line: "외주 중심으로 운영되던 검진 예약 서비스의 화면·서버·DB가 기능별로 결합돼 변경 영향 파악이 어려웠고, Web·Admin·App 권한과 출력 정책이 달랐다."
  exp: EXP-02
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E2-18 · 문제 문단 · variant-of E2-16
- line: "jQuery/Thymeleaf와 React가 화면 단위로 공존하는 점진적 전환 설계 (레거시 점진 전환)"
  exp: EXP-02
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E2-20 · variant-of E2-19(승인 항목에 흡수됨)
- line: "반복되는 화면 요소를 공통 컴포넌트로 정리하고 권한·메뉴·브랜딩·데이터 출력 정책을 공통 기준으로 분리해 고객사별 배포 대응 구조 확보 (컴포넌트화·모듈화)"
  exp: EXP-02
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E2-21
- line: "사용자 권한·메뉴·브랜딩·데이터 출력 정책을 공통 기준으로 정리해 고객사별 배포 대응 구조 확보"
  exp: EXP-02
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay, next-sec]
  note: E2-22 · variant-of E2-21
- line: "WebView 기반 모바일 환경에서 React 웹 화면 운영 및 호환성 검증"
  exp: EXP-02
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay, next-sec]
  note: E2-23 · coupang 경력기술서에는 "(모바일 웹)" 태그로, coupang·kakaopay 기술 섹션에는 태그 없이, next 경력 bullet에는 "(크로스 브라우저·반응형 웹)" 태그로 출현
- line: "화면에 필요한 신규 건강관리 기능을 REST API·Spring Boot 서버 로직·MySQL 데이터 모델까지 함께 개발해 프론트 요구에 맞는 응답 구조 확보 (풀스택 오너십)"
  exp: EXP-02
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E2-24
- line: "신규 건강관리 기능의 MySQL 데이터 모델·Spring Boot 로직·REST API·Web·Admin 화면을 End-to-End 개발"
  exp: EXP-02
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E2-25 · variant-of E2-24
- line: "신규 건강관리 기능에 필요한 MySQL 데이터 모델·Spring Boot 서버 로직·REST API·Web·Admin 화면 End-to-End 개발 (관리자 도구·데이터 조회·처리 인터페이스)"
  exp: EXP-02
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E2-26 · variant-of E2-24
- line: "신규 건강관리 기능의 MySQL 데이터 모델·Spring Boot 서버 로직·REST API·Web/Admin을 End-to-End 개발"
  exp: EXP-02
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E2-27 · variant-of E2-24
- line: "기존 소스와 DB 스키마를 분석해 화면 요청부터 Controller·Service·Query·DB·화면 출력까지 구조 파악"
  exp: EXP-02
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E2-28
- line: "기존 소스·DB 스키마 분석, 화면 요청부터 Controller·Service·Query·DB·출력까지 정리"
  exp: EXP-02
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E2-29 · variant-of E2-28
- line: "Jenkins 빌드·검증·배포 파이프라인 정비"
  exp: EXP-02
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E2-30
- line: "Jenkins 빌드·검증·배포와 WebView 호환성 검증 기준 수립 (배포·운영)"
  exp: EXP-02
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E2-32 · variant-of E2-31(승인 항목에 흡수됨)
- line: "9주 내 108개 페이지·82개 화면 전환, 신규 건강관리 기능 3건 End-to-End 개발"
  exp: EXP-02
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E2-34 · 성과 · variant-of E2-33(승인 항목에 흡수됨)
- line: "신규 건강관리 기능 3건을 화면부터 REST API·데이터 모델까지 End-to-End 개발"
  exp: EXP-02
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E2-35 · 성과
- line: "신규 건강관리 기능 3건을 데이터 모델부터 화면까지 End-to-End 개발"
  exp: EXP-02
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay, next-sec]
  note: E2-36 · 성과 · variant-of E2-35 · 방향(화면→데이터 vs 데이터→화면)이 반대로 표현됨
- line: "고객사별 CI·메뉴·기능 노출 변경을 1주 내 대응 가능하게 정비"
  exp: EXP-02
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E2-38 · 성과 · variant-of E2-37(승인 항목에 흡수됨)
- line: "Jenkins 배포 리드타임 10분 → 2분(약 80%)"
  exp: EXP-02
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E2-39 · 성과 · E2-13과 동일한 귀속 충돌
- line: "MySQL 데이터 모델·Spring Boot 로직·REST API 설계 및 Web·Admin 화면 연동 경험"
  exp: EXP-02
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E2-40 · 기술 섹션 불릿
- line: "MySQL 데이터 모델·Spring Boot 로직·REST API 설계 및 Web·Admin End-to-End 개발"
  exp: EXP-02
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E2-41 · 기술 섹션 불릿 · variant-of E2-40
- line: "MySQL 데이터 모델·Spring Boot 로직·REST API 설계 및 Web·Admin 화면 End-to-End 개발 (보조)"
  exp: EXP-02
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E2-42 · 기술 섹션 불릿 · variant-of E2-40
- line: "jQuery·Thymeleaf와 React가 화면 단위로 공존하는 점진적 전환 구조 경험"
  exp: EXP-02
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E2-43 · 기술 섹션 불릿 · variant-of E2-19
- line: "WebView 기반 iOS·Android 앱 운영 및 호환성 검증"
  exp: EXP-02
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E2-44 · 기술 섹션 불릿 · variant-of E2-23
- line: "MySQL 데이터 모델을 신규 설계하고 역할별 조회·필터링·정렬 로직을 SQL로 개발"
  exp: EXP-02
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E2-45 · 기술 섹션 불릿 · 전반부는 EXP-02, "역할별 조회·필터링·정렬"은 EXP-04 삼성물산 claim과 혼합
```

### EXP-03 · 품질·개발·운영 자동화 및 FE AX 기준 수립

```yaml
# --- approved (제출본) ---
- line: "AI Front-end Harness Engineering 및 FE AX SOP 구축"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
  note: cj-enm 경력 불릿으로도 동일 문구 사용
- line: "테스트 자동화·빌드 프로세스·FE AX SOP 기반 서비스 운영 품질 기준 수립"
  exp: EXP-03
  roles: [fe, fullstack]
  section: 헤드라인
  status: approved
  sources: [doosan, nhn]
  approved: 2026-07-23
  note: 위 헤드라인 변형
- line: "품질·개발·운영 자동화 및 AI-Native 워크플로우 (FE AX SOP)"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 헤드라인 변형
- line: "AI-Native 프론트엔드 워크플로우 및 FE AX SOP 구축"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 헤드라인 변형 (millie-career)
- line: "대웅제약 | 테스트·빌드·배포 자동화 및 AI 활용 개발 프로세스"
  exp: EXP-03
  roles: [fullstack]
  section: 헤드라인
  status: approved
  sources: [doosan]
  approved: 2026-07-23
- line: "E2E·CI/CD 기반 반복 검증 자동화"
  exp: EXP-03
  roles: [fullstack]
  section: 헤드라인
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 핵심 성과 소제목
- line: "AI Front-end Harness Engineering 기반 개발 생산성 개선"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
  note: 핵심 성과 소제목
- line: "Playwright·Storybook 기반 자동 검증 체계 구축"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
  note: 핵심 성과 소제목
- line: "테스트 자동화·빌드 프로세스·운영 안정성 구축"
  exp: EXP-03
  roles: [fe]
  section: 헤드라인
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 핵심 성과 소제목
- line: "AI-Native 워크플로우 내재화 기반 개발 생산성 향상"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 핵심 성과 소제목 (millie-career는 "AI-Native 워크플로우 내재화로 개발 생산성 개선")
- line: "품질·테스트 자동화 및 Observability 체계 구축"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 핵심 성과 소제목
- line: "Observability·테스트 자동화로 배포 안정성 확보"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 핵심 성과 소제목 (millie-career)
- line: "Playwright로 주요 화면 E2E 600여 건을 자동화하고, LLM 응답 확인과 타입·테스트·빌드·배포 전 점검을 Jenkins·GitLab CI/CD에 넣어 자동으로 돌게 했습니다. 반복 QA를 3시간에서 1시간으로, 배포를 10분에서 2분으로 줄였습니다. AI 생성 코드의 컨텍스트·금지 패턴·보안 위험·확인 절차를 FE AX SOP로 정리했습니다."
  exp: EXP-03
  roles: [fullstack]
  section: 요약
  status: approved
  sources: [doosan]
  approved: 2026-07-23
- line: "생성형 AI와 AI Coding Agent가 프론트엔드 개발에 안정적으로 참여할 수 있도록 프로젝트 맥락, 컴포넌트 규칙, 금지 패턴, 보안 위험, 테스트·완료 조건을 구조화했습니다. FE AX SOP와 Storybook·Playwright 검증 흐름을 함께 구축해 AI 생성 코드의 서비스 반영 전 품질 기준을 마련했고, 반복 컴포넌트 개발·검증 시간을 90분에서 15분으로 단축했습니다."
  exp: EXP-03
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
- line: "Playwright 기반 E2E 회귀 시나리오, Storybook 컴포넌트 검증, 배포 전후 확인 절차를 정리해 반복 QA 시간을 3시간에서 1시간으로 줄였습니다. 반복 UI 변경이 사용자 흐름, 컴포넌트 상태, 배포 안정성 측면에서 검증되도록 품질 기준을 마련했습니다."
  exp: EXP-03
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
- line: "Playwright 기반 600여 건 E2E 회귀 시나리오 자동화, Storybook 컴포넌트 검증, Jenkins·GitLab CI/CD 빌드·검증·배포 파이프라인 구축, Vercel 배포 자동화를 수행했습니다. 반복 QA 시간을 3시간에서 1시간으로 단축하고, Jenkins 배포 리드타임을 10분에서 2분으로 80% 줄였습니다. 개발 세미나 12회 운영, 기술 문서 48건 작성, FE AX SOP 문서화로 팀 학습·적용·공유 문화를 정착시켰습니다."
  exp: EXP-03
  roles: [fe]
  section: 요약
  status: approved
  sources: [nhn]
  approved: 2026-07-23
- line: "생성형 AI와 AI Coding Agent(Claude Code 등)가 프론트엔드 개발에 안정적으로 참여하도록 프로젝트 맥락·컴포넌트 규칙·금지 패턴·보안 위험·테스트 조건을 FE AX SOP로 구조화. 팀 단위 활용 기준을 마련해 반복 컴포넌트 개발·검증 시간을 90분 → 15분(약 83%) 단축"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [millie]
  approved: 2026-07-23
- line: "생성형 AI와 AI Coding Agent(Claude Code 등)가 프론트엔드 개발에 안정적으로 참여하도록 프로젝트 맥락, 컴포넌트 규칙, 금지 패턴, 보안 위험, 테스트·완료 조건을 FE AX SOP로 구조화. 팀 단위 활용 기준과 Storybook·Playwright 검증 흐름을 함께 마련해 반복 컴포넌트 개발·검증 시간을 90분 → 15분으로 단축"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 millie 항목의 변형 (millie-career)
- line: "Playwright 기반 600여 건 E2E 회귀 시나리오, Storybook, Jest, 배포 전후 검증 체계를 구축해 반복 QA 시간을 3시간 → 1시간(60%) 단축. GA4·PostHog·Datadog 기반 운영 지표 대시보드로 데이터 기반 배포·운영 흐름 확보"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [millie]
  approved: 2026-07-23
- line: "Playwright 기반 600여 건 E2E 회귀 시나리오와 Storybook 컴포넌트 검증, 배포 전후 확인 절차를 정리해 반복 QA 시간을 3시간 → 1시간으로 단축. GA4·PostHog·Datadog 기반 운영 지표 대시보드로 데이터 기반 배포·운영 흐름 구축"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 millie 항목의 변형 (millie-career)
- line: "생성형 AI와 AI Coding Agent 활용이 늘면서, AI가 생성한 컴포넌트와 UI 코드가 프로젝트 규칙, 보안 기준, 테스트 조건을 일관되게 통과하도록 만드는 기준이 필요했습니다. 동시에 반복 컴포넌트 개발, 수동 QA, 배포 전후 확인, 운영 지표 조회가 병목으로 남아 있었습니다."
  exp: EXP-03
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
  note: 문제 문단 (cj-enm·cj-enm-rewrite·millie-career)
- line: "서비스 수와 공통 컴포넌트가 늘면서 수동 QA, 반복 UI 개발, 배포 전후 확인, 운영 지표 조회가 병목이 되었습니다. AI 생성 코드의 품질·보안·일관성을 검증할 기준도 마련되어 있지 않아, 서비스 안정 운영을 위한 자동화 기준과 팀 공유 체계가 필요했습니다."
  exp: EXP-03
  roles: [fe, fullstack]
  section: 경력기술
  status: approved
  sources: [doosan, nhn]
  approved: 2026-07-23
  note: 위 문제 문단 변형
- line: "운영 서비스·공통 컴포넌트 증가로 수동 발화 테스트, 반복 UI 개발, 배포 전후 확인, 운영 지표 조회가 병목이 됐습니다. 생성형 AI와 AI Coding Agent 사용이 늘며 AI가 생성한 코드가 프로젝트 규칙·보안 기준·테스트 조건을 일관되게 통과하도록 만드는 기준도 필요했습니다."
  exp: EXP-03
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 문제 문단 변형
- line: "AGENTS.md·SKILL.md 기반으로 AI Coding Agent가 참조할 프로젝트 맥락, 작업 절차, 완료 조건을 구조화"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
  note: millie는 "프로젝트 맥락·작업 절차·완료 조건을 구조화" (승인 출처는 cj-enm·cj-enm-rewrite·millie-career)
- line: "컴포넌트 생성 시 props, 상태 관리, 접근성, 금지 패턴, 보안 위험, 테스트 기준을 FE AX SOP로 정리"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
  note: millie는 "props·상태 관리·접근성·금지 패턴·보안 위험·테스트 기준을 FE AX SOP로 문서화" (승인 출처는 cj-enm·cj-enm-rewrite·millie-career)
- line: "Storybook 중심으로 컴포넌트 상태별 개발·검증 절차를 수립"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
  note: doosan·dooray는 "Storybook 중심으로 컴포넌트 상태별 개발·검증 절차 수립" (승인 출처는 cj-enm·cj-enm-rewrite·millie-career)
- line: "Playwright 기반 주요 사용자 흐름과 E2E 회귀 시나리오를 자동화"
  exp: EXP-03
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie, coupang, next-sec]
  approved: 2026-07-23
  note: 미제출 초안 동일 문장 흡수(E3-37; coupang "(웹 애플리케이션 성능·생산성 향상)", next "(운영 시스템 품질 관리)" 태그)
- line: "Playwright 기반 주요 사용자 흐름·회귀 시나리오 자동화, Storybook 중심 컴포넌트 개발·검증 절차 수립"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 두 항목 결합형
- line: "LLM 응답 검증, 타입·테스트·빌드 확인, 배포 전후 확인을 하나의 품질 흐름으로 연결"
  exp: EXP-03
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie]
  approved: 2026-07-23
  note: millie 출처는 millie-career
- line: "E2E 발화 테스트·LLM 응답 검증·타입·테스트·빌드·배포 전후 확인을 하나의 품질 흐름으로 통합"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 항목 변형
- line: "AI코치·비즈36.5·바이오에이지 운영 서비스 전반의 FE 공통 품질·개발 기준 수립: Playwright E2E·Storybook 컴포넌트 검증·배포 전후 확인을 하나의 품질 흐름으로 통합"
  exp: EXP-03
  roles: [fe]
  section: 경력기술
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 위 항목 변형 (dooray-career)
- line: "Jenkins CI/CD 빌드·검증·배포 파이프라인을 정비하고 WebView 호환성 검증 기준 수립"
  exp: EXP-03
  roles: [fe, fullstack]
  section: 경력기술
  status: approved
  sources: [doosan, nhn]
  approved: 2026-07-23
- line: "GA4·PostHog 기반 운영 지표 대시보드를 구성해 기획·운영 부서가 직접 데이터를 확인할 수 있도록 개선"
  exp: EXP-03
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie]
  approved: 2026-07-23
  note: millie 출처는 millie-career
- line: "GA4·PostHog 데이터를 운영·기획 부서가 직접 보는 운영 지표 대시보드 구축"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 항목 변형
- line: "AI 생성 코드의 컨텍스트 관리, 금지 패턴, 보안 위험, 검증 절차를 FE AX SOP로 문서화"
  exp: EXP-03
  roles: [fe, fullstack]
  section: 경력기술
  status: approved
  sources: [doosan, nhn]
  approved: 2026-07-23
  note: doosan " (AI 활용 자동화)" 추가. dooray-career는 ·연결 "AI 생성 코드의 컨텍스트 관리·금지 패턴·보안 위험·검증 절차를 FE AX SOP로 문서화"
- line: "개발 세미나 12회 운영, 기술 문서 48건 작성으로 팀 학습·적용·공유 체계 정착"
  exp: EXP-03
  roles: [fe, fullstack]
  section: 경력기술
  status: approved
  sources: [doosan, nhn]
  approved: 2026-07-23
  note: 경력 요약 불릿 변형 — doosan "AI 생성 코드 검증 기준(FE AX SOP) 문서화, 개발 세미나 12회·기술 문서 48건 (업무 자동화·AI 활용)", dooray "개발 세미나 12회 운영, 기술 문서 48건 축적, FE AX SOP 문서화 (학습·적용·공유)"
- line: "반복 컴포넌트 개발·검증 시간을 90분에서 15분으로 단축"
  exp: EXP-03
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn]
  approved: 2026-07-23
  note: millie-career "90분 → 15분으로 단축"; millie "반복 컴포넌트 개발 90분 → 15분(약 83%), 운영 데이터 확인 3단계 → 1단계"; dooray-career "(공통 품질 기준) 반복 컴포넌트 개발·검증 시간 90분→15분 단축, 테스트 커버리지 98% 수준 확보"; cj-enm 경력 불릿 "반복 컴포넌트 개발·검증 90분 → 15분 단축"; millie 경력 불릿 "생성형 AI·FE AX SOP로 반복 컴포넌트 개발 90분 → 15분 단축"
- line: "Playwright 기반 600여 건 E2E 회귀 시나리오 자동화"
  exp: EXP-03
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie, coupang, kakaopay, next-sec]
  approved: 2026-07-23
  note: doosan·dooray 경력 불릿은 "…자동화 및 Jenkins CI/CD 빌드·배포 파이프라인 구축"; millie는 "600여 건 E2E 회귀 시나리오 자동화, 반복 QA 3시간 → 1시간(60%)"; dooray-career는 "(AI코치·비즈36.5·바이오에이지 공통 품질 기준) Playwright 기반 600여 건 E2E 회귀 시나리오 자동화, 반복 QA 시간 3시간→1시간 단축". 미제출 초안 동일 문장 흡수(E3-52)
- line: "반복 QA 시간을 3시간에서 1시간으로 단축"
  exp: EXP-03
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, coupang, kakaopay, next-sec]
  approved: 2026-07-23
  note: 미제출 초안 동일 문장 흡수(E3-53; ax는 "반복 QA 시간 3시간 → 1시간")
- line: "운영 데이터 확인 절차를 3단계에서 1단계로 전환"
  exp: EXP-03
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, coupang, kakaopay, next-sec]
  approved: 2026-07-23
  note: millie-career는 "운영 데이터 확인 절차 3단계 → 1단계, 기획-개발 검증 리드타임 2일 → 1일". 미제출 초안 동일 문장 흡수(E3-55; ax는 "운영 데이터 확인 3단계 → 1단계")
- line: "기획-개발 검증 리드타임을 2일에서 1일로 단축"
  exp: EXP-03
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, coupang, next-sec]
  approved: 2026-07-23
  note: millie는 "기획-개발 검증 리드타임 2일 → 1일, 테스트 커버리지 98% 수준". 미제출 초안 동일 문장 흡수(E3-57; ax는 "기획–개발 검증 리드타임 2일 → 1일" — 대시 문자 차이)
- line: "테스트 커버리지 98% 수준 확보"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, nhn]
  approved: 2026-07-23
  note: doosan은 " (내부 측정 기준)" 추가
- line: "팀 단위 AI 도구 활용 기준을 문서·절차로 자산화"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: (millie·millie-career)
- line: "생성형 AI와 AI Coding Agent를 활용한 프론트엔드 개발 생산성 개선"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
  note: 기술 섹션 불릿
- line: "AI Coding Agent가 안정적으로 동작하도록 프로젝트 맥락, 작업 절차, 테스트·완료 조건 구조화"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
  note: 기술 섹션 불릿. millie는 "프로젝트 맥락·작업 절차·테스트·완료 조건 구조화" (승인 출처는 cj-enm·millie-career)
- line: "AI 생성 코드의 컨텍스트, 금지 패턴, 보안 위험, 검증 절차를 FE AX SOP로 표준화"
  exp: EXP-03
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
  note: 기술 섹션 불릿. millie는 ·연결; doosan은 "AI 생성 코드 검증 기준(FE AX SOP) 문서화 및 업무 자동화" (승인 출처는 cj-enm·millie-career)
- line: "Storybook 중심 컴포넌트 개발·검증 절차 수립"
  exp: EXP-03
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn]
  approved: 2026-07-23
  note: 기술 섹션 불릿. millie·millie-career는 "Storybook 중심 공통 컴포넌트 개발·검증 절차 수립"
- line: "Playwright 기반 E2E 회귀 시나리오 자동화 및 배포 전후 검증"
  exp: EXP-03
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie]
  approved: 2026-07-23
  note: 기술 섹션 불릿. dooray " (빌드 프로세스 구축)" 추가
- line: "Jenkins·GitLab CI/CD 빌드·검증·배포 파이프라인 구축, Vercel 배포 자동화"
  exp: EXP-03
  roles: [fe, fullstack]
  section: 경력기술
  status: approved
  sources: [doosan, nhn]
  approved: 2026-07-23
  note: 기술 섹션 불릿. cj-enm·millie·millie-career는 "CI/CD 빌드·검증·배포 흐름 구축, 운영 지표 대시보드 구성"; dooray 추가 불릿 "운영 지표 대시보드 구성 및 Datadog·Lighthouse 기반 성능·오류 모니터링"
```

```yaml
# --- candidate (미제출 초안) ---
- line: "Playwright E2E 자동화 및 팀 개발 생산성 기준 수립"
  exp: EXP-03
  roles: [fe, commerce]
  section: 헤드라인
  status: candidate
  sources: [coupang]
  note: E3-01
- line: "Playwright E2E·Jest 단위 테스트 기반 서비스 안정성 관리"
  exp: EXP-03
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [kakaopay]
  note: E3-02 · variant-of E3-01
- line: "LLM 기반 AI 도구 실무 적용 및 팀 개발 기준 수립·멘토링"
  exp: EXP-03
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [kakaopay]
  note: E3-03
- line: "관측성 도구 기반 지표 분석 및 서비스 개선"
  exp: EXP-03
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [kakaopay]
  note: E3-04
- line: "공통 컴포넌트 아키텍처 및 개발 생산성 기준 수립"
  exp: EXP-03
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [next-sec]
  note: E3-05 · 본문은 EXP-01 Config-Driven UI claim과 혼합
- line: "Codex·Claude Code 활용 개발과 검증 기준의 표준화 (과제 경험의 재사용 표준화)"
  exp: EXP-03
  roles: [ax, ai-product]
  section: 헤드라인
  status: candidate
  sources: [ax]
  note: E3-06
- line: "비개발 직군이 직접 검증할 수 있는 확인 환경 설계 (비개발 직군 수정·테스트 환경)"
  exp: EXP-03
  roles: [ax, ai-product]
  section: 헤드라인
  status: candidate
  sources: [ax]
  note: E3-07
- line: "가설·판정 기준 기반 품질 검증 (판정 기준 수립·MECE 검증)"
  exp: EXP-03
  roles: [ax, ai-product]
  section: 헤드라인
  status: candidate
  sources: [ax]
  note: E3-08
- line: "대웅제약 | 테스트·빌드·배포 자동화 및 팀 개발 품질 기준 수립"
  exp: EXP-03
  roles: [fe, commerce]
  section: 헤드라인
  status: candidate
  sources: [coupang]
  note: E3-09
- line: "대웅제약 | 테스트·빌드·배포 자동화 및 AI 도구 팀 개발 기준 수립"
  exp: EXP-03
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [kakaopay]
  note: E3-10 · variant-of E3-09
- line: "대웅제약 | 품질·운영 자동화 및 개발 기준 수립"
  exp: EXP-03
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [next-sec]
  note: E3-11 · variant-of E3-09
- line: "AI 활용 개발 검증 기준·검증 환경 표준화 (FE AX)"
  exp: EXP-03
  roles: [ax, ai-product]
  section: 헤드라인
  status: candidate
  sources: [ax]
  note: E3-12 · variant-of E3-09
- line: "Playwright E2E 자동화·FE AX SOP·개발 세미나로 팀 생산성·품질 기준 정착"
  exp: EXP-03
  roles: [fe, commerce]
  section: 헤드라인
  status: candidate
  sources: [coupang]
  note: E3-13
- line: "Playwright E2E·Jest 단위 테스트 자동화, LLM 도구 실무 적용과 FE AX SOP 정착"
  exp: EXP-03
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [kakaopay]
  note: E3-14 · variant-of E3-13
- line: "Playwright E2E 자동화·Jenkins CI/CD·운영 데이터 대시보드로 팀 생산성·품질 기준 정착"
  exp: EXP-03
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [next-sec]
  note: E3-15 · variant-of E3-13
- line: "Playwright E2E 자동화 600여 건·Storybook 기반 컴포넌트 검증·FE AX SOP 문서화·개발 세미나 12회로 팀 전체가 같은 기준으로 코드 품질과 개발 생산성을 관리하도록 정착시켰습니다."
  exp: EXP-03
  roles: [fe, commerce]
  section: 요약
  status: candidate
  sources: [coupang]
  note: E3-16
- line: "Playwright E2E 자동화 600여 건·Jest 단위 테스트·Storybook 기반 컴포넌트 검증으로 서비스 안정성을 관리하고, FE AX SOP 문서화·개발 세미나 12회·기술 문서 48건으로 팀이 같은 기준으로 코드 품질과 AI 도구 활용을 관리하도록 정착시켰습니다."
  exp: EXP-03
  roles: [fe, fintech]
  section: 요약
  status: candidate
  sources: [kakaopay]
  note: E3-17 · variant-of E3-16
- line: "Playwright 기반 600여 건의 E2E 회귀 시나리오를 자동화해 반복 QA 시간을 3시간에서 1시간으로 줄이고, Jenkins CI/CD 배포 리드타임을 10분에서 2분으로 단축했으며, 테스트 커버리지 98% 수준을 확보했습니다(내부 측정 기준)."
  exp: EXP-03
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E3-18 · 핵심 성과
- line: "Storybook 컴포넌트 개발·검증 절차와 FE AX SOP 문서화, 개발 세미나 12회·기술 문서 48건으로 팀이 같은 기준으로 코드 품질을 관리하도록 정착시켰습니다."
  exp: EXP-03
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E3-19 · 핵심 성과
- line: "Playwright 기반 600여 건의 E2E 회귀 시나리오와 Jest 단위 테스트로 주요 사용자 흐름·회귀 시나리오를 자동화해 반복 QA 시간을 3시간에서 1시간으로 줄이고, 테스트 커버리지 98% 수준을 확보했습니다 (내부 측정 기준 / 단위·e2e 테스트)."
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E3-20 · 핵심 성과 · variant-of E3-18
- line: "Jenkins CI/CD 빌드·검증·배포 파이프라인을 정비해 배포 리드타임을 10분에서 2분으로 단축했으며, Storybook 중심 컴포넌트 개발·검증 절차로 회귀 위험을 줄였습니다."
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E3-21 · 핵심 성과
- line: "Cursor·Claude 등 LLM 기반 AI 도구를 실무 개발에 적용하고, AI 생성 코드의 컨텍스트 관리·금지 패턴·보안 위험·검증 절차를 FE AX SOP로 문서화해 팀 도입 기준을 정립했습니다 (LLM 도구 실무·팀 도입)."
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E3-22 · 핵심 성과
- line: "개발 세미나 12회·기술 문서 48건으로 팀이 같은 기준으로 코드 품질과 AI 도구 활용을 관리하도록 정착시켰고, 반복 컴포넌트 개발·검증 시간을 90분에서 15분으로 단축했습니다 (약 83%)."
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E3-23 · 핵심 성과
- line: "Datadog·GA4·PostHog·Lighthouse·Adobe Analytics로 성능·오류·사용자 행동 지표를 수집하고, 이를 근거로 렌더링 병목과 네트워크 비용을 개선했습니다 (관측성 기반 개선)."
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E3-24 · 핵심 성과
- line: "운영 데이터 확인 절차를 3단계 수작업에서 1단계 대시보드로 전환하고, HTTP/2 전환으로 네트워크 비용을 1,200KB에서 900KB로 줄였습니다 (약 25%)."
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E3-25 · 핵심 성과 · 1,200KB→900KB 지표는 kakaopay에만 존재
- line: "Config-Driven UI·Base-Theme로 고객사별 테마·기능 노출 조건을 분리하고, Playwright 기반 600여 건의 E2E 회귀 시나리오를 자동화했습니다."
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E3-26 · 핵심 성과 · EXP-01 claim과 혼합
- line: "반복 컴포넌트 개발·검증 시간을 90분에서 15분으로 단축해 운영팀 기능 요청이 들어왔을 때 화면 단위 수정과 배포를 빠르게 반복할 수 있는 구조를 갖췄고, 신규 AI 챗봇 구축 기간을 10주에서 2주로 줄일 수 있는 공통 컴포넌트 구조를 설계했습니다 (운영 시스템 품질 관리)."
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E3-27 · 핵심 성과
- line: "Jenkins CI/CD 배포 리드타임을 10분에서 2분으로 줄여 피드백 수신 후 빠르게 반영·배포하는 운영 대응 구조를 갖췄습니다 (주도적 커뮤니케이션·자기주도)."
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E3-28 · 핵심 성과
- line: "Codex·Claude Code 등 AI 코딩 에이전트로 개발하면서, 생성 코드의 컨텍스트 관리·금지 패턴·보안 위험·검증 절차를 FE AX SOP로 문서화해 사람마다 달랐던 AI 활용 개발 방식을 팀이 반복 사용할 수 있는 기준(하네스)으로 정리했다. 개발 세미나 12회와 기술 문서 48건으로 이 기준을 조직에 축적했다."
  exp: EXP-03
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E3-29 · 핵심 성과 · variant-of E3-22 · 도구명이 kakaopay는 "Cursor·Claude", ax는 "Codex·Claude Code" — 명칭 충돌, 승인 검토 필요
- line: "기획·운영이 배포 전후 상태와 운영 지표를 직접 확인할 수 있도록 절차를 자동화해, 운영 데이터 확인을 3단계 수작업 → 1단계로, 기획–개발 검증 리드타임을 2일 → 1일로 줄였다. Storybook 기반으로 컴포넌트를 독립 확인 가능하게 만들어 반복 컴포넌트 개발을 90분 → 15분(약 83%)으로 단축했다."
  exp: EXP-03
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E3-30 · 핵심 성과
- line: "현업과 검증 대상을 항목으로 나눠 발화 테스트·LLM 응답 검증·타입/빌드·배포 전후 확인을 판정 기준으로 묶고, Playwright로 주요 사용자 흐름과 회귀 시나리오 600여 건을 자동화해 반복 QA 시간을 3시간 → 1시간으로 줄였다. 같은 판정 기준으로 반복 검증할 수 있게 정리해 배포마다 동일 기준을 적용했다."
  exp: EXP-03
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E3-31 · 핵심 성과
- line: "서비스 수와 공통 컴포넌트가 늘면서 수동 QA·반복 UI 개발·배포 전후 확인·운영 지표 조회가 병목이 됐습니다."
  exp: EXP-03
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay, next-sec]
  note: E3-32 · 문제 문단
- line: "AI 생성 코드의 품질·보안·일관성을 검증할 팀 공유 기준도 없어, 서비스 안정 운영을 위한 자동화 절차와 가이드 체계가 필요했습니다."
  exp: EXP-03
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E3-33 · 문제 문단
- line: "Cursor·Claude 같은 LLM 도구로 생성한 코드의 품질·보안·일관성을 검증할 팀 공유 기준도 없어, 안정 운영을 위한 자동화 절차와 도입 기준이 필요했습니다."
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E3-34 · 문제 문단 · variant-of E3-33
- line: "운영팀의 지표 확인 요청이 늘어나면서 개발팀이 수동으로 3단계를 거쳐 데이터를 조회해 전달하는 구조가 유지보수 부담이 되었습니다."
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E3-35 · 문제 문단
- line: "수동 발화 테스트, 반복 UI 개발, 배포 전후 확인, 운영 지표 조회가 병목이었고, AI로 생성한 코드의 품질·보안·일관성을 판정할 기준이 없었다."
  exp: EXP-03
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E3-36 · 문제 문단 · variant-of E3-32
```

```yaml
# --- candidate (미제출 초안, 계속) ---
- line: "Playwright 기반 주요 사용자 흐름·E2E 회귀 시나리오와 Jest 단위 테스트 자동화 (단위·e2e 테스트)"
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E3-38 · variant-of E3-37(승인 항목에 흡수됨)
- line: "Playwright로 주요 사용자 흐름·회귀 시나리오 600여 건 자동화 (MECE 검증)"
  exp: EXP-03
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E3-39 · variant-of E3-37(승인 항목에 흡수됨)
- line: "Storybook 중심 컴포넌트 상태별 개발·검증 절차 수립"
  exp: EXP-03
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay, next-sec]
  note: E3-40 · coupang만 "(컴포넌트화·모듈화)" 태그; kakaopay 기술 섹션에도 태그 없이 재출현
- line: "Storybook 기반 컴포넌트 독립 개발·확인 절차 수립 (비개발 직군 확인 환경)"
  exp: EXP-03
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E3-41 · variant-of E3-40
- line: "Jenkins CI/CD 빌드·검증·배포 파이프라인 정비"
  exp: EXP-03
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay, next-sec]
  note: E3-42
- line: "GA4·PostHog 기반 운영 지표 대시보드 구성"
  exp: EXP-03
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay]
  note: E3-43 · kakaopay만 "(관측성 기반 개선)" 태그
- line: "GA4·PostHog 기반 운영 지표 대시보드 구성으로 운영팀 셀프 확인 가능한 구조 전환 (운영 데이터 관리)"
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E3-44 · variant-of E3-43
- line: "GA4·PostHog 기반 운영 데이터 확인 절차 구축 (비개발 직군 수정·테스트)"
  exp: EXP-03
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E3-45 · variant-of E3-43
- line: "AI 생성 코드의 컨텍스트 관리·금지 패턴·보안 위험·검증 절차를 FE AX SOP로 문서화"
  exp: EXP-03
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, next-sec]
  note: E3-46 · coupang만 "(팀 아키텍처·디자인 가이드)" 태그 · 제출본(dooray-career) ·연결 동일 변형이 approved 항목 note에 존재
- line: "Cursor·Claude 등 LLM 도구를 실무에 적용하고, AI 생성 코드의 컨텍스트 관리·금지 패턴·보안 위험·검증 절차를 FE AX SOP로 문서화 (LLM 도구 팀 도입)"
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E3-47 · variant-of E3-46
- line: "Codex·Claude Code 등 AI 코딩 에이전트로 개발하고, 생성 코드의 컨텍스트 관리·금지 패턴·보안 위험·검증 절차를 FE AX SOP로 문서화 (Codex·Claude Code 활용·재사용 표준)"
  exp: EXP-03
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E3-48 · variant-of E3-46 · 도구명 충돌 (E3-29 참고)
- line: "개발 세미나 12회 운영·기술 문서 48건으로 팀 학습·적용·공유 체계 정착"
  exp: EXP-03
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay]
  note: E3-49 · kakaopay만 "(멘토링·기술 리딩)" 태그
- line: "개발 세미나 12회 운영·기술 문서 48건으로 팀 학습·공유 체계 정착"
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E3-50 · variant-of E3-49
- line: "E2E 발화 테스트·LLM 응답 검증·타입/테스트/빌드·배포 전후 확인을 판정 기준으로 정리 (판정 기준 수립·하네스)"
  exp: EXP-03
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E3-51
- line: "반복 컴포넌트 개발·검증 시간을 90분에서 15분으로 단축 (약 83%)"
  exp: EXP-03
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay, next-sec]
  note: E3-54 · 성과 · coupang은 경력 bullet과 성과에 2회 출현; ax는 "반복 컴포넌트 개발 90분 → 15분(약 83%)"
- line: "Jenkins CI/CD 배포 리드타임을 10분에서 2분으로 단축"
  exp: EXP-03
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay, next-sec]
  note: E3-56 · 성과
- line: "테스트 커버리지 98% 수준 확보 (내부 측정 기준)"
  exp: EXP-03
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay]
  note: E3-58 · 성과
- line: "Playwright 기반 600여 건 E2E 회귀 시나리오 자동화 및 Jenkins CI/CD 빌드·배포 파이프라인 구축"
  exp: EXP-03
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E3-59 · 제출본(doosan·dooray) 경력 불릿의 동일 변형이 approved 항목 note에 존재
- line: "Playwright 600여 건 E2E·Jest 단위 테스트 자동화, 반복 QA 3시간 → 1시간 (단위·e2e 테스트)"
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E3-60 · variant-of E3-59
- line: "Playwright 기반 600여 건 E2E 회귀 시나리오 자동화, 반복 QA 3시간 → 1시간"
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E3-61 · variant-of E3-59 · coupang 기술 섹션은 "...반복 QA 3시간 → 1시간 단축 (생산성 향상)", next 기술 섹션은 "...(품질 관리)" 태그로 재출현
- line: "Jenkins CI/CD 빌드·배포 파이프라인 정비, 배포 리드타임 10분 → 2분"
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E3-62
- line: "Jenkins CI/CD 빌드·배포 파이프라인 구축, 배포 리드타임 10분 → 2분 (CI/CD)"
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E3-63 · variant-of E3-62
- line: "AI 생성 코드 검증 기준(FE AX SOP) 문서화, 개발 세미나 12회·기술 문서 48건 (생산성·품질 가이드)"
  exp: EXP-03
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E3-64
- line: "Cursor·Claude 등 LLM 도구 실무 적용, FE AX SOP 문서화·개발 세미나 12회·기술 문서 48건 (AI 도구 팀 도입)"
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E3-65 · variant-of E3-64
- line: "Jenkins·GitLab CI/CD·Vercel 빌드·검증·배포 파이프라인 구축, 배포 리드타임 10분 → 2분 단축"
  exp: EXP-03
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E3-66 · 기술 섹션 불릿 · kakaopay·next는 말미 "단축" 없이 "...배포 리드타임 10분 → 2분"
- line: "FE AX SOP 문서화, 개발 세미나 12회·기술 문서 48건으로 팀 코드 품질 기준 수립"
  exp: EXP-03
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E3-67 · 기술 섹션 불릿
- line: "Storybook 중심 컴포넌트 개발·검증 절차 수립 및 팀 가이드"
  exp: EXP-03
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E3-68 · 기술 섹션 불릿 · next 기술 섹션은 "Storybook 중심 컴포넌트 개발·검증 절차 수립"
- line: "Cursor·Claude 등 LLM 기반 AI 도구를 실무 개발에 적용하고 팀 도입 기준을 FE AX SOP로 문서화 (LLM 도구 실무·팀 도입)"
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E3-69 · 기술 섹션 불릿 · variant-of E3-46
- line: "AI 생성 코드의 컨텍스트 관리·금지 패턴·보안 위험·검증 절차 문서화, 개발 세미나 12회·기술 문서 48건"
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E3-70 · 기술 섹션 불릿 · variant-of E3-46
- line: "Datadog·GA4·PostHog 기반 성능·오류·사용자 행동 지표 수집 및 개선 근거 확보 (관측성)"
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E3-71 · 기술 섹션 불릿
- line: "Lighthouse 병목 분석 기반 렌더링·리소스 최적화"
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E3-72 · 기술 섹션 불릿
- line: "GA4·PostHog 기반 운영 데이터 대시보드 구성으로 운영팀 지표 확인 절차 3단계 → 1단계"
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E3-73 · 기술 섹션 불릿 · variant-of E3-44
- line: "공통 컴포넌트·Custom Hook 구조화로 반복 개발 시간 90분 → 15분 단축"
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E3-74 · 기술 섹션 불릿
- line: "Lighthouse·Datadog 기반 성능·오류 모니터링 체계 운영"
  exp: EXP-03
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E3-75 · 기술 섹션 불릿
- line: "Codex·Claude Code로 개발하고, 생성 코드의 금지 패턴·보안 위험·검증 절차를 SOP(하네스)로 표준화"
  exp: EXP-03
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E3-76 · 기술 섹션 불릿 · variant-of E3-48
- line: "주요 사용자 흐름·회귀 시나리오 600여 건 자동화, 반복 QA 3시간 → 1시간"
  exp: EXP-03
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E3-77 · 기술 섹션 불릿 · variant-of E3-61
- line: "판정 기준을 세워 400건 발화 검증 기준 정상 출력률 100% 확인"
  exp: EXP-03
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E3-78 · 기술 섹션 불릿 · 400건 발화 지표 자체는 EXP-01 소속
- line: "AWS 환경에서 운영되는 서비스의 빌드·검증·배포를 Jenkins로 정비해 배포 리드타임을 10분 → 2분(약 80%)으로 단축"
  exp: EXP-03
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E3-79 · 기술 섹션 불릿 · "AWS 환경" 언급은 ax에만 존재
- line: "배포 전후 상태와 운영 지표를 기획·운영이 직접 확인할 수 있도록 확인 절차 자동화"
  exp: EXP-03
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E3-80 · 기술 섹션 불릿
```

### EXP-04 · 삼성물산 데이터·모바일 서비스 고도화

```yaml
# --- approved (제출본) ---
- line: "대용량 데이터 대시보드 및 React Native 모바일 서비스 고도화"
  exp: EXP-04
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
- line: "Vue 3 기반 대용량 데이터 대시보드 성능 최적화 및 React Native 모바일 서비스 고도화"
  exp: EXP-04
  roles: [fe, fullstack, commerce, fintech]
  section: 헤드라인
  status: approved
  sources: [doosan, nhn, coupang, kakaopay]
  approved: 2026-07-23
  note: 위 헤드라인 변형. 미제출 초안 동일 문장 흡수(E4-06)
- line: "삼성물산 — 데이터 플랫폼·React Native 모바일 서비스 고도화"
  exp: EXP-04
  roles: [fe]
  section: 헤드라인
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: (dooray-career)
- line: "Web 대시보드는 대용량 테이블·시계열 데이터를 빠르게 제공해야 했고, 모바일 앱은 반복 API 호출과 플랫폼별 동작 차이로 사용자 대기 시간과 운영 부담이 발생했습니다."
  exp: EXP-04
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie, coupang, kakaopay]
  approved: 2026-07-23
  note: 문제 문단. millie는 "사용자 대기·운영 부담이 발생했습니다."(승인 출처는 millie-career); dooray-career는 "…React Native 앱은 반복 API 호출과 플랫폼별 동작 차이로 사용자 대기 시간과 운영 부담이 컸다." 미제출 초안 동일 문장 흡수(E4-12)
- line: "Vue 3·ECharts·RealGrid 기반 대용량 데이터 시각화 화면 개발"
  exp: EXP-04
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie, coupang, kakaopay]
  approved: 2026-07-23
  note: dooray는 " (SPA 서비스 프론트엔드 개발)" 추가. 미제출 초안 동일 문장 흡수(E4-15)
- line: "테이블·차트 렌더링 생명주기를 분리하고 Lazy Rendering을 적용해 초기 처리량 최적화"
  exp: EXP-04
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie, coupang, kakaopay, next-sec]
  approved: 2026-07-23
  note: doosan·dooray " (성능 개선)" 추가. dooray-career는 "테이블·차트 렌더링 생명주기 분리 및 Lazy Rendering 적용으로 초기 처리량 최적화"; millie는 "테이블·차트 렌더링 생명주기 분리 + Lazy Rendering으로 초기 처리량 최적화". 미제출 초안 동일 문장 흡수(E4-18; coupang·kakaopay "(성능 개선)", next "(성능 최적화)" 태그)
- line: "Spring REST API와 필터링·정렬 로직을 설계하고 사용자 역할별 데이터 조회·표현 구조 구성"
  exp: EXP-04
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie, coupang, kakaopay]
  approved: 2026-07-23
  note: doosan " (API 설계)" 추가. dooray-career는 "Spring REST API와 필터링·정렬 로직 설계, 사용자 역할별 데이터 조회·표현 구조 구성"(millie도 동일 축약형). 미제출 초안 동일 문장 흡수(E4-19)
- line: "검색 시마다 API를 호출하던 구조를 화면 진입 시 비동기 선조회 후 Recoil에 저장하는 방식으로 변경"
  exp: EXP-04
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie, coupang, kakaopay]
  approved: 2026-07-23
  note: doosan·dooray " (코드 품질·UX 개선)" 추가. millie는 "검색 시마다 호출하던 구조를 화면 진입 시 비동기 선조회 후 Recoil 저장으로 변경"(승인 출처는 millie-career); dooray-career는 "검색마다 API를 호출하던 구조를 화면 진입 시 비동기 선조회 후 Recoil 저장 방식으로 개선". 미제출 초안 동일 문장 흡수(E4-22; coupang만 "(UX 개선)" 태그, next는 말미 "...방식으로 전환")
- line: "React Native 기반 iOS·Android 공통 기능, Firebase FCM 실시간 알림, 플랫폼별 배포·운영 이슈 대응"
  exp: EXP-04
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie, coupang, kakaopay]
  approved: 2026-07-23
  note: millie는 "…양 플랫폼 배포·운영 대응"; dooray-career는 "React Native iOS/Android 공통 기능, …". 미제출 초안 동일 문장 흡수(E4-23; coupang만 "(모바일 앱)" 태그)
- line: "대시보드 렌더링 시간을 2.5초에서 1초대로 개선"
  exp: EXP-04
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn]
  approved: 2026-07-23
  note: millie "대시보드 렌더링 2.5초 → 1초대(약 60%)"; millie-career "대시보드 렌더링 시간을 2.5초 → 1초대로 개선"; dooray-career "대용량 데이터 대시보드 렌더링 시간 2.5초→1초대 개선"
- line: "React Native 앱 검색 응답 시간을 5초에서 1초로 단축"
  exp: EXP-04
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, coupang, kakaopay]
  approved: 2026-07-23
  note: millie "React Native 앱 검색 응답 5초 → 1초(80%)"; dooray-career "React Native 앱 검색 응답 시간 5초→1초(80%) 단축". 미제출 초안 동일 문장 흡수(E4-27; next는 "...단축 (80% 단축)", ax는 "React Native 앱 검색 응답 5초 → 1초(약 80%)")
- line: "Web 데이터 흐름부터 iOS·Android 개발·배포까지 크로스플랫폼 개발 범위 확보"
  exp: EXP-04
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie]
  approved: 2026-07-23
  note: millie는 "…크로스플랫폼 범위 확보"(승인 출처는 millie-career·dooray-career 포함)
- line: "Vue 3·ECharts·RealGrid 기반 대용량 생산 공정 데이터 시각화 대시보드 개발"
  exp: EXP-04
  roles: [fe, fullstack]
  section: 경력기술
  status: approved
  sources: [doosan, nhn]
  approved: 2026-07-23
  note: 경력 요약 불릿. cj-enm·millie는 "Vue 3·ECharts·RealGrid 기반 생산 공정 데이터 시각화 대시보드 개발"
- line: "React Native 기반 iOS/Android 앱 기능 고도화 및 플랫폼별 이슈 대응"
  exp: EXP-04
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie]
  approved: 2026-07-23
  note: 경력 요약 불릿
- line: "Spring REST API·필터링·정렬 로직 설계 및 역할별 데이터 조회·표현 구조 구성"
  exp: EXP-04
  roles: [fullstack]
  section: 경력기술
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: doosan 경력 요약 불릿(내담 경력 불릿)
- line: "대용량 테이블·시계열 데이터 시각화 및 Lazy Rendering 최적화"
  exp: EXP-04
  roles: [fe, fullstack, ai-product, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie, coupang, kakaopay]
  approved: 2026-07-23
  note: 기술 섹션 불릿. 미제출 초안 동일 문장 흡수(E4-32)
- line: "React Native 기반 iOS·Android 앱 기능 개발 및 배포"
  exp: EXP-04
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn]
  approved: 2026-07-23
  note: 기술 섹션 불릿. millie·millie-career는 "React Native 기반 iOS·Android 공통 기능 개발 및 배포"
```

```yaml
# --- candidate (미제출 초안) ---
- line: "대용량 데이터 대시보드·React Native 모바일 성능 최적화"
  exp: EXP-04
  roles: [fe, commerce]
  section: 헤드라인
  status: candidate
  sources: [coupang]
  note: E4-01
- line: "대용량 데이터 대시보드·관리자 시스템 설계 및 성능 최적화"
  exp: EXP-04
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [next-sec]
  note: E4-02 · variant-of E4-01
- line: "삼성물산 | 데이터 플랫폼·모바일 애플리케이션"
  exp: EXP-04
  roles: [fe, commerce, fintech]
  section: 헤드라인
  status: candidate
  sources: [coupang, kakaopay]
  note: E4-03
- line: "삼성물산 | 데이터 플랫폼 대시보드·관리자 시스템 설계 및 성능 최적화"
  exp: EXP-04
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [next-sec]
  note: E4-04 · variant-of E4-03
- line: "삼성물산 데이터·모바일 서비스 고도화"
  exp: EXP-04
  roles: [ax, ai-product]
  section: 헤드라인
  status: candidate
  sources: [ax]
  note: E4-05 · variant-of E4-03
- line: "Vue 3·ECharts·RealGrid 기반 대용량 데이터 대시보드 성능 개선 및 역할별 데이터 조회·관리 구조 설계"
  exp: EXP-04
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [next-sec]
  note: E4-07 · variant-of E4-06(승인 항목에 흡수됨)
- line: "삼성물산 데이터 플랫폼(내담씨앤씨 SI 프로젝트)에서 Vue 3·ECharts·RealGrid로 수천 행의 테이블과 시계열 차트를 렌더링하며 화면 처리 시간을 2.5초에서 1초대로 줄였고, 역할별 데이터 조회·필터·정렬 구조를 Spring REST API부터 화면까지 직접 설계했습니다."
  exp: EXP-04
  roles: [fe, fintech]
  section: 요약
  status: candidate
  sources: [next-sec]
  note: E4-08
- line: "Vue 3·ECharts·RealGrid 기반 대용량 데이터 대시보드에서 렌더링 생명주기 분리와 Lazy Rendering을 적용해 렌더링 시간을 2.5초에서 1초대로 개선했습니다."
  exp: EXP-04
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E4-09 · 핵심 성과
- line: "React Native 앱에서는 검색 응답 시간을 5초에서 1초로 단축했습니다."
  exp: EXP-04
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E4-10 · 핵심 성과
- line: "삼성물산 데이터 플랫폼에서 Vue 3·ECharts·RealGrid 기반으로 수천 행의 테이블과 시계열 데이터를 처리하는 화면을 개발했습니다. 테이블·차트 렌더링 생명주기를 분리하고 Lazy Rendering을 적용해 대시보드 처리 시간을 2.5초에서 1초대로 개선했습니다. 역할별 데이터 조회·필터·정렬 로직을 Spring REST API와 함께 설계해 운영 담당자마다 다른 데이터 접근 구조를 구현했습니다 (관리자/운영 시스템·데이터 대시보드)."
  exp: EXP-04
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E4-11 · 핵심 성과
- line: "Web 대시보드는 수천 행의 테이블과 시계열 데이터를 빠르게 렌더링해야 했지만, 전체 데이터를 한 번에 처리하는 구조로 초기 화면 진입 시 2.5초 이상 대기가 발생했습니다. 운영 담당자마다 역할에 따라 다른 데이터 접근 범위와 조회 조건이 필요했고, 모바일 앱은 반복 API 호출로 사용자 대기 시간이 길었습니다."
  exp: EXP-04
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E4-13 · 문제 문단 · variant-of E4-12(승인 항목에 흡수됨)
- line: "Web 대시보드의 대용량 테이블·시계열 렌더링과 모바일 앱의 반복 API 호출·플랫폼별 동작 차이가 사용자 대기와 운영 부담을 만들었다."
  exp: EXP-04
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E4-14 · 문제 문단 · variant-of E4-12(승인 항목에 흡수됨)
- line: "Vue 3·ECharts·RealGrid 기반 대용량 테이블·시계열 데이터 시각화 화면 개발 (관리자/운영 시스템)"
  exp: EXP-04
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E4-16 · variant-of E4-15(승인 항목에 흡수됨)
- line: "Vue 3·ECharts·RealGrid 기반 대용량 데이터 화면 개발, 렌더링 생명주기 분리와 Lazy Rendering 적용"
  exp: EXP-04
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E4-17 · variant-of E4-15(승인 항목에 흡수됨)
- line: "Spring REST API와 역할별 데이터 조회·필터·정렬 로직을 함께 설계해 사용자 권한별 데이터 표현 구조 구성 (데이터 조회·처리 인터페이스)"
  exp: EXP-04
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E4-20 · variant-of E4-19(승인 항목에 흡수됨)
- line: "Spring REST API와 필터링·정렬 로직 설계, 역할별 데이터 조회·표현 구조 개발 (Python·SQL 인접 데이터 가공)"
  exp: EXP-04
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E4-21 · variant-of E4-19(승인 항목에 흡수됨)
- line: "React Native 기반 iOS·Android 공통 기능 개발, Firebase FCM 실시간 알림 연동, 플랫폼별 배포·운영 이슈 대응"
  exp: EXP-04
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E4-24 · variant-of E4-23(승인 항목에 흡수됨)
- line: "React Native 앱 검색·조회 흐름 개선 및 플랫폼별 이슈 대응"
  exp: EXP-04
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E4-25 · variant-of E4-23(승인 항목에 흡수됨)
- line: "대용량 데이터 대시보드 렌더링 시간을 2.5초에서 1초대로 개선"
  exp: EXP-04
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay]
  note: E4-26 · 성과 · next는 "...개선 (약 60%)"; ax는 "대용량 데이터 대시보드 렌더링 2.5초 → 1초대"
- line: "Vue 3·ECharts·RealGrid 기반 대용량 데이터 대시보드 Lazy Rendering 적용, 렌더링 시간 2.5초 → 1초대"
  exp: EXP-04
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E4-28 · kakaopay는 "...적용, 렌더링 2.5초 → 1초대"
- line: "Vue 3·ECharts·RealGrid 기반 대용량 데이터 대시보드 개발, 렌더링 시간 2.5초 → 1초대 (관리자/운영 시스템·데이터 대시보드)"
  exp: EXP-04
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E4-29 · variant-of E4-28
- line: "React Native 기반 iOS·Android 앱 기능 고도화 및 플랫폼별 이슈 대응, 검색 응답 5초 → 1초 단축"
  exp: EXP-04
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E4-30 · kakaopay는 말미 "단축" 없이 "...검색 응답 5초 → 1초"
- line: "Spring REST API와 역할별 데이터 조회·필터·정렬 구조 설계 (데이터 조회·처리 인터페이스)"
  exp: EXP-04
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E4-31
- line: "Vue 3·ECharts·RealGrid 기반 대용량 테이블·시계열 데이터 렌더링 및 Lazy Rendering 최적화"
  exp: EXP-04
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E4-33 · 기술 섹션 불릿 · variant-of E4-32(승인 항목에 흡수됨)
- line: "역할별 데이터 조회·필터·정렬 구조를 REST API와 함께 설계"
  exp: EXP-04
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E4-34 · 기술 섹션 불릿 · variant-of E4-31
- line: "관리자·운영 시스템의 복잡한 폼·테이블·대시보드 화면 직접 설계·구현 (관리자/운영 시스템)"
  exp: EXP-04
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E4-35 · 기술 섹션 불릿
- line: "React Native 기반 iOS·Android 앱 기능 개발 및 플랫폼별 배포·운영 이슈 대응 (모바일 앱)"
  exp: EXP-04
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E4-36 · 기술 섹션 불릿
- line: "대용량 데이터 시각화와 성능 개선(렌더링 2.5초 → 1초대)"
  exp: EXP-04
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E4-37 · 기술 섹션 불릿 · variant-of E4-32(승인 항목에 흡수됨)
```

### EXP-05 · 한국미스미 글로벌 B2B 커머스 개선 및 Next.js 전환

```yaml
# --- approved (제출본) ---
- line: "글로벌 B2B 쇼핑몰 현대화 및 성능 개선"
  exp: EXP-05
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
- line: "PHP 레거시 Next.js 전환 및 글로벌 B2B 서비스 성능·배포·모니터링 구조 개선"
  exp: EXP-05
  roles: [fe, fullstack]
  section: 헤드라인
  status: approved
  sources: [doosan, nhn]
  approved: 2026-07-23
  note: 위 헤드라인 변형
- line: "글로벌 B2B 쇼핑몰 Next.js 현대화 및 성능 개선"
  exp: EXP-05
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 헤드라인 변형 (millie·millie-career)
- line: "한국미스미 — 글로벌 B2B 커머스 Next.js 전환 및 성능 개선"
  exp: EXP-05
  roles: [fe]
  section: 헤드라인
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: (dooray-career)
- line: "Next.js 기반 레거시 현대화 및 렌더링·성능 최적화"
  exp: EXP-05
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 핵심 성과 소제목 (millie·millie-career)
- line: "React·Next.js 기반 웹 서비스, Vue 3 대시보드, React Native 모바일 앱을 개발하며 화면 구현, 상태 관리, API 응답 처리, 렌더링 성능 개선까지 수행했습니다. 글로벌 B2B 커머스에서는 PHP·jQuery 기반 화면을 React·Next.js·TypeScript 구조로 전환하고 페이지 접근 시간을 8초에서 2초로 단축했습니다."
  exp: EXP-05
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
  note: 앞문장은 다중 경험(EXP-04/05) 프로즈
- line: "PHP·jQuery 글로벌 B2B 커머스를 Next.js·React·TypeScript 구조로 전환하고 페이지 특성별 SSR·CSR 렌더링 전략을 분리. Lighthouse 병목 분석·리소스 최적화로 페이지 접근 8초 → 2초, 평균 로딩 약 50% 개선"
  exp: EXP-05
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: millie-career 변형은 "…렌더링 전략을 분리. Lighthouse 병목 분석과 리소스 최적화로 페이지 접근 시간을 8초 → 2초, 평균 로딩 속도를 약 50% 개선"
- line: "PHP·jQuery 기반 글로벌 쇼핑몰은 화면 결합도가 높아 확장과 유지보수가 어려웠고, 긴 초기 접근 시간과 단일 렌더링 구조로 성능·검색 노출을 함께 최적화하기 어려웠습니다. 국가별 환경을 지원하면서 단계적으로 현대화해야 했습니다."
  exp: EXP-05
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
  note: 문제 문단 (cj-enm·cj-enm-rewrite·millie-career)
- line: "PHP·jQuery 기반 글로벌 쇼핑몰은 화면 결합도가 높아 확장과 유지보수가 어려웠고, 긴 초기 접근 시간과 단일 렌더링 구조로 성능·검색 노출을 함께 최적화하기 어려웠습니다. 다국어 환경과 국가별 배포 요건을 지원하면서 단계적으로 현대화해야 했습니다."
  exp: EXP-05
  roles: [fe, fullstack]
  section: 경력기술
  status: approved
  sources: [doosan, nhn]
  approved: 2026-07-23
  note: 위 문제 문단 변형
- line: "PHP·jQuery 기반 글로벌 쇼핑몰은 결합도가 높아 확장·유지보수가 어렵고, 긴 초기 접근 시간과 단일 렌더링으로 성능·검색 노출을 함께 최적화하기 어려웠습니다. 국가별 환경을 지원하며 단계적으로 현대화해야 했습니다."
  exp: EXP-05
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 문제 문단 변형 (압축형)
- line: "PHP·jQuery 기반 글로벌 쇼핑몰은 화면 결합도가 높아 확장·유지보수가 어려웠고, 긴 초기 접근 시간과 단일 렌더링 구조로 성능과 검색 노출을 함께 최적화하기 어려웠다."
  exp: EXP-05
  roles: [fe]
  section: 경력기술
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 위 문제 문단 변형 (평서형, dooray-career)
- line: "PHP·jQuery 레거시를 Next.js·React·TypeScript 컴포넌트 구조로 전환"
  exp: EXP-05
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
  note: doosan·dooray는 "…컴포넌트 구조로 단계적 전환 (레거시 점진 전환)"; dooray-career는 "…단계적 전환" (승인 출처는 cj-enm·cj-enm-rewrite)
- line: "PHP·jQuery 레거시를 Next.js·TypeScript 컴포넌트 구조로 전환, 페이지 특성별 SSR·CSR 렌더링 전략 분리"
  exp: EXP-05
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 위 항목 결합형; millie-career는 "PHP·jQuery 레거시를 Next.js·React·TypeScript 컴포넌트 구조로 전환, 페이지 특성별 SSR·CSR 렌더링 전략 분리"
- line: "페이지 특성별 SSR·CSR 렌더링 전략 분리"
  exp: EXP-05
  roles: [fe, ai-product, fintech]
  section: 경력기술
  status: approved
  sources: [cj-enm, nhn, kakaopay, next-sec]
  approved: 2026-07-23
  note: doosan은 " (Node 런타임 환경)" 추가 (승인 출처는 cj-enm·cj-enm-rewrite·dooray·dooray-career). 미제출 초안 동일 문장 흡수(E5-22; kakaopay "(SSR·CSR 대응)", next "(성능 최적화)" 태그)
- line: "상품 비교, 멀티 다운로드 등 복잡한 기능을 공통 컴포넌트와 Custom Hook으로 구조화"
  exp: EXP-05
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, nhn]
  approved: 2026-07-23
  note: doosan " (모듈화)" 추가; dooray-career는 "상품 비교·멀티 다운로드 등 복잡한 기능을 공통 컴포넌트·Custom Hook으로 구조화"; millie-career는 "…구조화, Redux로 화면 간 상태 일관성 확보"; millie는 "상품 비교·멀티다운로드 등 복잡한 기능을 공통 컴포넌트·Custom Hook으로 구조화, Redux로 상태 일관성 확보"
- line: "Redux 기반 상태 관리로 화면 간 상태 일관성 확보"
  exp: EXP-05
  roles: [fe, fullstack, ai-product, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, next-sec]
  approved: 2026-07-23
  note: 승인 출처는 doosan·cj-enm·cj-enm-rewrite·dooray·dooray-career. 미제출 초안 동일 문장 흡수(E5-28)
- line: "Lighthouse 병목 분석 후 Lazy Loading, 비동기 API, 리소스 최적화 적용"
  exp: EXP-05
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, nhn, millie]
  approved: 2026-07-23
  note: doosan " (성능 최적화)", dooray " (성능 최적화)" 추가. dooray-career는 "Lighthouse 병목 분석 후 Lazy Loading·비동기 API·폰트 최적화 적용"; millie는 "Lighthouse 병목 분석 + Lazy Loading·비동기 API·리소스 최적화, SEO·영중일 다국어 구조 적용" (millie 승인 출처는 millie-career)
- line: "SEO, 영·중·일 다국어 구조, Vercel 배포 자동화, Datadog·GA·Adobe Analytics 기반 모니터링 체계 구축"
  exp: EXP-05
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
  note: (cj-enm·cj-enm-rewrite·millie-career)
- line: "i18next 기반 글로벌 다국어 구조 구축"
  exp: EXP-05
  roles: [fe, fullstack, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, nhn, kakaopay, next-sec]
  approved: 2026-07-23
  note: 미제출 초안 동일 문장 흡수(E5-26)
- line: "Vercel 배포 자동화, Datadog·GA·Adobe Analytics 기반 운영 모니터링 체계 구축"
  exp: EXP-05
  roles: [fe, fullstack, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, nhn, kakaopay, next-sec]
  approved: 2026-07-23
  note: doosan " (빌드·배포 자동화)", dooray " (빌드 프로세스·배포 자동화)" 추가. millie는 "Vercel 배포 자동화, Datadog·GA·Adobe Analytics 분석·모니터링 체계 구축"; dooray-career는 "i18next 기반 글로벌 다국어 구조, Vercel 배포 자동화, Datadog·GA·Adobe Analytics 모니터링 체계 구축". 미제출 초안 동일 문장 흡수(E5-27; kakaopay만 "(관측성)" 태그)
- line: "페이지 접근 시간을 8초에서 2초로 단축"
  exp: EXP-05
  roles: [fe, fullstack, ai-product, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, kakaopay]
  approved: 2026-07-23
  note: millie "페이지 접근 시간 8초 → 2초, Next.js 전환 후 평균 로딩 약 50% 개선"; millie-career "페이지 접근 시간을 8초 → 2초로 단축"; dooray-career "페이지 접근 시간 8초→2초 단축". 미제출 초안 동일 문장 흡수(E5-30; next는 "...단축 (75% 단축)", ax는 "페이지 접근 시간 8초 → 2초")
- line: "Next.js 전환 후 기존 PHP 서비스 대비 평균 로딩 속도 약 50% 개선"
  exp: EXP-05
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie]
  approved: 2026-07-23
  note: 승인 출처는 doosan·cj-enm·cj-enm-rewrite·dooray·millie-career·dooray-career
- line: "인터랙션 기능 개선 이후 사용자 체류 시간 32% 증가"
  exp: EXP-05
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
- line: "화면 개발에서 아키텍처, 성능, 다국어, 배포, 모니터링까지 책임 범위 확장"
  exp: EXP-05
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
  note: (cj-enm·cj-enm-rewrite·millie-career)
- line: "화면 개발에서 아키텍처, 성능, 다국어, 배포 자동화, 모니터링까지 책임 범위 확장"
  exp: EXP-05
  roles: [fe, fullstack]
  section: 경력기술
  status: approved
  sources: [doosan, nhn]
  approved: 2026-07-23
  note: 위 항목 변형. dooray-career는 ·연결 "화면 개발에서 아키텍처·성능·다국어·배포 자동화·모니터링까지 책임 범위 확장"; millie는 "화면 개발에서 아키텍처·성능·다국어·배포·모니터링까지 책임 범위 확장"
- line: "PHP/jQuery 기반 B2B 쇼핑몰을 React/Next.js/TypeScript 구조로 단계적 전환 (레거시 점진 전환)"
  exp: EXP-05
  roles: [fe, fullstack]
  section: 경력기술
  status: approved
  sources: [doosan, nhn]
  approved: 2026-07-23
  note: 경력 요약 불릿. cj-enm·millie는 "PHP/jQuery 기반 B2B 쇼핑몰을 React/Next.js/TypeScript 구조로 전환"
- line: "상품 비교·멀티 다운로드 등 복잡한 기능을 공통 컴포넌트·Custom Hook으로 모듈화"
  exp: EXP-05
  roles: [fe, fullstack, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, coupang, kakaopay, next-sec]
  approved: 2026-07-23
  note: 경력 요약 불릿. 미제출 초안 동일 문장 흡수(E5-38)
- line: "Lazy Loading, 비동기 API, 폰트 최적화를 통한 성능 개선 (페이지 접근 시간 8초 → 2초)"
  exp: EXP-05
  roles: [fe, fullstack]
  section: 경력기술
  status: approved
  sources: [doosan, nhn]
  approved: 2026-07-23
  note: 경력 요약 불릿. cj-enm·millie는 "Lazy Loading, 비동기 API, 폰트 최적화를 통한 페이지 접근 속도 개선"
- line: "Vercel 배포 자동화, Lighthouse·GA·Adobe Analytics·Datadog 기반 성능·SEO·오류 추적 체계 운영"
  exp: EXP-05
  roles: [fe, fullstack, commerce, fintech]
  section: 경력기술
  status: approved
  sources: [doosan, nhn, coupang, kakaopay]
  approved: 2026-07-23
  note: 경력 요약 불릿. cj-enm·millie는 "Lighthouse·GA·Adobe Analytics·Datadog 기반 성능·SEO·오류 추적 체계 운영". 미제출 초안 동일 문장 흡수(E5-39; kakaopay만 "(관측성)" 태그)
- line: "Next.js 기반 웹 서비스 개발 및 페이지 특성별 SSR·CSR 렌더링 전략 분리"
  exp: EXP-05
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 기술 섹션 불릿 (millie·millie-career). doosan·cj-enm·dooray는 "Next.js 기반 SSR·CSR 렌더링 전략 분리"(doosan은 " (Node 런타임 기반 SSR)" 추가)
- line: "PHP·jQuery / jQuery·Thymeleaf 레거시를 React·Next.js 구조로 점진적 현대화"
  exp: EXP-05
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: 기술 섹션 불릿 (millie·millie-career)
- line: "복잡한 기능을 공통 컴포넌트·Custom Hook으로 구조화 (계층 분리·의존성 정리)"
  exp: EXP-05
  roles: [fullstack]
  section: 경력기술
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 기술 섹션 불릿
```

```yaml
# --- candidate (미제출 초안) ---
- line: "글로벌 B2B 커머스 Next.js 전환 및 PC 웹 성능 개선"
  exp: EXP-05
  roles: [fe, commerce]
  section: 헤드라인
  status: candidate
  sources: [coupang]
  note: E5-01
- line: "SSR·CSR 렌더링 전략 분리 및 Next.js 웹 성능 개선"
  exp: EXP-05
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [kakaopay]
  note: E5-02 · variant-of E5-01
- line: "PHP·jQuery 레거시 → Next.js 전환 및 홈페이지 성능 개선"
  exp: EXP-05
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [next-sec]
  note: E5-03 · variant-of E5-01
- line: "한국미스미 | 글로벌 B2B 커머스 Next.js 전환 및 SSR·CSR 렌더링 전략 분리"
  exp: EXP-05
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [kakaopay]
  note: E5-04
- line: "한국미스미 | 글로벌 B2B 커머스 홈페이지 Next.js 전환 및 성능 개선"
  exp: EXP-05
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [next-sec]
  note: E5-05 · variant-of E5-04
- line: "한국미스미 글로벌 B2B 커머스 개선 및 Next.js 전환"
  exp: EXP-05
  roles: [ax, ai-product]
  section: 헤드라인
  status: candidate
  sources: [ax]
  note: E5-06 · variant-of E5-04
- line: "PHP·jQuery 레거시 분석, Next.js·React 전환, 렌더링 전략·성능·다국어·모니터링 구조 개선"
  exp: EXP-05
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [kakaopay, next-sec]
  note: E5-07
- line: "PHP·jQuery 기반 글로벌 쇼핑몰을 Next.js·React·TypeScript 구조로 단계적으로 전환했습니다."
  exp: EXP-05
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E5-08 · 핵심 성과
- line: "페이지 접근 시간을 8초에서 2초로 단축했고, Next.js 전환 후 기존 PHP 서비스 대비 평균 로딩 속도를 개선했습니다."
  exp: EXP-05
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E5-09 · 핵심 성과
- line: "SSR·CSR 렌더링 전략 분리, Lazy Loading, 비동기 API, 리소스 최적화를 함께 적용해 성능·SEO·다국어·모니터링 체계를 개선했습니다."
  exp: EXP-05
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E5-10 · 핵심 성과
- line: "PHP·jQuery 기반 글로벌 B2B 커머스를 Next.js·React·TypeScript 구조로 단계적으로 전환하고, 페이지 특성별로 SSR·CSR 렌더링 전략을 분리했습니다 (SSR·CSR 렌더링 대응)."
  exp: EXP-05
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E5-11 · 핵심 성과 · variant-of E5-08
- line: "Lighthouse 병목 분석 후 Lazy Loading·비동기 API·리소스 최적화를 적용해 페이지 접근 시간을 8초에서 2초로 단축했고, Next.js 전환 후 기존 PHP 서비스 대비 평균 로딩 속도를 개선했습니다."
  exp: EXP-05
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E5-12 · 핵심 성과 · variant-of E5-09
- line: "글로벌 B2B 커머스에서 PHP·jQuery 기반 레거시 쇼핑몰을 Next.js·React·TypeScript 구조로 단계적으로 전환했습니다."
  exp: EXP-05
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E5-13 · 핵심 성과 · variant-of E5-08
- line: "페이지 특성별 SSR·CSR 렌더링 전략을 분리하고 Lazy Loading·비동기 API·리소스 최적화를 적용해 페이지 접근 시간을 8초에서 2초로 단축했습니다."
  exp: EXP-05
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E5-14 · 핵심 성과 · variant-of E5-09
- line: "상품 비교·멀티 다운로드 등 복잡한 B2C 구매 플로우 기능을 공통 컴포넌트·Custom Hook으로 구조화했습니다 (홈페이지 개편·성능 최적화)."
  exp: EXP-05
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E5-15 · 핵심 성과
- line: "페이지 특성에 맞춰 SSR·CSR 렌더링 전략을 분리하고, Next.js 전환으로 페이지 접근 시간을 8초에서 2초로 줄였습니다."
  exp: EXP-05
  roles: [fe, fintech]
  section: 요약
  status: candidate
  sources: [kakaopay]
  note: E5-16
- line: "PHP·jQuery 기반 글로벌 B2B 커머스 쇼핑몰은 화면 결합도가 높아 기능 확장과 유지보수가 어려웠습니다. 단일 렌더링 구조로 초기 페이지 접근 시간이 길고 SEO 최적화에 한계가 있었으며, 다국어 환경과 국가별 배포 요건을 지원하면서 단계적으로 현대화해야 했습니다."
  exp: EXP-05
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E5-17 · 문제 문단
- line: "PHP·jQuery 기반 글로벌 B2B 커머스 쇼핑몰은 화면 결합도가 높아 상품·주문 기능 확장과 유지보수가 어려웠습니다. 단일 렌더링 구조로 인해 초기 페이지 접근 시간이 8초에 달했고 검색 노출(SEO) 최적화에 한계가 있었습니다. 다국어 환경과 국가별 배포 요건을 지원하면서 B2C 구매 플로우를 포함한 서비스를 단계적으로 현대화해야 했습니다."
  exp: EXP-05
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E5-18 · 문제 문단 · variant-of E5-17
- line: "PHP/jQuery 레거시 환경에서 유지보수성·페이지 성능·SEO·다국어·오류 추적이 필요했다."
  exp: EXP-05
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E5-19 · 문제 문단 · variant-of E5-17
- line: "PHP·jQuery 레거시를 Next.js·React·TypeScript 컴포넌트 구조로 단계적 전환"
  exp: EXP-05
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay, next-sec]
  note: E5-20 · kakaopay "(레거시 점진 전환)", next "(홈페이지 개편·레거시 점진 전환)" 태그 · 제출본(doosan·dooray) 동일 변형이 approved 항목 note에 존재
- line: "PHP/jQuery 기반 B2B 쇼핑몰을 React·Next.js·TypeScript로 전환 (레거시 점진 전환)"
  exp: EXP-05
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E5-21 · variant-of E5-20
- line: "상품 비교·멀티 다운로드 등 복잡한 기능을 공통 컴포넌트·Custom Hook으로 구조화"
  exp: EXP-05
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E5-23 · next는 "상품 비교·멀티 다운로드 등 복잡한 B2C 구매 플로우 기능을 공통 컴포넌트·Custom Hook으로 구조화" · 제출본(dooray-career) 동일 변형이 approved 항목 note에 존재
- line: "Lighthouse 병목 분석 후 Lazy Loading·비동기 API·폰트·리소스 최적화 적용"
  exp: EXP-05
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay, next-sec]
  note: E5-24 · next만 "(성능 최적화)" 태그
- line: "Lazy Loading·비동기 API·폰트 최적화 적용"
  exp: EXP-05
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E5-25 · variant-of E5-24
- line: "Lighthouse·GA·Adobe Analytics·Datadog 기반 성능·SEO·오류 추적 운영"
  exp: EXP-05
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E5-29 · variant-of E5-27(승인 항목에 흡수됨)
- line: "Next.js 전환 후 기존 PHP 서비스 대비 평균 로딩 속도 개선"
  exp: EXP-05
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay, next-sec]
  note: E5-31 · 성과 · ax는 "Next.js 전환 후 기존 PHP 서비스 대비 평균 로딩 속도 약 50% 개선" — "약 50%" 수치는 ax에만 존재, 귀속 검토 필요
- line: "화면 개발에서 아키텍처·성능·다국어·배포 자동화·모니터링까지 책임 범위 확장"
  exp: EXP-05
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E5-32 · 성과 · 제출본(dooray-career) ·연결 동일 변형이 approved 항목 note에 존재
- line: "상품·주문·비교·멀티 다운로드 핵심 B2C 플로우 신규 구현 완료"
  exp: EXP-05
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E5-33 · 성과
- line: "PHP·jQuery 기반 글로벌 B2B 커머스를 React·Next.js·TypeScript 구조로 단계적 전환 (레거시 점진 전환)"
  exp: EXP-05
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay, next-sec]
  note: E5-34 · 경력 불릿
- line: "SSR·CSR 렌더링 전략 분리 및 Lazy Loading·비동기 API·리소스 최적화로 페이지 접근 시간 8초 → 2초 단축"
  exp: EXP-05
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E5-35 · 경력 불릿
- line: "페이지 특성별 SSR·CSR 렌더링 전략 분리, Lazy Loading·비동기 API·리소스 최적화로 페이지 접근 8초 → 2초 (SSR·CSR 대응)"
  exp: EXP-05
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: E5-36 · 경력 불릿 · variant-of E5-35
- line: "SSR·CSR 렌더링 전략 분리 및 Lazy Loading·비동기 API·리소스 최적화로 페이지 접근 시간 8초 → 2초 (성능 최적화)"
  exp: EXP-05
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E5-37 · 경력 불릿 · variant-of E5-35
- line: "Next.js 기반 SSR·CSR 렌더링 전략 분리, Lighthouse 병목 분석·최적화"
  exp: EXP-05
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay, next-sec]
  note: E5-40 · 기술 섹션 불릿 · kakaopay "(SSR·CSR)", next "(Next.js)" 태그, coupang 태그 없음
```

### EXP-06 · 2025 대웅제약 성과 평가 기반 사업 기여

해당 문장 없음 — 제출본 4개와 미제출 초안 4개 어디에도 EXP-06 전용 프로즈가
추출되지 않았다 (만족도 4.18/4.06/4.05는 EXP-01 PoC 지표로 분류. ax의
"계획 대비 2주 빠르게 고도화" 구절은 EXP-01 문맥 안이라 EXP-01로 귀속).

### EXP-07 · 비즈36.5 Node.js(Express) BFF 신규 구축 및 AI 챗봇 Python 로직 기여

```yaml
# --- approved (제출본) ---
- line: "React 화면에 맞춘 Node.js BFF 구축"
  exp: EXP-07
  roles: [fullstack]
  section: 헤드라인
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 핵심 성과 소제목
- line: "React 화면이 여러 API를 따로 부르지 않도록, 백엔드 응답을 모아 화면 기준으로 돌려주는 BFF를 Node.js(Express)로 만들었습니다. 프론트와 백엔드를 하나의 TypeScript 코드로 맞추고, REST API와 필터링·정렬·역할별 조회 로직을 설계했습니다."
  exp: EXP-07
  roles: [fullstack]
  section: 요약
  status: approved
  sources: [doosan]
  approved: 2026-07-23
- line: "비즈36.5에서 여러 백엔드 응답을 프론트 요구에 맞게 집계·프록시하는 BFF를 Node.js(Express)로 신규 구축 (프론트–백엔드 TypeScript 스택 통일)"
  exp: EXP-07
  roles: [fullstack]
  section: 경력기술
  status: approved
  sources: [doosan]
  approved: 2026-07-23
- line: "신규 기능의 React 프론트 전용 데이터 집계·프록시(BFF) REST API를 Node.js(Express)로 신규 구축 (Spring Boot 대체가 아닌 신규 개발 / 프론트–백엔드 TypeScript 스택 통일)"
  exp: EXP-07
  roles: [fullstack]
  section: 경력기술
  status: approved
  sources: [doosan]
  approved: 2026-07-23
- line: "Node.js(Express)로 여러 백엔드 응답을 집계·프록시하는 React 프론트 전용 BFF 신규 구축"
  exp: EXP-07
  roles: [fullstack]
  section: 경력기술
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 기술 섹션 불릿 (원문에서 다음 불릿과 붙어 있음)
- line: "Python 기반 AI 챗봇의 프롬프트·응답 후처리 로직 일부 수정·기여"
  exp: EXP-07
  roles: [fullstack]
  section: 경력기술
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 경력 불릿(포맷 결함으로 다음 불릿과 붙어 있음). 기술 섹션 변형은 "Python 기반 AI 챗봇의 프롬프트·응답 후처리 로직 일부 기여"
- line: "Python 기반 AI 챗봇의 프롬프트 구성·응답 후처리(Markdown·표·링크 변환 등) 로직 일부를 직접 수정·기여"
  exp: EXP-07
  roles: [fullstack]
  section: 경력기술
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 위 항목 변형 (경력기술서 상세형; 포맷 결함으로 다음 불릿과 붙어 있음)
```

```yaml
# --- candidate (미제출 초안) ---
- line: "Python·SQL 기반 데이터 가공 및 대용량 데이터 처리 (Python·SQL 데이터 분석·가공)"
  exp: EXP-07
  roles: [ax, ai-product]
  section: 헤드라인
  status: candidate
  sources: [ax]
  note: E7-01
- line: "데이터 집계 API 및 AI 챗봇 서버 로직 개선 (Python·SQL·Node)"
  exp: EXP-07
  roles: [ax, ai-product]
  section: 헤드라인
  status: candidate
  sources: [ax]
  note: E7-02
- line: "비즈36.5에서 여러 백엔드 응답을 React 프론트 요구에 맞게 집계·프록시하는 BFF REST API를 Node.js(Express)로 신규 구축"
  exp: EXP-07
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay]
  note: E7-03 · 기술 섹션 불릿 · coupang만 "(Node.js 웹 프레임워크)" 태그
- line: "비즈36.5에서 여러 백엔드 응답을 React 프론트 요구에 맞게 집계·프록시하는 신규 BFF REST API를 Node.js(Express)로 구축"
  exp: EXP-07
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: E7-04 · 기술 섹션 불릿 · variant-of E7-03
- line: "비동기 I/O 이점과 프론트·백엔드 TypeScript 스택 통일을 고려해 BFF 런타임으로 Node.js 선택"
  exp: EXP-07
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: E7-05 · 기술 섹션 불릿
- line: "비동기 I/O와 프론트–백엔드 TypeScript 스택 통일을 이유로 Node 채택"
  exp: EXP-07
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E7-06 · variant-of E7-05
- line: "AI 챗봇 서버의 Python 프롬프트 구성·응답 후처리(Markdown·표·링크 변환) 로직을 수정·개선하고, React 전용 데이터 집계·프록시(BFF) API를 Node.js로 신규 구축했다. 대용량 테이블·시계열 화면의 렌더링 시간을 2.5초 → 1초대로 개선했다."
  exp: EXP-07
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E7-07 · 핵심 성과 · 마지막 문장(2.5초→1초대)은 EXP-04 지표와 혼합 — 승인 검토 필요
- line: "신규 기능에서 React 프론트가 여러 백엔드 데이터를 집계·가공해 받아야 했고, AI 챗봇 응답의 프롬프트 구성·후처리 품질을 개선해야 했다."
  exp: EXP-07
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E7-08 · 문제 문단
- line: "React 전용 데이터 집계·프록시(BFF) REST API를 Node.js(Express)로 신규 구축 (Python·SQL 데이터 가공)"
  exp: EXP-07
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E7-09 · variant-of E7-03
- line: "AI 챗봇(Python) 서버의 프롬프트 구성·응답 후처리(Markdown·표·링크 변환) 로직을 수정·개선"
  exp: EXP-07
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E7-10
- line: "React 프론트의 다중 백엔드 데이터 연동을 단일 BFF 계층으로 단순화"
  exp: EXP-07
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E7-11 · 성과
- line: "AI 챗봇 응답 포맷·프롬프트 품질 개선"
  exp: EXP-07
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E7-12 · 성과
- line: "AI 챗봇 서버의 Python 프롬프트·응답 후처리 로직 수정·개선"
  exp: EXP-07
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E7-13 · 기술 섹션 불릿 · variant-of E7-10
- line: "React 전용 데이터 집계·프록시(BFF) API를 Node.js로 신규 구축해 다중 백엔드 데이터 연동을 단일 계층으로 정리"
  exp: EXP-07
  roles: [ax, ai-product]
  section: 경력기술
  status: candidate
  sources: [ax]
  note: E7-14 · 기술 섹션 불릿 · variant-of E7-03
```

### SUMMARY · 문서 전체 프로필·다중 경험 프로즈

```yaml
# --- approved (제출본) ---
- line: "API·BFF부터 React UI·배포 자동화까지 구현하는 Fullstack Developer"
  exp: SUMMARY
  roles: [fullstack]
  section: 헤드라인
  status: approved
  sources: [doosan]
  approved: 2026-07-23
- line: "React·Vue 서비스 개발과 AI 기반 프론트엔드 생산성 개선을 연결하는 Frontend Engineer"
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
- line: "서비스 프론트엔드 안정 운영, 디자인시스템·공통 컴포넌트, 성능 품질 개선, AI 기능 도입을 함께 다루는 Frontend Engineer"
  exp: SUMMARY
  roles: [fe]
  section: 헤드라인
  status: approved
  sources: [nhn]
  approved: 2026-07-23
- line: "프론트엔드에서 풀스택으로 확장한 Product Engineer"
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [millie]
  approved: 2026-07-23
- line: "Next.js 웹부터 하이브리드 앱까지 제품을 End-to-End로 출시하는 Frontend Engineer"
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: (millie-career)
- line: "React·TypeScript로 화면을 만들면서, 그 화면에 필요한 데이터가 어떤 REST API와 서버 로직, Query를 거쳐 내려오는지까지 함께 개발해 온 풀스택 개발자입니다. Web/Admin 화면과 서버 기능을 같이 다루고, 여러 백엔드 응답을 React 화면에 맞게 모아 돌려주는 Node.js(Express) BFF를 만들어 왔습니다."
  exp: SUMMARY
  roles: [fullstack]
  section: 요약
  status: approved
  sources: [doosan]
  approved: 2026-07-23
- line: "Spring Boot·MySQL로 데이터 모델과 서버 로직을 짜고 REST API를 설계해 Web/Admin 화면까지 개발했습니다. 외주로 돌아가던 검진 예약 서비스를 9주 만에 108개 페이지·82개 화면 규모의 임직원 건강 플랫폼으로 옮겨, 외주 없이 내부에서 개발·운영할 수 있게 바꿨습니다."
  exp: SUMMARY
  roles: [fullstack]
  section: 요약
  status: approved
  sources: [doosan]
  approved: 2026-07-23
- line: "AI 챗봇에서는 SSE로 내려오는 LLM 응답의 중지·재시도·오류 상태를 화면과 맞추고, Markdown·표·링크를 React 컴포넌트로 바꾸는 렌더링을 붙였습니다. Playwright E2E와 Jenkins·GitLab CI/CD로 반복 QA와 배포 전 점검을 자동화했습니다. 두산로보틱스 AI/SW 본부에서 React UI부터 Node.js BFF·REST API, 배포 자동화까지 다뤄 온 경험으로 내부 도구와 API를 만드는 데 힘을 보태고 싶습니다."
  exp: SUMMARY
  roles: [fullstack]
  section: 요약
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 말미 문장은 회사 타겟팅 문장 — 재사용 시 재작성 필요 (두산로보틱스)
- line: "React·Vue·TypeScript를 중심으로 서비스 프론트엔드 개발, AI 서비스 UI, 공통 컴포넌트 구조, 테스트 자동화, 개발 생산성 개선을 함께 다뤄 온 Frontend 중심 Product Engineer입니다."
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
- line: "AI 챗봇, 데이터 대시보드, B2B 플랫폼, 모바일 앱에서 화면 구현을 넘어 API 응답 구조, 상태 흐름, 오류 처리, Markdown 렌더링, 공통 컴포넌트·테마 구조, 배포 전후 검증까지 함께 설계했습니다."
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
- line: "생성형 AI와 AI Coding Agent를 단순히 사용하는 데 그치지 않고, 프로젝트 맥락, 컴포넌트 규칙, 금지 패턴, 보안 위험, 테스트·완료 조건을 구조화해 AI 생성 코드가 서비스 코드에 안정적으로 반영될 수 있는 프론트엔드 개발 흐름을 구축했습니다."
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
- line: "React·Vue·TypeScript를 중심으로 서비스 프론트엔드 개발·운영, 공통 컴포넌트·디자인시스템 구조, 성능·코드 품질 개선, AI 기능 실서비스 도입을 함께 다뤄 온 Frontend 중심 Product Engineer입니다."
  exp: SUMMARY
  roles: [fe]
  section: 요약
  status: approved
  sources: [nhn]
  approved: 2026-07-23
- line: "B2B 플랫폼, AI 헬스케어 서비스, 대용량 데이터 대시보드, 글로벌 커머스에서 화면 구현을 넘어 고객사별 권한·메뉴·기능 노출 정책, API 응답 구조, 상태 흐름, 레거시 점진 전환, 배포 자동화, 빌드·검증 파이프라인까지 함께 설계하고 운영했습니다. Config-Driven UI와 Base-Theme 기반 공통 컴포넌트 구조, Storybook 중심 컴포넌트 검증, Playwright 기반 테스트 자동화, Jenkins·GitLab CI/CD 파이프라인을 구축해 여러 고객사·서비스가 안정적으로 운영될 수 있는 프론트엔드 개발 흐름을 만들어 왔습니다."
  exp: SUMMARY
  roles: [fe]
  section: 요약
  status: approved
  sources: [nhn]
  approved: 2026-07-23
- line: "기획·디자인·백엔드·AI 개발·운영 조직과 API 응답 정책, 배포 프로세스, 오류 대응 기준을 함께 조율하며, 직급보다 논리를 우선하는 수평적 커뮤니케이션으로 협업해 왔습니다."
  exp: SUMMARY
  roles: [fe]
  section: 요약
  status: approved
  sources: [nhn]
  approved: 2026-07-23
- line: "B2B 서비스를 안정적으로 운영하고 SSE 기반 실시간 LLM 응답·Markdown 렌더링·오류 가드레일을 실서비스에 도입해 온 경험을 바탕으로, 여러 사용자가 함께 쓰는 협업 서비스의 프론트엔드 품질과 운영 안정성에 기여하고자 합니다."
  exp: SUMMARY
  roles: [fe]
  section: 요약
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 회사 타겟팅 문장 — 재사용 시 재작성 필요 (NHN두레이)
- line: "React·Next.js·TypeScript를 중심으로 AI 서비스 제품화, 실시간 응답 UI, 하이브리드 앱(WebView), 렌더링 성능을 하나의 제품 구조로 연결해 온 Frontend 중심 Product Engineer입니다. 특정 스택에 머무르지 않고 생성형 AI와 AI Coding Agent를 활용해 개발 생산성과 제품 완성도를 함께 끌어올려 왔습니다."
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [millie]
  approved: 2026-07-23
- line: "AI 챗봇, 데이터 대시보드, B2B 플랫폼, 모바일·WebView 앱에서 화면 구현을 넘어 API 응답 구조, 상태 흐름, 오류 처리, 공통 컴포넌트·테마 구조, 배포 전후 검증까지 함께 설계했습니다."
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: cj-enm 두 번째 요약 문단의 변형
- line: "React·TypeScript UI 개발을 출발점으로 Vue 3, React Native, Spring Boot·MySQL·REST API, Web/Admin/WebView, CI/CD까지 확장하며 운영 가능한 서비스 구조를 만들어 왔습니다."
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [millie]
  approved: 2026-07-23
- line: "React·Next.js·TypeScript를 중심으로 웹 서비스 고도화, 하이브리드 앱(WebView), AI 서비스 UI, 레거시 현대화, 테스트 자동화, 개발 생산성 개선을 함께 다뤄 온 Frontend Engineer입니다."
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: (millie-career)
- line: "글로벌 B2B 커머스를 PHP·jQuery에서 Next.js·React 구조로 전환하고, AI 챗봇·데이터 대시보드·WebView 앱에서 렌더링 최적화, 복잡한 상태 관리, 성능 지표 개선까지 End-to-End로 담당했습니다. PO·디자이너·AI·백엔드 개발자 사이에서 기술 제약과 비즈니스 요구사항을 조율하며 제품을 출시했습니다."
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: (millie-career)
- line: "생성형 AI와 AI Coding Agent를 단순히 사용하는 데 그치지 않고, 프로젝트 맥락·컴포넌트 규칙·금지 패턴·보안 위험·테스트 조건을 구조화한 FE AX SOP로 팀의 개발 워크플로우에 내재화해 생산성의 한계를 끌어올렸습니다."
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [millie]
  approved: 2026-07-23
  note: (millie-career)
- line: "React·Vue·TypeScript 기반 서비스 프론트엔드 개발"
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 헤드라인
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
  note: 핵심 성과 소제목 (dooray는 "React·Vue·TypeScript 기반 서비스 프론트엔드 개발·운영", dooray는 "성능 최적화 및 코드 품질 개선" 소제목도 별도 존재)
- line: "React·Next.js·Vue 3·TypeScript 기반 SPA 웹 서비스와 React Native 모바일 앱을 개발하며 화면 구현, 상태 관리, API 응답 처리, 오류 대응, 실시간 데이터 렌더링, 서비스 운영 안정성 확보까지 수행했습니다. B2B 플랫폼, AI 헬스케어 챗봇, 대용량 데이터 대시보드, 글로벌 커머스까지 다양한 도메인의 서비스 프론트엔드를 직접 개발·운영했습니다."
  exp: SUMMARY
  roles: [fe]
  section: 요약
  status: approved
  sources: [nhn]
  approved: 2026-07-23
- line: "PHP·jQuery 레거시를 Next.js·React·TypeScript로 전환하며 페이지 접근 시간을 8초에서 2초로 단축했습니다. 대용량 데이터 대시보드에서 Lazy Rendering과 비동기 선조회 구조를 적용해 렌더링 시간을 2.5초에서 1초대로 개선했습니다. AI 챗봇에서 코드 스플리팅·HTTP/2 전환·React Query 캐싱으로 초기 진입 시간을 30초에서 6초로 단축하고 Lighthouse 91점을 확보했습니다."
  exp: SUMMARY
  roles: [fe]
  section: 요약
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: EXP-05/04/01에 걸친 다중 경험 프로즈
- line: "Spring Boot·MySQL·REST API 기반 기능과 React·TypeScript 프론트엔드를 함께 개발하며 AI 서비스 제품화와 B2B 플랫폼 내재화를 진행했고, 개발·검증·배포 흐름을 개선했습니다. Config-Driven UI·Base-Theme로 공통 컴포넌트 구조를 설계했고, LLM 챗봇에 SSE 스트리밍·Markdown 렌더링·오류 가드레일을 적용했습니다. 고객사별 CI·메뉴·기능 노출 정책을 공통 구조로 정리해 운영 대응 시간을 줄였습니다."
  exp: SUMMARY
  roles: [fullstack]
  section: 요약
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 대웅제약 경력 소개 문단
- line: "React·TypeScript 기반 프론트엔드 아키텍처를 중심으로 AI 서비스 제품화, B2B 플랫폼 내재화, 프론트엔드 개발·검증 프로세스 개선을 수행했습니다. LLM 챗봇의 SSE Streaming, Markdown Renderer, 오류 가드레일, Config-Driven UI, Base-Theme 구조를 설계하고, 생성형 AI와 AI Coding Agent를 활용한 개발 생산성 개선 체계를 구축했습니다."
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [cj-enm]
  approved: 2026-07-23
  note: 대웅제약 경력 소개 문단. millie 변형은 "…AI 서비스 제품화와 B2B 플랫폼 내재화를 수행했습니다. … 개발 생산성 개선 체계(FE AX SOP)를 구축했습니다."
- line: "React·TypeScript 기반 프론트엔드 아키텍처를 중심으로 AI 서비스 제품화, B2B 플랫폼 내재화, 프론트엔드 개발·검증·운영 프로세스 개선을 수행했습니다. Config-Driven UI·Base-Theme 기반 공통 컴포넌트 구조를 설계하고, LLM 챗봇의 SSE Streaming·Markdown Renderer·오류 가드레일을 실서비스에 도입했습니다. 고객사별 CI·메뉴·기능 노출 정책을 공통 구조로 정리해 운영 대응 속도를 높였습니다."
  exp: SUMMARY
  roles: [fe]
  section: 요약
  status: approved
  sources: [nhn]
  approved: 2026-07-23
  note: 위 문단 변형
- line: "B2B 쇼핑몰, React Native 앱, 생산관리 대시보드 등 웹·모바일 프로젝트에서 프론트엔드 개발을 수행했습니다. 레거시 유지보수성, 성능 저하, 모바일 사용성, 데이터 시각화 문제를 React·Next.js·Vue·React Native로 개선했습니다."
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 요약
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
  note: 내담씨앤씨 경력 소개 문단. dooray는 "대용량 데이터 시각화 문제"; doosan은 "…프론트엔드 개발과 Spring REST API 연동을 수행했습니다. 레거시 유지보수성, 성능 저하, 모바일 사용성, 대용량 데이터 시각화 관련 문제를 React·Next.js·Vue·React Native로 개선했습니다."; millie는 말미에 "(주요 프로젝트: 삼성물산 데이터·모바일, 한국미스미 글로벌 B2B 커머스 — 상세는 경력기술서)" 추가
- line: "React·Vue 3 기반 SPA 서비스 개발 및 운영"
  exp: SUMMARY
  roles: [fe, fullstack]
  section: 경력기술
  status: approved
  sources: [doosan, nhn]
  approved: 2026-07-23
  note: 기술 섹션 불릿. cj-enm은 "React·Vue 3 기반 SPA / 대시보드 화면 개발"; millie·millie-career는 "React·Vue 3 기반 SPA / 대시보드 화면 개발과 복잡한 상태 관리"
- line: "컴포넌트 구조 설계 및 공통 UI 재사용 구조 구축"
  exp: SUMMARY
  roles: [fe, fullstack, ai-product]
  section: 경력기술
  status: approved
  sources: [doosan, cj-enm, nhn, millie]
  approved: 2026-07-23
  note: 기술 섹션 불릿
- line: "반응형 웹 및 Mobile Web/App 화면 개발"
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, nhn, millie]
  approved: 2026-07-23
  note: 기술 섹션 불릿
- line: "서버 상태와 클라이언트 상태 분리, API 응답 캐싱·비동기 데이터 흐름 관리"
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, nhn]
  approved: 2026-07-23
  note: 기술 섹션 불릿
- line: "초기 진입 시간·네트워크 병목 개선, SSR·CSR 리소스 최적화"
  exp: SUMMARY
  roles: [fe, ai-product]
  section: 경력기술
  status: approved
  sources: [cj-enm, millie]
  approved: 2026-07-23
  note: 기술 섹션 불릿
- line: "TypeScript 중심의 프론트엔드·API 연동 개발"
  exp: SUMMARY
  roles: [fullstack]
  section: 경력기술
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 기술 섹션 불릿
- line: "Java 기반 Spring Boot 서버 로직·REST API 구현"
  exp: SUMMARY
  roles: [fullstack]
  section: 경력기술
  status: approved
  sources: [doosan]
  approved: 2026-07-23
  note: 기술 섹션 불릿
```

```yaml
# --- candidate (미제출 초안) ---
- line: "PC·모바일 웹 아키텍처를 설계하고 성능·생산성을 끌어올리는 Frontend Engineer"
  exp: SUMMARY
  roles: [fe, commerce]
  section: 헤드라인
  status: candidate
  sources: [coupang]
  note: S-01
- line: "웹뷰 기반 실시간 서비스를 설계하고 팀 개발 기준을 세우는 Frontend Engineer"
  exp: SUMMARY
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [kakaopay]
  note: S-02 · variant-of S-01
- line: "복잡한 운영 데이터 관리 시스템과 웹 성능을 직접 설계하는 프론트엔드 개발자"
  exp: SUMMARY
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [next-sec]
  note: S-03 · variant-of S-01
- line: "현업과 가설을 정의하고, AI를 활용해 프로토타입을 배포·운영하며 그 경험을 재사용 표준으로 정리하는 6년차 Product Engineer"
  exp: SUMMARY
  roles: [ax, ai-product]
  section: 헤드라인
  status: candidate
  sources: [ax]
  note: S-04 · variant-of S-01 · 직함이 "Product Engineer"로 유일하게 다름
- line: "React·Next.js·Vue 3를 기반으로 PC·모바일 웹 플랫폼 아키텍처를 설계하고, 성능과 생산성을 측정 가능한 수치로 개선해 온 프론트엔드 개발자입니다."
  exp: SUMMARY
  roles: [fe, commerce]
  section: 요약
  status: candidate
  sources: [coupang]
  note: S-05
- line: "React·Next.js·TypeScript·TanStack Query를 기반으로 웹뷰 환경의 실시간 서비스를 설계하고, 성능과 개발 생산성을 측정 가능한 수치로 개선해 온 프론트엔드 개발자입니다."
  exp: SUMMARY
  roles: [fe, fintech]
  section: 요약
  status: candidate
  sources: [kakaopay]
  note: S-06 · variant-of S-05
- line: "React·TypeScript·Next.js 기반으로 대용량 데이터 대시보드·관리자 도구·운영 시스템을 설계하고, 웹 성능을 측정 가능한 수치로 개선해 온 6년차 프론트엔드 개발자입니다."
  exp: SUMMARY
  roles: [fe, fintech]
  section: 요약
  status: candidate
  sources: [next-sec]
  note: S-07 · variant-of S-05 · 연차 표기("6년차")는 next·ax에만 등장, coupang·kakaopay 인적사항은 "총 5년 9개월"
- line: "글로벌 B2B 커머스에서 PHP·jQuery 레거시를 Next.js로 전환하며 페이지 접근 시간을 8초에서 2초로 줄였고, 컴포넌트·Custom Hook·Config-Driven UI로 반복 개발 공수를 90분에서 15분으로 단축했습니다."
  exp: SUMMARY
  roles: [fe, commerce]
  section: 요약
  status: candidate
  sources: [coupang]
  note: S-08 · EXP-05+EXP-03 지표 혼합 문장
- line: "아키텍처를 설계할 때는 고객사별 테마·기능 노출 차이를 Config와 Base-Theme로 분리하고, 공통 컴포넌트와 렌더링 계층을 분리해 팀 엔지니어들이 같은 기준으로 컴포넌트·화면을 만들도록 가이드했습니다."
  exp: SUMMARY
  roles: [fe, commerce]
  section: 요약
  status: candidate
  sources: [coupang]
  note: S-09 · EXP-01+EXP-03 혼합
- line: "기획·AI·백엔드·운영 조직과 API 응답 정책·렌더링 전략·일정을 직접 조율해 왔고, 한국미스미 글로벌 B2B 커머스 경험으로 E-commerce 도메인에도 실무 기반이 있습니다."
  exp: SUMMARY
  roles: [fe, commerce]
  section: 요약
  status: candidate
  sources: [coupang]
  note: S-10
- line: "수많은 주문이 실시간으로 오가는 배달 O2O 플랫폼에서는 웹의 응답 속도·안정성·확장성이 곧 고객 경험이 되며, 이는 제가 글로벌 커머스와 AI 서비스 제품화에서 성능·아키텍처로 풀어 온 문제와 맞닿아 있습니다."
  exp: SUMMARY
  roles: [fe, commerce]
  section: 요약
  status: candidate
  sources: [coupang]
  note: S-11 · 회사 타겟팅 문장 — 재사용 시 재작성 필요 (쿠팡이츠)
- line: "개발 세미나·FE AX SOP로 팀 엔지니어들이 같은 기준으로 아키텍처를 만들도록 가이드해 온 경험을 살려, 쿠팡이츠 웹 제품의 품질과 개발 생산성을 함께 끌어올리는 일을 하고 싶어 지원했습니다."
  exp: SUMMARY
  roles: [fe, commerce]
  section: 요약
  status: candidate
  sources: [coupang]
  note: S-12 · 회사 타겟팅 문장 — 재사용 시 재작성 필요 (쿠팡이츠)
- line: "Cursor·Claude 등 LLM 기반 AI 도구를 실무에 적용하고 팀 도입 기준을 문서로 정립한 경험이 있으며, 기획·AI·백엔드·운영 조직과 API 응답 정책·렌더링 전략·일정을 직접 조율해 왔습니다."
  exp: SUMMARY
  roles: [fe, fintech]
  section: 요약
  status: candidate
  sources: [kakaopay]
  note: S-13
- line: "글로벌 B2B 커머스에서는 PHP·jQuery 레거시를 Next.js·React·TypeScript로 전환하며 페이지 접근 시간을 8초에서 2초로 단축했고, B2B 임직원 건강 플랫폼에서는 MySQL 데이터 모델·Spring Boot·REST API·Web·Admin 화면을 End-to-End로 개발해 운영팀이 직접 사용하는 관리자 도구를 구축했습니다."
  exp: SUMMARY
  roles: [fe, fintech]
  section: 요약
  status: candidate
  sources: [next-sec]
  note: S-14 · EXP-05+EXP-02 혼합
- line: "기획·AI·백엔드·운영 조직과 API 응답 정책을 직접 조율하며 WBS·ETA 기반으로 다중 우선순위 업무를 주도적으로 진행해 왔고, 운영팀 피드백을 기반으로 기능 개선과 유지보수를 반복해 온 경험이 있습니다."
  exp: SUMMARY
  roles: [fe, fintech]
  section: 요약
  status: candidate
  sources: [next-sec]
  note: S-15
- line: "복잡한 운영 데이터와 권한별 조회 구조를 직접 다뤄 온 이 경험이 원장·환전·이체 같은 금융 운영 데이터를 다루는 백오피스의 데이터 관리·워크플로우 처리 요건에 직결된다고 생각합니다."
  exp: SUMMARY
  roles: [fe, fintech]
  section: 요약
  status: candidate
  sources: [next-sec]
  note: S-16 · 회사 타겟팅 문장 — 재사용 시 재작성 필요 (넥스트증권)
- line: "프론트엔드에서 풀스택으로 확장하며, AI 서비스의 프로토타입을 실사용 가능한 제품으로 배포·운영하고 그 과정을 팀이 반복 사용할 수 있는 표준으로 정리해 왔다."
  exp: SUMMARY
  roles: [ax, ai-product]
  section: 요약
  status: candidate
  sources: [ax]
  note: S-17
- line: "AI 개발자·백엔드·기획과 문제를 정의하고 판정 기준을 세워 검증하는 방식으로 일하며, 비개발 직군이 직접 과제를 확인·검증할 수 있도록 테스트·운영 확인 절차를 자동화했다."
  exp: SUMMARY
  roles: [ax, ai-product]
  section: 요약
  status: candidate
  sources: [ax]
  note: S-18
- line: "Codex·Claude Code로 개발하고 생성 코드의 검증·금지 패턴·보안 기준을 팀 표준으로 세웠으며, Python·SQL 기반 데이터 가공과 AWS·Jenkins 기반 배포·운영까지 수행했다."
  exp: SUMMARY
  roles: [ax, ai-product]
  section: 요약
  status: candidate
  sources: [ax]
  note: S-19 · EXP-03+EXP-07 혼합, 도구명 충돌(E3-29 참고)
- line: "현업과 가설을 정의하고 프로토타입을 실사용 기준으로 배포·운영하며 그 경험을 재사용 표준으로 남기는 AX본부의 일하는 방식이 지금까지 해온 일과 맞닿아 있다."
  exp: SUMMARY
  roles: [ax, ai-product]
  section: 요약
  status: candidate
  sources: [ax]
  note: S-20 · 회사 타겟팅 문장 — 재사용 시 재작성 필요 (AX본부)
- line: "크로스팀 협업 리드 및 서비스 확장 구조 구축"
  exp: SUMMARY
  roles: [fe, commerce]
  section: 헤드라인
  status: candidate
  sources: [coupang]
  note: S-21
- line: "크로스팀 협업 및 서비스 고도화 주도"
  exp: SUMMARY
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [kakaopay]
  note: S-22 · variant-of S-21
- line: "주도적 커뮤니케이션 및 운영팀 피드백 기반 개선"
  exp: SUMMARY
  roles: [fe, fintech]
  section: 헤드라인
  status: candidate
  sources: [next-sec]
  note: S-23 · variant-of S-21
- line: "여러 서비스의 기능 개발과 고객사별 배포 요청, API 정책 조율을 WBS·ETA로 우선순위를 나눠 동시에 진행했고, 고객사별 CI·메뉴·기능 노출 변경을 1주 내 대응 가능한 운영 구조를 구축했습니다."
  exp: SUMMARY
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay]
  note: S-24 · 핵심 성과 · 후반부는 EXP-02 성과와 중복
- line: "WBS·ETA 기반으로 기능 개발·고객사별 배포 요청·API 정책 조율을 동시에 진행했고, 운영팀 피드백을 기능 개선 과제로 전환하며 반복 QA 시간을 3시간에서 1시간으로 단축해 운영팀이 개발팀에 매번 요청하지 않고도 지표를 직접 확인하고 이슈를 제보할 수 있는 루틴을 만들었습니다."
  exp: SUMMARY
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: S-25 · 핵심 성과 · variant-of S-24
- line: "React·TypeScript 기반 프론트엔드 아키텍처를 설계하고 AI 서비스 제품화와 B2B 플랫폼 내재화를 주도했습니다."
  exp: SUMMARY
  roles: [fe, commerce, fintech]
  section: 경력기술
  status: candidate
  sources: [coupang, kakaopay, next-sec]
  note: S-26 · 경력 소개
- line: "Config-Driven UI·Base-Theme로 공통 컴포넌트 구조를 설계했고, Playwright·Storybook·CI/CD 기반 품질·생산성 자동화와 FE AX SOP 문서화로 팀 개발 기준을 정착시켰습니다."
  exp: SUMMARY
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: S-27 · 경력 소개 · EXP-01+EXP-03 혼합
- line: "SSE 기반 실시간 응답 처리와 웹뷰 운영, Playwright·Jest·Storybook 기반 테스트 자동화, LLM 도구 실무 적용과 FE AX SOP 문서화로 팀 개발 기준을 정착시켰습니다."
  exp: SUMMARY
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: S-28 · 경력 소개 · variant-of S-27
- line: "Web·Admin 관리자 도구를 End-to-End로 개발하고, 운영팀 피드백 기반으로 기능 개선과 유지보수를 반복했습니다."
  exp: SUMMARY
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: S-29 · 경력 소개 · variant-of S-27 · 내용상 EXP-02 비중이 큼
- line: "2020년 10월 합류해 SI 웹 프로젝트 전반에서 프론트엔드 개발·유지보수 경험을 쌓았고, 이후 글로벌 B2B 커머스·데이터 플랫폼·모바일 앱 프로젝트에서 프론트엔드 아키텍처 개선과 성능 최적화를 맡았습니다."
  exp: SUMMARY
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: S-30 · 경력 소개
- line: "글로벌 B2B 커머스·데이터 플랫폼·모바일 앱 프로젝트에서 프론트엔드 아키텍처 개선과 성능 최적화를 수행했습니다."
  exp: SUMMARY
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [kakaopay]
  note: S-31 · 경력 소개 · variant-of S-30
- line: "데이터 플랫폼 대시보드·관리자 시스템·글로벌 커머스에서 웹 프론트엔드 아키텍처 개선과 성능 최적화를 수행했습니다."
  exp: SUMMARY
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: S-32 · 경력 소개 · variant-of S-30
- line: "PHP·jQuery 레거시를 React·Next.js·TypeScript 구조로 단계적으로 전환하고, Vue 3·React Native를 활용해 PC 웹과 모바일 서비스를 함께 개발했습니다."
  exp: SUMMARY
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: S-33 · 경력 소개 · kakaopay는 "...Vue 3·React Native로 PC 웹과 모바일 서비스를 함께 개발했습니다" (근사 변형)
- line: "React·Vue 3 기반 PC·모바일 웹 SPA 서비스 설계·개발·운영 (웹 아키텍처)"
  exp: SUMMARY
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: S-34 · 기술 섹션 불릿
- line: "React·TypeScript 기반 웹 SPA 서비스 설계·개발·운영, TanStack Query로 서버 상태 관리 (React·TypeScript·TanStack Query)"
  exp: SUMMARY
  roles: [fe, fintech]
  section: 경력기술
  status: candidate
  sources: [next-sec]
  note: S-35 · 기술 섹션 불릿 · variant-of S-34
- line: "복잡한 기능을 공통 컴포넌트·Custom Hook으로 구조화해 재사용성 확보 (계층 분리)"
  exp: SUMMARY
  roles: [fe, commerce]
  section: 경력기술
  status: candidate
  sources: [coupang]
  note: S-36 · 기술 섹션 불릿
```

---

## 배치 승인 대기 메모

미제출 초안 4개(coupang·kakaopay·next-sec·ax) 추출 시 발견된, 배치 승인 전
확인이 필요한 귀속·수치 충돌 목록 (추출 보고서 원문 그대로):

1. Jenkins 배포 리드타임 10분→2분: coupang/kakaopay/next는 EXP-03 성과, ax는 EXP-02(B2B 플랫폼) 성과로 귀속 (E2-13, E2-39, E3-56).
2. AI 도구 명칭: kakaopay는 "Cursor·Claude", ax는 "Codex·Claude Code" (E3-29, E3-48).
3. "평균 로딩 속도 약 50% 개선": ax에만 수치가 붙음, 나머지는 수치 없음 (E5-31).
4. 네트워크 비용 1,200KB→900KB: kakaopay에만 존재 (E3-25).
5. "계획 대비 2주 빠르게 고도화": ax에만 존재 (E1-20).
6. 연차 표기: next·ax "6년차" vs coupang/kakaopay 인적사항 "총 5년 9개월" (S-07).
7. E2E 개발 방향 표현: coupang "화면부터 데이터 모델까지" vs kakaopay/next "데이터 모델부터 화면까지" (E2-35/36).
8. ax의 E7-07 마지막 문장(렌더링 2.5초→1초대)은 EXP-04 지표가 BFF 프로젝트 성과 단락에 섞여 있음.
