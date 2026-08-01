# recruit-flow M3 계획 — 챗봇 사령탑

2026-08-01 architect 산출. 상위: blueprint(결정 5·9·9b) + specs/{ui,nodes,
schema,engine}.md. **M1·M2 완료 전제**(스모크 73/73, live 완전이관, 커밋·푸시).

**완료 기준**: 채팅 입력창으로 (a) 챗봇에게 블록 생성 지시→트레이 입고→
사람 드래그 승인, (b) 문서 등록 대화, (c) "작성해줘"→실행, (d) 갭 인터뷰
인라인 답변·Human 승인을 **한 스레드**에서 수행. 결정 5(챗봇=add만) 불변.

## 핵심 구조

- **챗봇 권한 = tool 집합으로 물리적 강제**(결정 5): 배선/삭제/노드수정
  tool을 **존재 자체를 만들지 않는다**. 챗봇이 호출할 방법이 없음.
- **파이프라인 스코프 SSE 신설**: 현 eventBus는 runId 스코프 → 챗봇
  응답·트레이 카드는 활성 run 없어도 흘러야 함. `pipelineSubscribers`
  추가. run SSE(캔버스/아티팩트)와 **분리 공존**, card_run/human은
  pipeline 채널로 **미러** → ChatDock이 단일 pipeline SSE 구독.
- **스키마 마이그레이션 불필요**: chat_messages(user/assistant/card_block
  kind·payload JSON), block_defs.tray 컬럼 모두 존재.

## 챗봇 tool 카탈로그 (권한 = tool 집합)

읽기: `list_block_defs` · `get_graph`(이름·타입·배선 요약만, config 전문
제외) · `list_documents` · `get_document`(기존 재사용).
쓰기: `add_block`(**항상 tray=true** — createBlockDef, origin=chatbot,
card_block 발행) · `register_document`(name 일치 시 addDocumentVersion(llm),
없으면 createDocument) · `trigger_run`(runner.start, 검증 실패 시 errors를
tool 결과로 반환→챗봇이 자연어 설명).
**금지(미제공)**: add_edge/wire/delete_node/update_node/move_node/delete_edge.

챗봇 진입점 `runChat()`(sdk.ts): 다회전 query(maxTurns=12), tool 7종
MCP 서버(pipelineId·runId 클로저), onDelta 스트리밍. 모델=DEFAULT(sonnet).
대화 히스토리는 매 호출 시 chat_messages(user/assistant) 시간순 로드해
user prompt에 합성(파이프라인당 1 영속 스레드).

## 채택한 스펙 공백 결정 (A~H, 전부 추천안)

- **A** SSE: run SSE(캔버스)·pipeline SSE(채팅) **분리 공존**, card_* 미러.
- **B** 스트리밍 저장: **완료 시 assistant 1건만 확정**, chat_delta는 통지
  전용(진행 중 델타 유실 허용). 스키마·헬퍼 추가 0.
- **C** chat 라우트: **POST 즉시 200(fire-and-forget)**, 델타는 pipeline
  SSE로. run 이벤트와 자연 병합.
- **D** 챗봇 즉시 DB 범위: add_block=즉시 DB지만 **tray=true(미승인)**,
  register_document·trigger_run=즉시(결정 9b 사령탑 역할).
- **E** trigger 후 클라 구독: **card_run(started)의 runId를 store가 읽어
  initRun**→useRunStream 기동(POST는 fire-and-forget이라 응답에 runId 없음).
- **F** register_document: name 일치 갱신 / 없으면 신규(+챗봇 인자 명시 보조).
- **G** get_graph: **요약만**(config 전문 제외).
- **H** card_block payload: `{blockDefId, type, name, description}`.

## SSE 이벤트 추가 (types.ts, engine.md 반영)

```
ChatDeltaEvent   { type:'chat_delta'; messageId; chunk }
ChatMessageEvent { type:'chat_message'; message: ChatMessage }  // 확정된 user/assistant/card_block
// 기존 ChatCardEvent(card_run/card_human) 재사용 — pipeline 채널 미러
SseEvent += ChatDeltaEvent | ChatMessageEvent
```

## 작업 분해

**P0(메인)**: types.ts에 ChatDelta/ChatMessage 이벤트·SseEvent 확장. 계약 공지.

**E(engine-builder)**: E1 eventBus pipeline 채널(subscribePipeline·
emitChatDelta·emitChatMessage + emitChatCard pipeline 미러) → E2 sdk.ts
`runChat()`(tool 7종 MCP·다회전·onDelta) → E3 챗봇 tool 핸들러(add_block
tray=true·register_document·trigger_run·get_graph·list_*) + **결정 5 회귀
스모크(쓰기 tool이 add/register/trigger 외로 안 늘었는지)** → E4
trigger_run→runner.start·검증 errors 반환.

**A(api-db-builder)**: A1 `setBlockDefTray` 헬퍼 → A2 `POST /api/pipelines/
[id]/chat`(user 저장→runChat→assistant 확정) → A3 `GET /api/pipelines/[id]/
events` pipeline SSE → A4 block-defs `POST`·`PATCH {tray,enabled}`·`DELETE`.

**U(ui-builder)**: U1 ChatDock 입력창 활성+전송 → U2 ChatDock **pipeline
SSE 구독**(run SSE 대신)·chat_delta 누적·user/assistant 카드 → U3 Palette
**새 블록 트레이 구획**(tray 필터·배지·드래그 승인 tray:false·더블클릭·X
거절) → U4 card_block 카드+트레이 점프 → U5 HumanCard gap_question 인라인
답변→answer / waiting 편집+승인.

병렬: P0 후 E1·E2 확정 → A2·A3·U1·U2. E3·E4 ∥ A4·U3.

## 완료 검증 (qa-verifier, live · ★Node 22)

S1 블록 add→트레이→드래그 승인(tray:false 확인) / S2 문서 등록(author=llm)
/ S3 "작성해줘"→trigger_run→run(챗봇 응답과 한 스트림)→완주 / S3' 검증
실패 시 챗봇 자연어 설명·run 미시작 / S4 갭 인터뷰 인라인 답변→재개 /
S5 Human 승인 / **S6 결정 5 경계: "연결해줘"/"지워줘" → 챗봇 거절·그래프
불변**(음성 테스트) / S7 새로고침 스레드·트레이 복원.
게이트: code-reviewer(결정 5 위반·쓰기 tool 증식 여부) → qa-verifier →
엔진 스모크 73/73 무회귀.

## M3 완료 기록 (2026-08-01)

전 단계(E·A·U) 구현 + 리뷰 승인 + live QA 통과. **완료 기준 충족**:
- **S6 결정 5 경계(핵심)**: 챗봇이 "연결해줘"·"지워줘"를 정중 거절, 그래프
  불변(edges 0 유지). 배선/삭제 tool 물리적 부재 확인.
- S1 블록 add→트레이(tray=true·origin=chatbot·card_block) + PATCH 승인.
- S2 문서 등록(author=llm v1). S3 "작성해줘"→trigger_run→card_run·
  chat_delta·chat_message가 **단일 pipeline SSE 스트림**, run succeeded.
- S7 스레드 영속(17건 시간순 복원). S4/S5는 엔진 스모크 커버.
- 검증: build·typecheck 초록, 엔진 스모크 73/73 + 챗봇 스모크 38/38.

### 리뷰 확인 요망 (비블로킹, 후속)
1. ~~`createBlockDef` upsert: 챗봇 add_block이 기존 승인 블록 config를
   덮어씀~~ → **해결(2026-08-01)**: `createBlockDef`에 `upsert` 옵션 추가
   (임포터 기본 true=idempotent, 챗봇 add_block은 `upsert:false`=항상 새
   트레이 항목). 기존 승인 블록 불변.
2. 트레이 승인 PATCH/DELETE가 pipeline SSE로 미러 안 됨 → 크로스 탭
   반영은 새로고침 필요(단일 세션 전제라 범위 밖).
3. 그래프 PUT에서 동일 node ID 재사용 시 curl 직접 호출 경계에서 500
   (UI는 정상). M1부터 관찰된 saveGraph PK 재사용 취약 — v2 후속.
