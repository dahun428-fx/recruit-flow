# Screen Profiles (회사별 채점 프리셋)

This file is the **single source of truth** for how the two screening graders
(`recruiter-screen` = 인사담당자, `tech-screen` = 기술담당자) are positioned per
target company. The grader agents read this file; do **not** copy the weight
tables into the agent files (they would drift).

Each target-company entry in `target-companies.md` may carry a
`Screen profile:` tag (one of the preset names below) and an optional
`Pass bar:` override. Together with the entry's own `Company / team signals`,
`Job scope`, `Required skills`, and `Risks or gaps`, this positions the graders
to that company.

## How positioning works

Three levers move per company; all three are grounded **only** in the target
company's entry — never in the model's outside knowledge of the company:

1. **Persona lens (a).** Each grader role-plays *that company's* screener,
   deciding what matters **only** from the entry's `Company / team signals`,
   `Job scope`, and `Required/Preferred skills`. If the grader wants to invoke
   outside knowledge ("this company is known for X"), it must **not** score on
   it — flag it as "엔트리 근거 없음 — 소유자 확인 필요" instead.
2. **Weighted rubric (b).** The `Screen profile:` tag selects one of the preset
   weight sets below. The six rubric axes are fixed; only their point weights
   change by preset. Each preset sums to 100 per grader.
3. **Pass bar + company blockers (c).** Default pass bar is **80** with an
   **AND** gate (both graders must PASS). A company entry may override with
   `Pass bar: NN`. Company-specific auto-FAIL blockers are derived from the
   entry (see "Company blockers").

## Fallback

If a company entry has **no** `Screen profile:` tag, or its signals are `TBD`,
grade with the **`Balanced`** preset at bar **80** and put a warning at the top
of the result: **"회사 포지셔닝 정보 부족 — 프리셋 미지정, Balanced로 채점."**
Never silently guess a non-Balanced preset.

## Onboarding a new company (approval-gated)

When the owner adds a company to `target-companies.md`, `tailor` (or the
top-level orchestrator) proposes a `Screen profile:` — and, if warranted, a
`Pass bar:` override — derived from that entry's signals, and asks for approval.
Only after approval is the tag written into the entry. No auto-tagging.

## Preset weight sets

Axes are fixed per grader; only weights change. All rows sum to 100.

### recruiter-screen (인사담당자)

Axes: 6초스캔 / 직무적합신호 / 성과임팩트 / 경력스토리 / 동기·문화 / 완성도

| Preset | 6초스캔 | 직무적합 | 성과임팩트 | 경력스토리 | 동기·문화 | 완성도 |
| --- | --: | --: | --: | --: | --: | --: |
| `Balanced` | 20 | 25 | 20 | 15 | 10 | 10 |
| `AI-Product` | 15 | 30 | 20 | 10 | 15 | 10 |
| `Platform-DS` | 15 | 25 | 15 | 20 | 10 | 15 |
| `Scale-Perf` | 15 | 25 | 25 | 15 | 10 | 10 |

### tech-screen (기술담당자)

Axes: 기술깊이 / 문제해결 / 아키텍처 / 성과신뢰성 / 레벨적합 / 협업·오너십

| Preset | 기술깊이 | 문제해결 | 아키텍처 | 성과신뢰성 | 레벨적합 | 협업·오너십 |
| --- | --: | --: | --: | --: | --: | --: |
| `Balanced` | 25 | 25 | 15 | 15 | 10 | 10 |
| `AI-Product` | 20 | 30 | 10 | 15 | 10 | 15 |
| `Platform-DS` | 20 | 20 | 25 | 15 | 10 | 10 |
| `Scale-Perf` | 25 | 25 | 15 | 20 | 10 | 5 |

### When to use which

- **`Balanced`** — default; balanced role, or entry signals insufficient.
- **`AI-Product`** — company frames the role as product/AI-driven problem
  solving over a fixed stack (e.g. CJ ENM "Product Engineer, AI 활용").
- **`Platform-DS`** — role centers on design systems, shared components,
  architecture, and stable long-term platform/service operation (e.g. NHN
  Dooray 협업 플랫폼 운영·디자인시스템).
- **`Scale-Perf`** — role centers on large-scale traffic, performance, and
  reliability, where credible perf/scale metrics dominate.

Presets are tunable: edit the tables here and the change applies on the next
grader run. Adding a new preset requires owner approval (keep the set small).

## Company blockers (auto-FAIL, per entry)

A grader caps the total at **59 (FAIL)** when any of these hold for the target
company. Honest limitations do **not** auto-FAIL — see the last bullet.

1. The draft claims a skill/experience the entry's `Risks or gaps` marks as
   **not held** by the candidate (dishonesty; overlaps `reviewer`'s fabrication
   check — hard-FAIL here too).
2. A **`Required skill` the candidate has evidence for** is entirely absent from
   the draft (self-inflicted omission). For a **disjunctive** required line
   ("A 또는 B 또는 C"), this fires only if the draft surfaces **none** of the
   branches the candidate has evidence for — one satisfied branch clears it.
3. Unresolved `확인 필요` placeholders, an active `NEVER` rule in
   `feedback-rules.md` violated, or the draft written in the **wrong output
   language** per `writing-guidelines.md` (baseline blockers, all presets).
4. For `tech-screen`: a metric contradicting `metric-registry.md`.

**Not a blocker (score penalty only):** an **honestly acknowledged** gap
(e.g. 경력 연수 부족, 비전공, 특정 프레임워크 무경험). Having the gap must not
auto-FAIL — otherwise no honest draft could ever pass. It reduces the relevant
axis (e.g. 레벨적합) instead: small penalty if framed well, large if ignored.
The gate must never pressure the draft toward fabrication.
