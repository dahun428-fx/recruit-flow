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
| `PUT /api/pipelines/[id]/graph` | nodes+edges 일괄 저장. 캔버스 편집은 debounce 자동 저장 |
| `POST /api/pipelines/[id]/runs` | 실행. body `from_node_id` 옵션 = 부분 재실행(직전 완료 run에서 상류 아티팩트 복사, `upstream_run_id` 기록) |
| `GET /api/runs/[id]` | run 상태 + node_runs + 아티팩트 목록(복원용) |
| `POST /api/runs/[id]/cancel` | 중단 |
| `POST /api/node-runs/[id]/approve` | Human 승인. body에 편집본 옵션. 채팅 카드/사이드 패널 공용(Q14) |
| `POST /api/node-runs/[id]/answer` | 갭 인터뷰 답변 — 대기 중인 `ask_human` tool 결과로 전달 |
| `GET /api/runs/[id]/events` | SSE 스트림 |
| `GET /api/artifacts/[id]/download` | Output HTML 다운로드 |
| documents / block_defs / chat CRUD | 통상적 REST (`/api/documents`, `/api/block-defs`, `/api/pipelines/[id]/messages`) |

## 3. SSE 이벤트

이벤트 4종. **SSE는 통지, 진실의 원천은 DB** — 클라이언트는 접속 시
REST(`GET /api/runs/[id]`)로 상태를 읽고 SSE 구독, 끊기면 재접속 시
REST 재조회.

| 이벤트 | payload | 소비처 |
| --- | --- | --- |
| `run_status` | run_id, status, 진행(완료/전체 노드 수) | 상단 바, run 보고 카드 |
| `node_status` | node_id, node_run_id, iteration, status | 캔버스 노드 색·점멸, 회차 칩 |
| `artifact_delta` | node_run_id, 텍스트 조각 | 사이드 패널 스트리밍 |
| `chat_card` | chat_message 행 | 채팅 독 카드 추가 |

아티팩트 스트리밍 저장: 조각은 메모리 버퍼에 모으고 주기적으로(예:
1초) artifacts.content에 flush, 완료 시 확정(schema.md).

## 4. 마일스톤 매핑

- **M1**: 러너(순차 실행이면 한도 1로 시작 가능), pipelines/graph/runs/
  events/download 라우트, `run_status`·`node_status`·`artifact_delta`.
- **M2**: 병렬(한도 2)·Gate 루프·waiting_human·approve/answer·부분
  재실행·`chat_card`.
- **M3**: chat 라우트 + 챗봇(블록 add tool, 실행 트리거).
