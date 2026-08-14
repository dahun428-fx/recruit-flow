# recruit-flow DB 스키마

2026-07-24 grill-me 세션(Q16)으로 확정. SQLite + Drizzle(결정 8).
상위 문서: [recruit-flow-blueprint.md](../recruit-flow-blueprint.md) ·
[nodes.md](nodes.md). id는 전부 텍스트(nanoid), 시각은 unixepoch ms.

## 설계 원칙 (Q16)

1. **현재 그래프 = 정규화 행** (`nodes`/`edges`) — 팔레트·부분
   재실행·검증이 노드 단위 조회를 요구.
2. **run 스냅샷 = JSON 블롭** (`runs.graph_snapshot`) — 스냅샷은
   불변이고 통짜로만 읽으므로 정규화는 과잉(결정 9b).
3. **`block_defs`와 `nodes`는 FK 없이 완전 분리** — 템플릿 복사
   시맨틱(ui.md Q7). 드래그 시 config를 통째 복사, 역승격도 복사.

## 테이블

### pipelines

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | text PK | |
| name | text | |
| created_at / updated_at | integer | |
| last_opened_at | integer | 앱 진입 시 "마지막 파이프라인" 결정 |

### nodes — 편집 중인 현재 그래프

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | text PK | |
| pipeline_id | text FK | |
| type | text | agent/input/output/gate/human/skill/rule/tool |
| name | text | |
| position_x / position_y | real | React Flow 좌표 |
| config | text (JSON) | 타입별 속성(nodes.md). Agent: 역할·출력형식·모델·스키마·갭모드 / Input: document_id·인라인 / Gate: 조건식·최대루프 / … |
| created_at / updated_at | integer | |

### edges

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | text PK | |
| pipeline_id | text FK | |
| source_node_id / target_node_id | text FK | |
| kind | text | `flow`(실선) / `mount`(점선) — 배선 제약은 앱 검증 |
| source_handle | text nullable | Gate만 `pass`/`fail` |
| input_order | integer | Q11 입력 순번(엣지 클릭으로 조정) |

### block_defs — 팔레트 하위 항목(저장된 정의)

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | text PK | |
| type | text | 팔레트 트리의 소속 타입 |
| name | text | |
| description | text | 팝오버·툴팁 문구 |
| config | text (JSON) | nodes.config와 동일 형태 |
| enabled | integer(bool) | 하위 항목별 활성/비활성(Q10-B) |
| origin | text | `human` / `chatbot` / `import` |
| tray | integer(bool) | true = 새 블록 트레이 대기(챗봇 add, 미승인). 캔버스 드래그 승인 시 false로 |
| created_at | integer | |

빈 블록(팔레트 "빈 Agent" 등)은 DB 행이 아니라 앱 상수.

### runs

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | text PK | |
| pipeline_id | text FK | |
| status | text | `running` / `waiting_human` / `succeeded` / `failed` / `gate_failed` / `cancelled` |
| graph_snapshot | text (JSON) | 시작 시 nodes+edges 전체 복사 |
| upstream_run_id | text nullable | 부분 재실행 시 아티팩트 재사용 출처(직전 완료 run) |
| started_at / ended_at | integer | |

같은 파이프라인의 `running`/`waiting_human` run은 1개 제한(Q14) — 앱
레벨에서 강제.

### node_runs — run별 노드 실행 기록

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | text PK | |
| run_id | text FK | |
| node_id | text | 스냅샷 내 노드 id |
| iteration | integer | Gate 루프 회차(1부터). 회차 칩·진행 표시 근거 |
| status | text | `queued` / `running` / `waiting_human` / `succeeded` / `failed` / `skipped` |
| gate_decision | text nullable | Gate 노드 전용 — `pass` / `fail`. Gate 외 노드는 항상 null |
| error | text nullable | |
| started_at / ended_at | integer | |

**gate_decision**: Gate는 순수 라우터라 아티팩트를 남기지 않고 판정 후
항상 `succeeded`로 마감한다(결정은 상태가 아니라 라우팅으로 표현). 따라서
"이 Gate가 pass였나 fail이었나"는 status만으로 복원할 수 없다. 프로세스
재시작·`waiting_human` 재하이드레이션 시 pass-엣지 하류를 실행해도 되는지
판정하려면 이 값이 반드시 DB에 있어야 한다(engine.md §1 재시작 복구).
회차별로 다르므로 run 단위가 아니라 node_run 행에 기록한다.

### artifacts

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | text PK | |
| node_run_id | text FK | 노드 실행 1회 = 아티팩트 1개(결정 6) |
| format | text | `markdown` / `json` / `html`(Output) |
| content | text | 스트리밍 중 주기적 append-flush, 완료 시 확정 |
| meta | text (JSON) nullable | Input: 문서 버전 번호 / Human: 편집 주체 등 |
| created_at | integer | |

### documents / document_versions

| documents | | document_versions | |
| --- | --- | --- | --- |
| id | text PK | id | text PK |
| name | text | document_id | text FK |
| current_version | integer | version | integer |
| created_at | integer | content | text (전문) |
| | | author | text — `human` / `llm` |
| | | note | text nullable (변경 요약) |
| | | created_at | integer |

문서 본문은 versions에만 존재(현재 본문 = current_version 행).
에이전트 접근은 `get_document(id)`/`search_documents` tool(결정 7).

### chat_messages

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | text PK | |
| pipeline_id | text FK | 파이프라인당 1 스레드(Q6) |
| kind | text | `user` / `assistant` / `card_block` / `card_human` / `card_run` |
| payload | text (JSON) | 텍스트 또는 카드 데이터 |
| run_id / node_run_id | text nullable | 카드 ↔ run 연결(Human 카드 스크롤 점프 등) |
| created_at | integer | |

## 마일스톤 매핑

- **M1**: pipelines, nodes, edges, runs, node_runs, artifacts,
  documents, document_versions. (block_defs·chat_messages 테이블은
  같이 만들어두되 미사용)
- **M2**: block_defs 사용(임포터), chat_messages의 card_run/card_human.
- **M3**: chat_messages 전체.
