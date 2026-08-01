# recruit-flow M2 구현 계획

2026-07-24 architect 산출. 상위: [recruit-flow-blueprint.md](../recruit-flow-blueprint.md)
+ specs/{ui,nodes,schema,engine,m1-plan}.md. M1 완료 전제.

**완료 기준: my-recruit 하네스(작성→비평→점수게이트 루프→렌더)를 캔버스에서
재조립해 실제 이력서 HTML 출력 = 완전 이관.**

## 핵심 전제

- **DB 스키마 마이그레이션 불필요**: M1에서 10테이블 전부 생성됨.
  status/type가 free text라 값·타입만 확장. block_defs·chat_messages는
  쓰기만 시작.
- 경계 파일 = `types.ts`(메인 승인 선행) → 엔진∥UI 병렬.

## 이관 소스 (실재: `C:\workspaces2\my-recruit`)

- `.claude/agents/` 16종. 이관 핵심: **writer**(opus, 초안, markdown),
  **recruiter-screen**·**tech-screen**(sonnet/opus, 채점, **json**),
  reviewer(비평), tailor/ats(선택). designer는 Output 노드로 대체(이관
  안 함). portfolio 5종·headhunter 3종은 v2/라이브러리 저장만.
- `docs/resume-reference/`: profile.md, experience-bank.md(49KB),
  canonical-lines.md(188KB), positioning.md, screen-profiles.md,
  target-companies.md(JD 소스) 등. **파일 통째 → 1 document(v1,
  author=human)**, 분해 안 함.
- `DESIGN.md`: 이력서 스타일. M2 Output 템플릿에 **토큰(색·타입·룰)만
  이식**, `.page` 고정박스는 v2.

### 이관 대상 파이프라인

```
Input(JD) + Input(증거) → writer(md) → [recruiter-screen ∥ tech-screen](json)
  → Gate(recruiter-screen.total>=80 && tech-screen.total>=80) → Output(html)
                    └ fail → writer 재실행(직전 채점 JSON 자동 포함)
```

Gate는 초안+두 score JSON을 모두 받아 pass 시 전체 통과, Output은 초안
markdown만 취함(nodes.md Q13).

## 임포터 (§2)

**1회성 시드 스크립트** `scripts/import-my-recruit.ts`(Node 22, `--source`
인자, idempotent name+type upsert). 앱 내 임포트 UI는 M3.

매핑:
- `.claude/agents/*.md` → block_defs(type=agent). 본문→config.role,
  model→config.model, **outputFormat은 에이전트별 하드코딩 매핑**(writer/
  reviewer/tailor/ats=markdown, recruiter-screen/tech-screen=json).
  두 게이트는 `jsonSchema` 주입: `{total:number, verdict:"PASS"|"FAIL",
  passBar:number, blockers:string[]}` + role 말미 "JSON 출력" append(§8-F).
- 파일 경로 지시(Read outputs/ 등)는 **원문 유지 + get_document tool 장착
  + "파일시스템 없음, 입력 섹션/tool 사용" 헤더 1줄 프리펜드**(§8-C).
- `docs/resume-reference/*.md` → documents + document_versions(v1, human).
- 규칙 문서(feedback-rules 등) → block_defs(type=rule) 선택.
- get_document/search_documents tool = 앱 상수(팔레트), DB 아님.
- 장착선은 임포터가 못 만듦(프런트매터에 없음) → 사람이 캔버스에서 배선.

## types.ts 확장 (§3.1, 경계)

| 대상 | M2 |
| --- | --- |
| NodeType | +gate/human/skill/rule/tool |
| RunStatus | +waiting_human/gate_failed |
| NodeRunStatus | +waiting_human |
| EdgeRow.kind | 'flow'\|'mount' |
| EdgeRow.sourceHandle | null\|'pass'\|'fail' |
| config 유니온 | +Gate/Human/Skill/Rule/Tool Config |
| AgentConfig | +gapMode:'ask'\|'annotate' |
| SseEvent | +ChatCardEvent(chat_card) |

```
GateConfig  { expr; maxLoops; failTargetNodeId? }
HumanConfig { instruction; allowEdit; primaryInputNodeId? }
SkillConfig { content }   RuleConfig { content }
ToolConfig  { toolName:'get_document'|'search_documents' }
ChatCardEvent { type:'chat_card'; message: ChatMessage }
ChatMessage { id; pipelineId; kind:'card_run'|'card_human'; payload; runId?; nodeRunId? }
ValidationError.code += gate_json_upstream | mount_wiring | gate_missing_fail
```

실사용 시작: block_defs(origin=import), chat_messages(card_run/human),
runs.upstreamRunId, node_runs.iteration(회차), artifacts.meta.editedBy.
**getActiveRun = running ∪ waiting_human**(동시 run 1개). recoverOnBoot는
waiting_human 복원 유지, running만 failed.

## 엔진 변경점 (§4)

- **병렬 스케줄러**(MAX_CONCURRENCY=2): shift 순차 → 동시 실행 풀.
  scheduler.ts 순수함수 재사용, 소비만 병렬화. **(nodeId,iteration) 키**로
  재방문 허용(Gate 루프).
- **Gate**: 아티팩트 안 만듦(순수 라우터). 자체 재귀하강 expr 파서(비교
  6종·`&& || !`·`.length`·`출처.필드`·PASS/FAIL 문자, eval 아님 §8-A).
  fail→failTargetNodeId(기본 writer)부터 iteration+1 재큐잉 + 직전 채점
  JSON 자동 포함. maxLoops 초과→run gate_failed + card_run.
- **waiting_human**: Human 노드가 run/node_run을 waiting_human으로 멈춤 +
  card_human. approve(편집본 옵션·author=human)→succeeded·러너 재개.
  control 없으면 DB에서 재하이드레이션(§8-E). ask_human(Agent 내부)은
  재시작 시 failed 마감+부분재실행 유도.
- **부분 재실행**: from_node 상류 전이 폐포만 복사(succeeded), 현재
  그래프로 스냅샷, 하류만 큐잉(§8-B).
- **chat_card** eventBus 발행 + events 라우트 relay.
- **agent-node**: Tool 장착(get_document/search_documents)·ask_human.

## UI 변경점 (§5)

노드 5종(gate 마름모·pass/fail 2핸들, human 주황점멸)+pill 3종(상/하 핸들)
+점선 mount 엣지+배선 제약 / SidePanel 폼 5종 / Palette 저장정의(block_defs
fetch)·enabled 토글·팝오버 / run 히스토리 드롭다운·읽기전용 스냅샷 모드 /
부분 재실행 우클릭 / 아티팩트 회차 칩·Human 편집+승인 / **채팅 독 이벤트
스트림**(card_run·card_human, 입력창 비활성=M3, 노드↔카드 점프).

## 작업 분해 (M2a/b/c)

- **P1**(메인): types.ts 확장 확정.
- **P2**(api-db-builder): queries 확장(block_defs CRUD·chat 쓰기·
  getActiveRun 확장·상류 복사 헬퍼).
- **M2a 엔진**(engine-builder 단독): A1 병렬 스케줄러 → A2 Gate 루프 →
  A3 waiting_human/approve → A4 부분재실행 → A5 chat_card → A6 tool 장착.
- **M2b UI**(ui-builder, A1~A5와 병렬 가능하나 빌드 인프라 공유로 순차):
  B1 노드/pill/점선 → B2 폼 → B3 팔레트 정의 → B4 히스토리/스냅샷 →
  B5 부분재실행 → B6 채팅 독.
- **M2c**: C1 임포터(api-db) · C2 DESIGN 템플릿(ui) · C3 완전이관 QA.
- 통합 → code-reviewer → qa-verifier(§7 시나리오).

## 완료 검증 (§7)

시드 실행 → JD 문서 등록 → 그래프 조립 → 실행(recruiter∥tech 동시) →
Gate 첫 fail→writer 재실행(회차 칩·직전 JSON 포함·게이트 실패 카드) →
pass→Output → DESIGN 스타일 자기완결형 HTML 다운로드. maxLoops 초과→
gate_failed 실증.

## 스펙 공백 해소 (§8, 전부 추천안 채택)

A. Gate 평가기 = 자체 재귀하강 파서(의존성 0). B. 부분재실행 = 상류 전이
폐포 복사. C. Agent 경로지시 = 원문+get_document+헤더 프리펜드. D. Output
= DESIGN 토큰 흐름 템플릿(.page 고정박스는 v2). E. approve = DB
재하이드레이션, ask_human 재시작은 failed+부분재실행. F. 두 게이트 에이전트에
표준 채점 JSON 스키마 주입.

## M2 완료 기록 (2026-07-31)

전 단계 구현 + live 완전이관 실증 완료. **완료 기준 충족**: 임포트된
config로 canonical 파이프라인(writer+get_document → recruiter-screen ∥
tech-screen → Gate → Output)이 실제 LLM으로 완주해 **DESIGN 스타일
이력서 HTML 산출**(navy #1f3d55·keep-all·@media print·자기완결형) 실측.
채점자 2종 모두 clean JSON 출력, Gate 실제 판정, gate_failed 무한루프
없음. 엔진 스모크 73/73, build 초록.

### live QA가 잡아 수정한 결함 (스텁 스모크로 회귀 고정)
1. **채점 JSON 오염** — 임포트 채점자 role의 markdown 점수표 지시가 강해
   말미 JSON 지시를 무시 → 파싱 실패. 수정: `runAgentJson`이 JSON 지시를
   system+user 말미 양쪽 배치(recency). live에서 clean JSON 확인.
2. **tool-less maxTurns 과소** — 복잡한 생성 에이전트(writer)가 1턴에
   최종 텍스트를 못 내 `error_max_turns`. 수정: tool 미장착 maxTurns 1→4.
3. **Gate pass/fail 라우팅 미구분** — `pickReady`가 상류 Gate의
   succeeded만 보고 pass/fail 결정을 무시 → gate_failed인데도 pass-엣지
   하류(Output) 실행. 수정: `gateDecision` 기록 + `upstreamSatisfiesEdge`가
   엣지 sourceHandle과 Gate 결정 일치 시에만 충족. 스모크 [c]/[c2] 추가.
4. **mount 노드 유령 node_run** — tool/skill/rule이 root로 큐잉돼
   queued 잔존. 수정: mount 타입은 node_run 미생성.

### 남은 우려(문서화, v2/후속)
- `gateDecision` 재하이드레이션은 "succeeded Gate 최대 회차=pass" 휴리스틱
  (현 상태머신에서 안전; 엄밀히는 DB 저장이 이상적 — schema 변경 필요).
- Gate+Human 조합 재하이드레이션은 스모크 미직접커버(로직상 안전).
- DESIGN Output에서 ###(15.5pt)이 ##(14.5pt)보다 큰 시각 역전(흐름 템플릿
  제약, 후속 다듬기).
