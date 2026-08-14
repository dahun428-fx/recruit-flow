# recruit-flow 실행 엔진 · API 스펙

2026-07-24 grill-me 세션(Q17)으로 확정. 상위 문서:
[recruit-flow-blueprint.md](../recruit-flow-blueprint.md) ·
[nodes.md](nodes.md) · [schema.md](schema.md).

## 1. 러너

Next 서버 프로세스 내 싱글턴, 인메모리 큐 + 이벤트 구동 루프(결정 8).
워커 분리는 v2.

### 스케줄링

1. run 시작: 그래프 검증(ui.md Q8) → `graph_snapshot` 생성 → 상류 없는
   노드들을 큐에 투입.
2. 노드 완료 시마다: AND-join(nodes.md Q15) 조건 — 모든 상류
   node_run 완료 — 을 새로 만족한 노드를 큐에 추가.
3. Gate fail: fail 대상 노드부터 하류를 iteration+1로 재큐잉. 직전
   회차 비평 JSON을 입력에 자동 포함(nodes.md Q13).
4. **SDK 동시 호출 한도 2** (설정 가능) — 분기=병렬을 실제 동시
   실행하되, 로컬 SQLite와 구독 rate limit을 고려한 상한.

### 상태 머신

- run: `running` ↔ `waiting_human` → `succeeded` / `failed` /
  `gate_failed` / `cancelled` (schema.md).
- node_run: `queued` → `running` → (`waiting_human` →) `succeeded` /
  `failed` / `skipped`.
- 중단(cancel): 현재 SDK 호출 abort → 실행 중 node_run들 `failed`,
  나머지 `skipped`, run `cancelled`. 아티팩트는 거기까지 보존.

### 프로세스 재시작 복구

기동 시 DB에서 `running` run 발견 → 실행 중이던 node_runs를 `failed`
마감, run을 `failed` 처리. 단 `waiting_human` run은 그대로 복원(대기
지속 — 결정 8). 자동 재개는 없음(v1) — 사람이 "이 노드부터 재실행"으로
이어간다.

## 2. API 라우트 (Next route handlers)

| 라우트 | 역할 |
| --- | --- |
| `GET/POST /api/pipelines` · `PATCH/DELETE /api/pipelines/[id]` | 파이프라인 CRUD |
| `PUT /api/pipelines/[id]/graph` | nodes+edges 일괄 저장. 캔버스 편집은 debounce 자동 저장. **구조 검증 후 저장**(아래) |
| `POST /api/pipelines/[id]/runs` | 실행. body `from_node_id` 옵션 = 부분 재실행(직전 완료 run에서 상류 아티팩트 복사, `upstream_run_id` 기록) |
| `GET /api/runs/[id]` | run 상태 + node_runs + 아티팩트 목록(복원용) |
| `POST /api/runs/[id]/cancel` | 중단 |
| `POST /api/node-runs/[id]/approve` | Human 승인. body에 편집본 옵션. 채팅 카드/사이드 패널 공용(Q14) |
| `POST /api/node-runs/[id]/answer` | 갭 인터뷰 답변 — 대기 중인 `ask_human` tool 결과로 전달 |
| `GET /api/runs/[id]/events` | run 스코프 SSE(캔버스·아티팩트) |
| `GET /api/artifacts/[id]/download` | Output HTML 다운로드 |
| documents / block_defs CRUD | 통상적 REST. block_defs: `POST /api/block-defs`, `PATCH /api/block-defs/[id]` `{tray?,enabled?}`(트레이 승인·큐레이션), `DELETE`(거절) — M3 |
| `POST /api/pipelines/[id]/chat` | **M3.** body `{text}`. user 메시지 저장 → 챗봇 `runChat` 기동 → 즉시 200. assistant 델타·확정은 pipeline SSE로(fire-and-forget) |
| `GET /api/pipelines/[id]/events` | **M3.** 파이프라인 스코프 SSE(채팅 독). run 유무 무관 상시 연결. `chat_delta`·`chat_message`·`chat_card`(run 미러) |
| `GET /api/pipelines/[id]/messages` | 채팅 히스토리 조회(새로고침 복원) |

### 그래프 PUT 구조 검증

`validateGraph`(run 시작 전 **의미** 검증 — 고아·위상·배선 제약)와 별개로,
쓰기 시점의 **구조** 검증을 라우트에서 수행한다. 위반은 전부 `400` +
한국어 사유이며, DB 제약 위반이 그대로 새어나가 `500`이 되면 안 된다.

| 규칙 | 사유 |
| --- | --- |
| 노드에 `id`·`type`·`name`·`positionX`·`positionY`·`config` 필수 | NOT NULL 제약 위반 → 500 방지 |
| 엣지에 `id`·`sourceNodeId`·`targetNodeId` 필수 | 〃 |
| 한 페이로드 내 node id 중복 금지 | UNIQUE 제약 위반 → 500 방지 |
| 한 페이로드 내 edge id 중복 금지 | 〃 |
| 엣지의 양 끝이 같은 페이로드의 노드를 가리켜야 함 | edges에 nodes FK가 없어 dangling edge가 조용히 저장됨. `validateGraph`는 런타임에 이를 무시하므로, 오류가 발생한 자리에서 드러내야 한다 |

UI는 항상 완전한 그래프를 전송하므로 영향받지 않는다. 이 검증은 API를
직접 호출하는 경로(스크립트·curl·임포터)를 위한 것이다.

## 3. SSE 이벤트

run 스코프 3종 + M3 채팅 3종 + 트레이 1종. **SSE는 통지, 진실의 원천은 DB** —
클라이언트는 접속 시 REST(`GET /api/runs/[id]`)로 상태를 읽고 SSE 구독,
끊기면 재접속 시 REST 재조회.

**구독 선행 규칙(필수)**: 스냅샷을 먼저 받고 그 뒤에 구독하면 두 동작
사이에 발행된 이벤트가 유실된다. 반드시 **구독을 먼저 열고**, 도착
이벤트를 버퍼에 쌓으면서 REST 스냅샷을 받은 뒤, `스냅샷 → 버퍼` 순으로
적용한다(메시지 id로 중복 제거). 재연결도 같은 순서를 따른다.

**재구독 조건**: run SSE는 run이 `running`인 동안만이 아니라
**`waiting_human`일 때도 구독을 유지**한다 — 승인은 다른 탭이나 채팅
독에서도 일어나며, 그때 재개 이벤트를 받아야 한다. 구독을 끊는 것은
종결 상태(`succeeded`/`failed`/`cancelled`)뿐이다.

| 이벤트 | payload | 소비처 |
| --- | --- | --- |
| `run_status` | run_id, status, 진행(완료/전체 노드 수) | 상단 바, run 보고 카드 |
| `node_status` | node_id, node_run_id, iteration, status | 캔버스 노드 색·점멸, 회차 칩 |
| `artifact_delta` | node_run_id, 텍스트 조각 | 사이드 패널 스트리밍 |
| `chat_card` | chat_message 행 (card_run/card_human) | 채팅 독 카드. run 스코프 + **pipeline 채널 미러**(M3) |
| `chat_delta` (M3) | messageId, 텍스트 조각 | 채팅 독 챗봇 응답 스트리밍(통지 전용 — DB엔 완료 시 1건만) |
| `chat_message` (M3) | 확정된 chat_message(user/assistant/card_block) | 채팅 독 메시지 확정 |
| `block_def` | `{ action: "updated" \| "deleted", blockDef? , blockDefId }` | 팔레트·트레이 갱신. block_defs는 **전역** 테이블이므로 열려 있는 **모든** pipeline 채널에 브로드캐스트 |

**M3 채널 구조**: run SSE(`/api/runs/[id]/events`)는 캔버스 노드 색·
아티팩트 스트리밍 전용(runId 스코프). pipeline SSE(`/api/pipelines/[id]/
events`)는 채팅 독 전용(pipelineId 스코프) — 챗봇 응답·카드가 활성 run
없이도 흐른다. card_run/card_human은 양쪽에 미러돼 ChatDock의 단일
pipeline 구독에 run 이벤트와 챗봇 응답이 한 스트림으로 도달(ui.md Q6).

**트레이 미러**: `POST /api/block-defs`·`PATCH /api/block-defs/[id]`
(트레이 승인·큐레이션)·`DELETE`(거절)는 `block_def` 이벤트를 발행한다.
block_defs에는 pipeline_id가 없으므로 특정 채널을 고를 수 없고, 전 채널
브로드캐스트가 유일하게 옳은 라우팅이다 — 어느 파이프라인 탭을 보고
있든 팔레트는 같은 트레이를 그린다.

**챗봇 스트리밍 저장**(M3): chat_delta는 통지 전용, 진실은 완료 시
확정되는 assistant chat_message 1건(진행 중 델타는 새로고침 시 유실
허용 — 채팅 응답은 짧아 중단 복원 불요).

아티팩트 스트리밍 저장: 조각은 메모리 버퍼에 모으고 주기적으로(예:
1초) artifacts.content에 flush, 완료 시 확정(schema.md).

## 4. 마일스톤 매핑

- **M1**: 러너(순차 실행이면 한도 1로 시작 가능), pipelines/graph/runs/
  events/download 라우트, `run_status`·`node_status`·`artifact_delta`.
- **M2**: 병렬(한도 2)·Gate 루프·waiting_human·approve/answer·부분
  재실행·`chat_card`.
- **M3**: 파이프라인 스코프 SSE(`/pipelines/[id]/events`) + chat 라우트
  (`POST /pipelines/[id]/chat`) + 챗봇 `runChat()`(add_block→트레이·
  register_document·trigger_run + 읽기 tool, **쓰기는 add-only 결정 5**) +
  block_defs POST/PATCH/DELETE(트레이 승인·거절) + 갭 인터뷰 인라인 답변.
  `chat_delta`·`chat_message`·`chat_card` pipeline 미러. 상세: m3-plan.md.
