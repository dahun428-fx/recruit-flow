# recruit-flow DB 스키마

2026-07-24 grill-me 세션(Q16)으로 확정. SQLite + Drizzle(결정 8).
상위 문서: [recruit-flow-blueprint.md](../recruit-flow-blueprint.md) ·
[nodes.md](nodes.md). id는 전부 텍스트(nanoid), 시각은 unixepoch ms.

M4 재설계(2026-08-15): 참조+오버라이드 시맨틱(결정 1), 장착 칩 방식(결정 3), enabled 토글 폐지(결정 5) 반영.

> **재플랫폼 Phase 1 — 방언 전환(2026-08-16, [replatform-plan.md](replatform-plan.md))**:
> 데이터 레이어를 **SQLite/better-sqlite3(동기) → Postgres/postgres.js(비동기)**로 전환.
> 테이블·컬럼·관계 계약은 **불변** — 방언만 바뀐다. 매핑: `sqliteTable`→`pgTable`,
> `text` 유지(id=nanoid), `integer`(ms 시각)→`bigint({mode:"number"})`,
> `text({mode:"json"})`→`jsonb`, `integer`(boolean)→`boolean`, `real`(좌표)→
> `doublePrecision`. FK cascade는 pg 네이티브(더 강함) — `folders.parent_id`·
> `documents.folder_id`는 진짜 FK로 승격하되 **순환 검증은 앱 레벨 유지**.
> 드라이버가 async이므로 모든 쿼리 함수·러너 경로가 async가 되며, 러너의
> **"DB 먼저 기록 → SSE 발행" 순서는 반드시 보존**(engine.md §3, 리스크 R1).
> SQLite 마이그레이션 0000~0004는 아카이브, pg는 백지 0000으로 재시작.
> 소유권(owner_id)·인증·RLS는 Phase 2 — 이 Phase는 순수 방언 전환이다.

## 설계 원칙 (Q16, M4 갱신)

1. **현재 그래프 = 정규화 행** (`nodes`/`edges`) — 팔레트·부분
   재실행·검증이 노드 단위 조회를 요구.
2. **run 스냅샷 = JSON 블롭** (`runs.graph_snapshot`) — 스냅샷은
   불변이고 통짜로만 읽으므로 정규화는 과잉(결정 9b).
3. **`nodes`는 `block_defs`를 참조(block_def_id nullable) + 필드별
   오버라이드** — `block_def_id=null`이면 `config`가 완결, non-null이면
   `config`는 오버라이드 필드만이고 실효 config = `block_def.config ⊕ config`.
   정의 config 수정은 참조하는 모든 노드에 반영(SSE). `node.name`은 항상
   인스턴스 소유(Gate 조건식 참조 안정성). run 스냅샷은 참조를 resolve한
   완결 config를 저장하므로 과거 run 불변.
   마이그레이션: `nodes` 테이블에 `block_def_id text nullable` 컬럼 추가 필요.

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
| type | text | agent/input/output/gate/human |
| name | text | 항상 인스턴스 소유 — 정의 이름 변경이 이 값을 끌고 가지 않음 |
| block_def_id | text nullable | FK → block_defs.id. null이면 독립 노드, non-null이면 참조 노드 |
| position_x / position_y | real | React Flow 좌표 |
| config | text (JSON) | block_def_id=null이면 완결 config. non-null이면 오버라이드 필드만(실효 config는 block_def.config ⊕ 이 값). Agent: 역할·출력형식·모델·스키마·갭모드·mounts / Input: document_id·인라인 / Gate: 조건식·최대루프 / … |
| created_at / updated_at | integer | |

**타입 범위**: `agent/input/output/gate/human`. skill/rule/tool은 캔버스 독립 노드가 아니라 `block_defs` 팔레트 정의로만 존재하며 Agent config.mounts에 참조로 저장된다(결정 3, M4 재설계).

### edges

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | text PK | |
| pipeline_id | text FK | |
| source_node_id / target_node_id | text FK | |
| kind | text | `flow`(실선) — 배선 제약은 앱 검증 |
| source_handle | text nullable | Gate만 `pass`/`fail` |
| input_order | integer | Q11 입력 순번(엣지 클릭으로 조정) |

**`mount` 엣지 폐기(M4)**: skill/rule/tool을 잇던 점선 `mount` 엣지는 M4 재설계로 폐기됐다. 장착은 Agent `config.mounts[]`에 `{blockDefId, override?}` 배열로 저장한다. 기존 DB에 `kind='mount'` 행이 있으면 마이그레이션 시 제거.

### block_defs — 팔레트 하위 항목(저장된 정의)

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | text PK | |
| type | text | 팔레트 트리의 소속 타입(agent/input/output/gate/human/skill/rule/tool) |
| name | text | |
| description | text | 팝오버·툴팁 문구 |
| config | text (JSON) | nodes.config와 동일 형태. skill/rule: 이름+내용(마크다운). tool: 카탈로그 선택 |
| enabled | integer(bool) | **M4부터 미사용**: UI·러너·팔레트 필터에서 참조하지 않음. 마이그레이션 회피를 위해 컬럼은 유지, v2에서 정리. |
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
| graph_snapshot | text (JSON) | 시작 시 nodes+edges 전체 복사. 참조 resolve 완결 config 포함(M4) |
| upstream_run_id | text nullable | 부분 재실행 시 아티팩트 재사용 출처(직전 완료 run) |
| label | text nullable | **M5 워크스트림 D (계획 — 마이그레이션 대기)**: JD별 run 그룹핑용 자유 라벨(회사/직군명). "현재 JD" 규약(nodes.md §3)상 모든 run의 Input documentId가 동일하므로 documentId로는 run을 구분 못 함 → 라벨로 JD별 히스토리 조회. 챗봇/사용자가 세팅. 러너 무변경 |
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
챗봇 `edit_document` tool로 수정 시 매 성공마다 새 버전 생성(author=llm).

**`documents.folder_id`** (M5, v2→현행 승격, 2026-08-16): text nullable —
문서가 속한 폴더(null=루트). FK→`folders.id`이나 SQLite `ADD COLUMN` 한계로
**앱 레벨 강제**(Input `config.documentId` 참조와 동일 정책). 마이그레이션
0004에서 비파괴 `ADD COLUMN`, 기존 문서 전부 null(루트).

### folders — 문서 임의 폴더 하이라키 (M5, v2→현행 승격)

| 컬럼 | 타입 | 비고 |
| --- | --- | --- |
| id | text PK | |
| name | text | 폴더 이름 |
| parent_id | text nullable | 상위 폴더(null=루트 직속). FK→folders.id, 앱 레벨 강제. 순환 금지(자기·후손으로 이동 불가) |
| created_at | integer | |

블록 구획의 타입 폴더(에이전트/자료…)·프로젝트/실행기록 폴더와 **별개의
사용자 임의 폴더**이며 **문서 구획에만** 적용. 빈 폴더 1급 지원. 폴더 삭제
시 하위 문서는 **루트로 이동**(비파괴 — 문서는 파이프라인 Input이 참조하는
실데이터), 하위 폴더는 조부모로 승격. 같은 부모 내 동명은 허용(경고만).

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
- **M4**: nodes.block_def_id 컬럼 추가 마이그레이션, edges.kind='mount' 행
  폐기, block_defs.enabled 미사용 전환, Agent config.mounts 저장 방식
  확정. document_versions에 llm author 경로(edit_document) 공식화.
