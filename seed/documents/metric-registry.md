# Metric Registry

This file is the AI-facing registry of numeric claims. Use `confirmed` metrics
freely, use `source_stated` metrics with care, and do not use
`needs_confirmation` or `needs_scope` metrics in final external copy without
user confirmation.

## Status Labels

- `confirmed`: Safe to use as written based on the imported source material.
- `source_stated`: Stated by a source, but wording or attribution should stay
  close to the source.
- `needs_scope`: Metric exists, but the measurement scope needs clarification.
- `needs_confirmation`: Do not use externally until the user confirms.
- `sensitive`: Private or potentially sensitive; ask before using.

## Metrics

| ID | Claim | Status | Preferred Wording | Source |
| --- | --- | --- | --- | --- |
| `metric-ai-poc-users` | 3,493명 — 실서비스 전환 후 실제 활성 사용자 수 | confirmed | 2차 PoC 검증(사용성 4.18/만족도 4.06/완성도 4.05)을 거쳐 실서비스로 전환했고, 임직원 대상 실제 활성 사용자 3,493명을 확보 (활성 사용자 수치는 user-attested 2026-07-27 정정 — 문서 근거 없음, PoC 참여자 수와 혼동 금지) | `src-resume-20260624`, `src-eval-2025`, user-attested 2026-07-27 |
| `metric-ai-satisfaction` | 사용성 4.18점, 서비스 만족도 4.06점, 완성도 4.05점 | needs_scope | Do not use externally until survey scale and respondent scope are confirmed. | `src-resume-20260624`, `src-eval-2025` |
| `metric-ai-answer-time` | AI 답변 출력 10초 -> 4초 | confirmed | AI 답변 출력 시간을 10초에서 4초로 단축 | `src-resume-20260624`, `src-eval-2026-h1` |
| `metric-ai-entry-time` | 초기 진입 30초 -> 6초 | confirmed | 초기 서비스 진입 시간을 30초에서 6초로 단축 | `src-resume-20260624`, `src-eval-2025` |
| `metric-ai-render-success` | 400건 발화 검증 기준 답변 화면 정상 출력률 100% | confirmed | 400건 발화 검증 기준 답변 화면 정상 출력률 100% (스코프 "400건 발화 검증 기준"을 항상 함께 표기) | `src-resume-20260624`, `src-eval-2026-h1` |
| `metric-ai-build-period` | 신규 AI 챗봇 구축 기간 10주 -> 2주 가능한 구조 | source_stated | 챗봇 최초 구축 10주 대비, 신규 고객사(웰체크) 온보딩 시 Base-Theme 활용 FE 커스터마이징·납품 기간 2주로 단축(**FE 기준, LLM/BE 일정 별도** — user-attested 2026-07-23 headhunter-advisor 인터뷰 스코프 정정. "챗봇 전체를 2주 만에 구축"으로 쓰지 말 것) | `src-resume-20260624`, `src-eval-2026-h1` |
| `metric-ai-lighthouse` | Lighthouse 91점 | source_stated | AI 챗봇 화면 기준 Lighthouse 91점 (측정 페이지·조건 세부는 원본 미기재 — "AI 챗봇 화면 기준" 스코프와 함께만 사용) | `src-resume-20260624`, `src-eval-2025` |
| `metric-b2b-pages-screens` | 9주 내 108개 페이지, 82개 화면 전환 | source_stated | 9주 내 108개 페이지·82개 화면을 임직원 건강 플랫폼으로 전환 | `src-resume-20260624`, `src-eval-2026-h1` |
| `metric-b2b-new-features` | 건강관리 신규 기능 3건 End-to-End 개발 | confirmed | 신규 건강관리 기능 3건을 데이터 모델부터 화면까지 End-to-End 개발 | `src-resume-20260624`, `src-eval-2026-h1` |
| `metric-b2b-client-change-response` | 고객사별 CI/메뉴/기능 변경 1주 내 대응 가능한 구조 | source_stated | 고객사별 CI·메뉴·기능 변경을 1주 내 대응 가능한 구조 구축 | `src-resume-20260624`, `src-eval-2026-h1` |
| `metric-e2e-scenarios` | 600여 건 E2E 회귀 시나리오 자동화 | source_stated | Playwright 기반 600여 건의 E2E 회귀 시나리오 자동화 | `src-resume-20260624`, `src-eval-2026-h1` |
| `metric-qa-time` | 반복 QA 3시간 -> 30분 | confirmed | 반복 QA 시간을 3시간에서 30분으로 단축 (2026-07-24 소유자 최종 확정치 — primary; 원본 평가문서 값 3시간→1시간은 참고용, 문서 근거 미확보) | `src-eval-2026-h1`, user-attested 2026-07-24 |
| `metric-ops-check-steps` | 운영 데이터 확인 3단계 -> 1단계 | source_stated | 운영 데이터 확인 절차를 3단계에서 1단계로 전환 | `src-resume-20260624`, `src-eval-2026-h1` |
| `metric-component-dev-time` | 반복 컴포넌트 개발 90분 -> 15분 | confirmed | 반복 컴포넌트 개발 시간을 90분에서 15분으로 단축 | `src-resume-20260624`, `src-eval-2026-h1` |
| `metric-planning-dev-leadtime` | 기획-개발 검증 리드타임 2일 -> 1일 | source_stated | 기획-개발 검증 리드타임을 2일에서 1일로 단축 | `src-resume-20260624` |
| `metric-test-coverage` | 테스트 커버리지 98% 수준 | needs_scope | Do not use externally until coverage basis is confirmed. | `src-resume-20260624`, `src-eval-2025` |
| `metric-samsung-dashboard-render` | 대시보드 렌더링 2.5초 -> 1초대 | source_stated | 대용량 데이터 대시보드 렌더링 시간을 2.5초에서 1초대로 개선 | `src-resume-20260624` |
| `metric-samsung-rn-search` | React Native 검색 5초 -> 1초 | confirmed | React Native 앱 검색 응답 시간을 5초에서 1초로 단축 | `src-resume-20260624` |
| `metric-misumi-page-access` | 페이지 접근 8초 -> 2초 | confirmed | 페이지 접근 시간을 8초에서 2초로 단축 | `src-resume-20260624` |
| `metric-misumi-nextjs-loading` | Next.js 전환 후 평균 로딩 속도 약 50% 개선 | source_stated | Next.js 전환 후 기존 PHP 서비스 대비 평균 로딩 속도 개선 | `src-resume-20260624` |
| `metric-2025-revenue-total` | 2025년 총 4.66억 원 매출 기여 | needs_scope | Do not use externally until attribution and total/breakdown difference are confirmed. | `src-eval-2025` |
| `metric-2025-revenue-breakdown` | 비즈케어 1.0억, AI코치 0.2억, 생체나이 2.5억, 에스크미 0.9억 | needs_scope | Do not use externally until the 4.66억 total vs 4.6억 breakdown difference is reconciled. | `src-eval-2025` |
| `metric-bioage-transition` | 생체나이 고객 112처 중 93처, 83% 안정 전환 | source_stated | 생체나이 기존 고객 112처 중 93처를 안정 전환 | `src-eval-2025` |
| `metric-fe-error-zero` | 2차 PoC 기준 FE 에러 0건 | needs_scope | Do not use externally until period and error definition are confirmed. | `src-eval-2025` |
| `metric-jenkins-deploy-time` | Jenkins 배포 리드타임 10분 -> 2분 | confirmed | Jenkins CI/CD 배포 리드타임을 10분에서 2분으로 단축 | `src-eval-2025` |
| `metric-http2-network-cost` | HTTP/2 전환 네트워크 비용 1,200KB -> 900KB (약 25%) | source_stated | HTTP/2 전환으로 네트워크 비용을 1,200KB에서 900KB로 절감(약 25%) | `src-eval-2025` |

## Sensitive Or Confirmation-Required Claims

| Claim | Status | Note |
| --- | --- | --- |
| 연봉 5,700만원 | sensitive | External documents require user confirmation. |
| 생년, 성별, 주소, 연락처 | sensitive | Include only when the destination explicitly requires it. |
| 정보처리기사 | confirmed | 취득월 2020.08 (user-attested 2026-07-22). 사용 가능. |
| TOEIC 825점 | confirmed | 취득일 2024.05 (user-attested 2026-07-22, confirmed in `experience-bank.md` > Metrics To Verify). |
| 일본 해외경험 | needs_confirmation | Confirm period/context before use. |
