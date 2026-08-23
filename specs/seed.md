# 정본 시드 (canonical seed)

2026-08-18 grill-me 합의 + architect 판정으로 확정, 2026-08-19 구현
(커밋 `100c980`·`c36ee84`), 2026-08-23 실 DB 재시드 적용 후 본 문서로 스펙 승격.
상위: [recruit-flow-blueprint.md](../recruit-flow-blueprint.md) ·
[auth.md §7](auth.md)(시드 복제 메커니즘) · [nodes.md](nodes.md) ·
[engine.md](engine.md). **스펙=진실의 원천 — 카탈로그(코드)가 이 계약을 따른다.**

## 1. 목적·원칙 (6개 결정)

개발/QA로 누적된 "중구난방" 블록·문서를 `my-recruit`(성숙한 정본 문서 시스템)의
대표 자료로 전면 교체한다.

1. **범위**: 팔레트(block_defs) + 문서 라이브러리 + 표준 파이프라인 1개 전부 정본화.
2. **파이프라인**: my-recruit 워크플로 충실 재현(§3 토폴로지).
3. **자료 공급 이원화**: 핵심 사실은 Input 노드(JD·프로필·경험뱅크), 대형·보조
   뱅크는 `get_document`/`search_documents` 도구 인출(지표 레지스트리·정본 문장 뱅크).
4. **입도**: 파일 = 아이템 1개(거친 입도, 대표 정예). my-recruit 파일 경계 유지.
5. **교체 방식**: 전면 재시드 — owner 스코프 비우고 카탈로그 삽입(멱등).
6. **원문 위치**: 저장소 루트 `seed/`(UTF-8 md/html/css)가 유지보수 지점 1곳.
   `catalog.ts`가 읽어 주입. 콘텐츠를 스키마 마이그레이션에 싣지 않는다.

## 2. 카탈로그 구성 (블록 11 + 문서 5 + 파이프라인 1)

| 분류 | 아이템 | 타입 | 비고 |
| --- | --- | --- | --- |
| 도구(2) | 문서 가져오기 / 문서 검색 | tool | `get_document`·`search_documents`(v1 카탈로그) |
| 규칙(3) | 작문 가이드 / 소유자 스타일 원장 / AI 사용 가드 | rule | `seed/rules/*.md`. 공통가드(연차·무경험스택)는 AI 사용 가드에 병합 |
| 기술(2) | 직무군 타겟팅 / 채점 루브릭 | skill | `seed/skills/*.md` |
| 에이전트(4) | tailor(md) / writer(md) / recruiter-screen(json) / tech-screen(json) | agent | role은 recruit-flow 실행 모델(`## 입력:`·단일 아티팩트·JSON 강제)로 재작성. 채점기 스키마 = `total/verdict/passBar/blockers`(nodes.md §2 권장 스키마) |
| 문서(5) | 현재 JD / 지원자 프로필 / 경험 뱅크 / 지표 레지스트리 / 정본 문장 뱅크 | documents | "현재 JD"는 안정 이름 규약(nodes.md §3 JD 교체 루프) |
| 템플릿(1) | 기본 이력서(DESIGN.md + base-resume.html/css) | output 렌더 | 결정론적 변환(결정 10) |

장착(mounts): writer=규칙 3종+도구 2종, tailor=직무군 타겟팅,
recruiter/tech-screen=채점 루브릭+도구 2종(2026-08-19 배선 보강, `c36ee84`).

## 3. 표준 파이프라인 "my-recruit 표준 파이프라인" (노드 10 · 엣지 16)

```
현재 JD ─┬─▶ tailor ─▶ writer ─┬─▶ recruiter-screen ─┐
지원자 프로필 ─┤   ▲            ├─▶ tech-screen ──────┤
경험 뱅크 ────┘   │            │                     ▼
                  │            └────────────▶ 관문(gate)
                  └────────────── fail ◀──────┤ pass
                                              ▼
                                          내 검토(human) ─▶ 완성본(output)
```

- 입력 3(현재 JD·지원자 프로필·경험 뱅크) → tailor(inputOrder 0·1·2)
- tailor·지원자 프로필·경험 뱅크 → writer
- writer·현재 JD → recruiter-screen / writer·현재 JD → tech-screen (채점기가 JD 원문 수신)
- writer·recruiter-screen·tech-screen → 관문
- 관문 pass → 내 검토 → 완성본 / 관문 fail → writer (재작성 루프)

**관문 계약**: `expr = 'recruiter-screen.verdict == "PASS" && tech-screen.verdict == "PASS"'`,
`maxLoops = 3`, `failTargetNodeName = "writer"`.

**★ 세트 정합 불변식**: 관문 expr의 출처 접두는 상류 노드 `name`과 **정확히
일치**해야 한다(gate.ts가 이름으로 컨텍스트를 만든다). 따라서
**채점 노드명 ↔ 관문 expr ↔ 채점기 jsonSchema(verdict 필드)**는 한 세트로만
변경한다. 카탈로그 수정 시 이 3자를 함께 검증할 것.

## 4. 삽입 해소 규약 (provision.ts)

카탈로그는 이름 참조를 쓰고 삽입 시 실제 id로 해소한다(삽입 순서 의존):
1. `__slug:<slug>` → block_def id (mounts 배선)
2. `config.documentName` → documentId (Input 참조)
3. `config.failTargetNodeName` → failTargetNodeId (Gate)
4. 엣지 `sourceNodeName`/`targetNodeName` → 노드 id

신규 유저 프로비저닝(`provisionSeedForUser`, auth.md §7)도 표준 파이프라인을
포함해 복제한다(G1 결정).

## 5. 재시드 규약 (`npm run seed:canonical`)

- 대상: `DEV_OWNER_ID` 소유 행만(block_defs·documents(+versions)·pipelines
  (+nodes/edges)·runs(+node_runs/artifacts cascade)). 다른 owner 불변.
- 안전장치: 삭제 대상 개수·이름 출력 후 `--yes` 없으면 중단(실 DB 오조작 방지).
- 멱등. `runWithUser(DEV_OWNER_ID, …)` 경유로 RLS 정합(BYPASS 없음).
- 실 DB 적용 이력: 2026-08-23 사용자 승인 하에 실행 — 백업
  `tmp/backups/recruit_flow-20260823-230136.sql`, 결과 블록 11·문서 5·
  파이프라인 1(노드 10·엣지 16).

> m2-plan.md의 초기 canonical 도식(8노드/게이트 점수식)은 이 문서로 **대체**된다
> — 역사 기록으로만 유효.
