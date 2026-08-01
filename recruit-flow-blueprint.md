# recruit-flow 블루프린트

2026-07-24 grill-me 인터뷰(12문항)로 합의된 설계. 새 프로젝트
`C:\workspaces\recruit-flow`(독립 git 저장소)의 씨앗 문서.

**상세 스펙** (2026-07-24 2차 grill-me, Q2~Q17로 구체화):

- [specs/ui.md](specs/ui.md) — 레이아웃·캔버스 시각 언어·팔레트
  트리·사이드 패널·채팅 독·실행 제어 (+ [specs/ui-mockup.html](specs/ui-mockup.html) 정적 목업)
- [specs/nodes.md](specs/nodes.md) — 8종 노드의 속성·입출력 계약·실행
  시맨틱
- [specs/schema.md](specs/schema.md) — SQLite/Drizzle 테이블 정의
- [specs/engine.md](specs/engine.md) — 러너·API 라우트·SSE 이벤트

## 한 줄 정의

기존 my-recruit 하네스 엔지니어링을 **레고처럼 조립 가능한 파이프라인
UI**로 끌어올린 실사용 도구. Input: JD + 파이프라인 조립 → Output: 이력서
HTML. LLM 챗봇은 블록을 만들어 주고, 조립은 사람이 한다.

## 결정 요약

| # | 결정 | 내용 |
| --- | --- | --- |
| 1 | 목적 | **실사용 도구** (포트폴리오는 부산물). 핵심 가치는 "UI로 파이프라인을 쉽게 조립" |
| 2 | 실행 백엔드 | **Claude Agent SDK (TypeScript)**. 구독 인증 재사용. 노드 단위 SDK 호출로 상태 표시·부분 재실행 가능 |
| 3 | 에이전트 정의 위치 | `.claude/agents` 밖으로 완전 이관 — 앱 DB가 소유, 실행 시 `query()` `agents` 옵션으로 주입 |
| 4 | 노드 2계층 | **실행 계층**(Agent/Input/Output/Gate/Human, 실선 엣지=데이터 흐름) + **장착 계층**(Skill/Rule/Tool, 점선 엣지=Agent에 장착). 병렬은 노드가 아니라 엣지 규칙(분기=병렬, 합류=join). Rule 노드 1개를 여러 Agent에 공유 장착 가능 |
| 5 | 챗봇 권한 | **add만**. 챗봇이 만든 블록은 팔레트의 "새 블록 트레이"에 담기고, 사람이 드래그·배선하는 순간이 승인. 그래프 배선·삭제·수정은 사람 전용 |
| 6 | 데이터 흐름 | 노드 실행 1회 = 아티팩트 1개(DB 행, `run_id`+`node_id`+내용). 형태는 마크다운(산문) 또는 구조화 JSON(점수·PASS/FAIL — 채점 에이전트는 JSON 스키마 강제). Gate 조건식은 LLM 없이 코드로 평가. 노드 클릭 → 사이드 패널에서 아티팩트 열람·스트리밍·(Human 노드) 직접 편집 |
| 7 | 저장소 | **전부 DB (SQLite + Drizzle)**. 증거 베이스 포함 완전 이관, my-recruit은 읽기 전용 아카이브. `document_versions` 버전 테이블 필수(변경 전문·시각·주체 사람/LLM). 에이전트는 `get_document(id)`/`search_documents` tool로 접근, 프롬프트에 doc id 포인터 |
| 8 | 스택 | 로컬 웹앱. **Next.js(App Router) + React Flow(@xyflow/react) + SQLite/Drizzle + Zustand + SSE**. 러너는 Next 서버 프로세스 내 인메모리 큐 + 백그라운드 루프, run 상태는 DB에 기록(새로고침 복원). 워커 분리는 v2 |
| 9 | 상호작용 | **채팅 독 단일화**: 블록 제작 대화 + Human 노드 카드(승인/갭 인터뷰/게이트 실패 보고)가 한 채팅 스트림에. 캔버스 Human 노드는 점멸로 대기 표시, 클릭 시 해당 카드로 스크롤. 아티팩트 전문은 채팅이 아닌 사이드 패널 |
| 9b | 실행 모델 | 채팅 = 사령탑(JD·문서 등록, 블록 add, "작성해줘" = 실행 트리거). **run 시작 시 그래프 스냅샷** — 실행 중 편집은 다음 run에 반영. 인터랙티브 vs 파이어-앤-포겟은 그래프에 Human 노드를 넣었는지가 결정. 갭 인터뷰는 Agent 노드 속성: "갭 발견 시 멈추고 묻기 / `[확인 필요]` 표시하고 계속" |
| 10 | 산출물 | **코드 템플릿 렌더링**(LLM 아님): 최종 마크다운 → 결정론적 변환 → HTML/CSS 템플릿(1~2종, DESIGN.md 스타일 이식). 자기완결형 HTML 1파일 다운로드. PDF는 사용자가 브라우저 인쇄로 변환 — 템플릿에 `@media print`·페이지 넘김 보장은 앱 책임. 서버 PDF(Playwright) 없음 |
| 11 | 마일스톤 | 아래 참조 |
| 12 | 위치·이름 | `C:\workspaces\recruit-flow`(현 폴더 — 블루프린트·specs가 이미 있음), 폴더 안에서 `git init`(워크스페이스 부모 저장소 `C:\workspaces`와 분리, 부모에는 untracked 중첩 폴더로 남음) |

## 마일스톤

**M1 — 돌아가는 뼈대.** Agent/Input/Output 3종 드래그·배선 → 실행 →
SDK 순차 실행 → 아티팩트 사이드 패널 스트리밍 → HTML 다운로드.
챗봇·Gate/Human·임포터 없음(JD·증거는 DB에 수동 입력). 목적: 가장 위험한
가정(SDK 실행 + 스트리밍 + 그래프 실행 엔진) 최우선 검증.

**M2 — 하네스 재현.** Gate/Human 노드, 병렬/join, run 스냅샷, 장착
계층(Skill/Rule/Tool), `.claude/agents` 16개 + 증거 베이스
(`experience-bank.md`, `profile.md`, `positioning.md`,
`canonical-lines.md` 등) 임포터. 완료 기준: 기존 파이프라인(작성→비평→
점수게이트 루프→렌더)을 캔버스에서 재조립해 실제 이력서 출력 = 완전 이관
성립.

**M3 — 챗봇 사령탑.** 채팅 독, 블록 add tool, JD/문서 등록 대화,
"작성해줘" 트리거, Human 카드. 챗봇이 마지막인 이유: 조작 대상(그래프
CRUD·실행 API)이 먼저 존재해야 함.

**v2 이후로 명시적 연기**: 런타임 중 동적 노드 삽입, LLM designer 노드,
서브 파이프라인(그룹) 노드, 템플릿 3종+, 별도 워커 프로세스, 포트폴리오
리뷰 하네스 이식.

## 이관 시 my-recruit에 남길 것

완전 이관 후 my-recruit `CLAUDE.md`에 "증거 베이스는 recruit-flow DB로
이관됨, 조회는 앱 CLI/sqlite3" 포인터만 남긴다. 이관 전까지는 기존
하네스가 정상 운영된다.
