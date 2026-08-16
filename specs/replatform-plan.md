# 재플랫폼 계획 — 로컬 SQLite 단일사용자 → Supabase/Postgres 멀티유저

2026-08-16 grill-me + architect 설계 합의. 상위: `recruit-flow-blueprint.md`
(결정 2·8 개정 대상). **스펙=진실의 원천 — 각 Phase의 스펙 델타 승인 후 코드.**

## 확정 결정 (Phase 0 — 사람 승인 완료)

| SG | 결정 | 확정 |
|---|---|---|
| SG-1 러너 배포 | **지속 Node 호스트**(Railway/Fly/VPS). 러너·SSE·humanWait 거의 그대로, recoverOnBoot가 재시작 감당. 결정 8 보존 | ✅ |
| SG-2 LLM 인증 | **사용자별 BYO Anthropic 키**(암호화 저장·런타임 주입). 결정 2 개정 | ✅ |
| SG-3 실시간 | **SSE 유지**(지속 호스트면 충분). 브로드캐스트 소유자 스코프 축소. Realtime은 스케일아웃 시 v2 | ✅ |
| SG-4 공유 리소스 | **사용자별 복제**(증거베이스·block_defs는 개인 데이터). 신규 가입 시 시드 복사 | ✅ |
| SG-5 격리 | **RLS 1차 + 앱필터 2차**(이중방어). 러너 service_role 경계 주의 | ✅ |
| SG-6 마이그레이션 | **pg 백지 재시작**(sqlite 0000~0004 아카이브) | ✅ |

## 데이터 방언 매핑 (sqlite-core → pg-core)
- `sqliteTable`→`pgTable`. id는 **nanoid text 유지**(UUID 안 함). 시각 `integer(ms)`→
  **`bigint({mode:"number"})`**(timestamptz 아님 — 코드가 Date.now() ms 정수 사용).
  `text({mode:"json"})`→`jsonb`. `integer boolean`→`boolean`. `real`좌표→`doublePrecision`.
  FK cascade는 pg 네이티브(더 강함). folders/documents FK는 진짜 FK로 승격하되 순환검증은
  앱 레벨 유지. 드라이버 `better-sqlite3`→**postgres.js**. **★ Node 22 ABI 제약 소멸**.
- 트랜잭션 5곳(saveGraph·deleteFolder·queries 257/287/388/743) sync→**async 전파** —
  러너 "DB먼저→SSE" 순서 감사 필수(R1).

## 소유권 모델 (Phase 2)
루트 테이블에만 `owner_id`(→auth.users): **pipelines·documents·folders·block_defs**.
하위(nodes·edges·runs·node_runs·artifacts·document_versions·chat_messages)는 FK 상속.
run에 owner_id 각인(러너 service_role 쓰기 격리 R3). run active 1개 제한을 DB 부분
유니크 인덱스로 승격(R5).

## Phase 분해 (각 독립 롤백 가능)
- **Phase 0**: 스펙 결정 ✅ + 스펙 델타(결정 2·8, 신규 결정 13, schema.md·engine.md, 신규 auth.md, CLAUDE.md Node22 절 삭제).
- **Phase 1 (최저위험 착수)**: 데이터 레이어 — schema.ts pg-core, client.ts postgres.js, 트랜잭션 async, deps 교체(better-sqlite3 제거), drizzle-kit pg, pg 0000, **ETL 스크립트**. owner_id·auth 없음(순수 방언 전환). 로컬 pg(docker) 검증: 타입체크+기존 e2e/스모크 그린. 되돌리기 쉬움.
- **Phase 2 (분할)** — 상세 설계·계약: [auth.md](auth.md).
  - **Phase 2a (로컬 우선, 착수)**: owner_id + pg 네이티브 RLS(`rf_app` FORCE) +
    앱필터 + 현재유저 seam(AsyncLocalStorage, `resolveUserId`가 유일 스왑 지점) +
    러너 owner 경계(R3) + SSE owner 스코프 + 시드 복제 헬퍼. 인증 UI 없음
    (`x-rf-user` 헤더/`DEV_OWNER_ID` 폴백). 2계정 격리 로컬 검증.
    > ★ 게이트 실험(2026-08-16) 확정: RLS current-user GUC는 **트랜잭션 스코프
    > `SET LOCAL` 또는 예약 커넥션+명시 RESET**만 안전. bare 세션 `set_config`는
    > 풀 커넥션 재사용 시 다음 요청으로 **누수**(실험 C/D). 예약 커넥션을 ALS에
    > 담고 finally에서 RESET하는 방식으로 러너 백그라운드 쓰기까지 격리.
  - **Phase 2b (연기)**: Supabase GoTrue/JWT/로그인 UI. `resolveUserId` 몸통 +
    `provisionSeedForUser` 웹훅만 교체하면 2a 위에 얹힌다.
- **Phase 3**: 배포(지속 Node 호스트, Dockerfile·env·DATABASE_URL) + recoverOnBoot 재시작 실증.
- **Phase 4**: BYO 키 — user_settings 암호화 저장, sdk.ts/chat.ts 키 주입, 러너 키 확보(스냅샷·로그·SSE 유출 금지 R4), 설정 UI. code-reviewer 보안 게이트.
- **Phase 5**: (연기) Realtime — 스케일아웃 실제 필요 시.

## 최상위 리스크
- R1 트랜잭션 async가 러너 순서 붕괴(높음) — Phase 1에서 조기 실증.
- R3 RLS를 러너 service_role이 우회(높음) — Phase 2, owner_id 각인.
- R4 BYO 키가 graph_snapshot/로그/SSE로 유출(높음) — Phase 4 보안 감사.
- 가장 위험한 가정: "러너를 거의 그대로 지속 호스트에 올린다" — 틀리면 (B)워커분리로 규모 배가. Phase 1(R1)·2(R3)에서 먼저 깨본다.

## 착수: Phase 1 (데이터 레이어)
Phase 0 결정 완료 → Phase 1 착수. auth·배포·과금과 분리 가능, 로컬 검증, 되돌리기 쉬움.

## 진행 상태

- ✅ **Phase 0** — 6개 스펙 결정 확정·커밋(`d9058bd`).
- ✅ **Phase 1 (데이터 레이어)** — 2026-08-16 완료.
  - **앱코드 원자 전환**: `schema.ts` pg-core(`bigint`/`jsonb`/`boolean`/`doublePrecision`),
    `client.ts` postgres.js, `queries.ts` 전체 async(트랜잭션 5곳 포함), 러너/노드/이벤트/
    instrumentation/18개 API 라우트 await 리플, deps 교체(better-sqlite3 제거→postgres),
    next/drizzle config, sqlite 마이그레이션 아카이브 + pg `0000` 신규.
  - **R1(트랜잭션 async가 러너 순서 붕괴) — 실증으로 해소**: `emitChatCard`·러너 emit이
    모두 "DB await 후 SSE 발행". e2e의 gate 루프·human 재개(SSE) 경로가 pg에서 통과.
  - **검증**: `tsc --noEmit` GREEN(Node 23), **e2e 31 passed + 1 flaky**(known 첫컴파일
    가시성 flake, 재시도 통과) against pg, ETL 112행 적재(jsonb=object·bool·한글·FK 무결).
  - **하네스**: e2e 전용 `recruit_flow_e2e` DB(스키마 리셋→migrate→seed). `DATABASE_URL` 사용.
  - **⚠ 후속 연기**: `scripts/smoke-*.mts`(엔진/챗 스모크)는 대량 async 재작성 필요 +
    e2e와 중복이라 이관 연기. `scripts/{e2e-heal,import-my-recruit,*-canonical-live}.mts`도
    pg 포팅 대기(import-my-recruit는 Step 1에서 부분 전환됨).
- ⏳ **Phase 2~5** — 미착수(auth/RLS → 배포 → BYO키 → realtime).
