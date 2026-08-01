# recruit-flow M1 구현 계획

2026-07-24 architect 산출. 상위: [recruit-flow-blueprint.md](../recruit-flow-blueprint.md)
+ specs/{ui,nodes,schema,engine}.md. M1 착수 팀의 작업 문서.

## M1 범위

Agent/Input/Output 3종 + 실선 엣지 → 순차 실행(SDK 동시 1) → SSE
스트리밍 → HTML 다운로드. 챗봇·Gate·Human·장착 pill·트레이·임포터 없음.
JD·증거는 문서 탭에서 수동 입력.

## 스펙 공백 해소 (2026-07-24 확정)

- **(a) SDK 인증**: Claude Code CLI **구독 자격 재사용**(결정 2 문언 +
  로컬 `~/.claude/.credentials.json` 확인). `lib/engine/sdk.ts`에
  auth·모델·스트림 캡슐화. 정확한 패키지명·`query()` 시그니처·구독 OAuth
  자동 픽업은 버전 의존 → engine-builder가 실호출 스모크로 검증(M1의
  "가장 위험한 가정"). ⚠ 실행 시 구독 쿼터 소비.
- **(b) HTML 템플릿**: DESIGN.md가 워크스페이스에 부재 → M1은 **자체
  미니멀 이력서 템플릿 1종**(`templateId: 'default'`, 자기완결형 인라인
  CSS, A4·`@media print`·페이지 넘김 — 결정 10). DESIGN.md 이식은 M2.
- **(c) 목업 이식**: 목업의 CSS/색/애니메이션/툴팁은 이식하되 인터랙션은
  React Flow + Zustand로 재구현. 상태 클래스(`.st-running` 등)를 React
  Flow 노드 className에 매핑.
- **(e) 조건부**: better-sqlite3가 Node 23에서 컴파일 실패 시 Node 22
  LTS 다운그레이드(스캐폴딩에서 판명, 실패 시에만 사람 결정).

## 폴더 구조 (App Router, src 디렉터리)

```
src/
├─ app/
│  ├─ layout.tsx            셸: 상단 바 + 탭 + 채팅 독(M1 숨김)
│  ├─ globals.css           목업 전역 CSS(토큰·keyframes·툴팁) 이식
│  ├─ page.tsx              → 마지막 파이프라인 redirect
│  ├─ pipelines/[id]/page.tsx   캔버스 탭
│  ├─ documents/page.tsx        문서 탭
│  └─ api/                   (§API 계약 표)
├─ lib/
│  ├─ types.ts              ★ 공유 API·SSE 계약 (경계 파일)
│  ├─ db/{schema,client,queries}.ts
│  ├─ validation.ts         run 검증(고아·사이클·Output 마크다운 1개)
│  ├─ engine/{runner,scheduler,sdk,input-node,agent-node,output-node,input-composer,events}.ts
│  └─ html/{render,template}.ts   마크다운→HTML 결정론 렌더
├─ components/{shell,canvas,panel,documents}/
├─ store/canvas.ts          Zustand
└─ hooks/useRunStream.ts    REST 초기 로드 + SSE 구독
data/recruit-flow.db (gitignore) · drizzle/ (커밋)
```

## 스캐폴딩 결정 (task #2)

- `create-next-app`: `--typescript --app --src-dir --eslint
  --no-tailwind --import-alias "@/*"`. 기존 파일(specs/·CLAUDE.md·
  .claude/) 보존 — 필요 시 임시 폴더 생성 후 이동.
- **스타일**: Tailwind 미채택. **globals.css(전역 토큰·`@keyframes`·
  `[data-tip]` 툴팁) + 컴포넌트 CSS Modules**. 목업 색을 CSS 변수로
  승격(`#4353ff` agent, `#2f9e6e` output, `#6b7a90` input).
- 런타임 의존성: `@xyflow/react zustand better-sqlite3 drizzle-orm
  @anthropic-ai/claude-agent-sdk nanoid marked`
- 개발 의존성: `drizzle-kit @types/better-sqlite3 @types/node`
- **better-sqlite3 검증**(최우선 리스크): 설치 후 인메모리 open 성공
  확인. 실패 시 §(e).
- `git init` — 독립 저장소(결정 12), .gitignore(data/, node_modules,
  .next).

## API 계약 (`lib/types.ts`) — 병렬 착수 전제

api-db-builder가 스키마 확정 직후 **가장 먼저** 작성 → 메인 승인 →
ui/engine 병렬. 경계 파일이므로 변경은 메인 조정.

### M1 라우트

| 메서드 · 경로 | 요청 | 응답 |
|---|---|---|
| `GET /api/pipelines` | — | `PipelineSummary[]` |
| `POST /api/pipelines` | `{name}` | `Pipeline` |
| `PATCH /api/pipelines/[id]` | `{name?}` | `Pipeline` |
| `GET /api/pipelines/[id]/graph` | — | `{nodes, edges}` |
| `PUT /api/pipelines/[id]/graph` | `{nodes, edges}` | `{ok}` |
| `POST /api/pipelines/[id]/runs` | `{}` | `RunStartResult` |
| `GET /api/runs/[id]` | — | `RunState` (복원용) |
| `POST /api/runs/[id]/cancel` | — | `{ok}` |
| `GET /api/runs/[id]/events` | — | SSE |
| `GET /api/artifacts/[id]/download` | — | HTML 파일 |
| `GET/POST /api/documents`, `GET/PUT /api/documents/[id]` | — | 문서·버전 |

### 공유 타입 초안

```
NodeType = 'agent' | 'input' | 'output'          // M1 3종
ArtifactFormat = 'markdown' | 'json' | 'html'
RunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled'
NodeRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped'

AgentConfig  { role; outputFormat: 'markdown'|'json'; model?; jsonSchema? }
InputConfig  { documentId?; inlineText? }
OutputConfig { templateId; filenameRule? }

NodeRow  { id; pipelineId; type; name; positionX; positionY; config }
EdgeRow  { id; pipelineId; sourceNodeId; targetNodeId; kind:'flow'; sourceHandle:null; inputOrder }
Artifact { id; nodeRunId; format; content; meta?:{version?} }
ValidationError { code:'orphan'|'cycle'|'output_markdown_count'; nodeId?; message }
RunStartResult  { runId } | { errors: ValidationError[] }
RunState        { run; nodeRuns; artifacts }
```

### SSE 이벤트 (M1 3종)

```
run_status     { runId, status, progress:{done,total} }
node_status    { nodeId, nodeRunId, iteration:1, status }
artifact_delta { nodeRunId, chunk }
```

원칙: SSE=통지, 진실=DB. 접속 시 `GET /api/runs/[id]` 로드 후 구독,
끊기면 REST 재조회.

## 작업 분해·의존

- **#2 스캐폴딩(chore-runner)**: 선행. 차단 리스크 better-sqlite3.
- **#3 스키마·CRUD(api-db-builder)**: #2 후. 산출 = schema.ts +
  **types.ts** + validation.ts + pipelines/graph/documents 라우트.
  block_defs·chat_messages는 테이블만.
- **#4 엔진(engine-builder)** ∥ **#5 UI(ui-builder)**: #3 후 병렬.
  경계 = types.ts. 동일 파일 미접촉. M1 제외: chat_card SSE,
  waiting_human/approve/answer, 병렬 한도>1, Gate 루프.
- **통합·리뷰·QA(#6)**: run 시작→스트리밍→다운로드 연결 →
  code-reviewer → qa-verifier(M1 시나리오).

## M1 완료 기준 (qa-verifier)

파이프라인 생성 → 문서 탭 JD·증거 입력 → Input 2 + Agent + Output
배선(드래그·더블클릭) → 실행 → 노드 상태색·사이드 패널 스트리밍 →
Output HTML 다운로드(자기완결형·인쇄 페이지 넘김) → 새로고침 상태 복원
→ 실행 중단.
