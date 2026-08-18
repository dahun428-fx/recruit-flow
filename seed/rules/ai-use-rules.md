# AI Use Rules

Read this file before generating or editing any resume, cover letter,
self-introduction, portfolio summary, or job-specific application document.

## Read Priority

1. `ai-readable.yaml`
2. `metric-registry.md`
3. `profile.md`
4. `experience-bank.md`
5. `target-companies.md`
6. `writing-guidelines.md`
7. `source-materials.md`
8. `source-log.md`
9. `../../DESIGN.md` only for visual, HTML, PDF, or print-ready output

## Fact Rules

- Do not invent employers, project periods, metrics, certifications, education,
  salary, or responsibilities.
- Prefer `ai-readable.yaml` IDs when selecting relevant experience.
- Check every numeric claim against `metric-registry.md` before using it.
- Do not use `needs_confirmation`, `needs_scope`, or `sensitive` claims in final
  external copy unless the user explicitly approves them.
- `source_stated` metrics may be used, but keep the wording close to the source
  and avoid overclaiming.
- If a source metric has a caveat, preserve the caveat or choose a safer
  phrasing.
- `preferred_bullets` in `ai-readable.yaml` are draft seeds, not permission to
  bypass `metric-registry.md`.

## Career Tenure Accuracy

- Express total career length as **"총 5년 9개월"** (reference: 2020.10~2026.07;
  recalculate from today's date when drafting). Always show the exact figure.
- "6년차" is allowed in summary prose **only**, with no numeric pairing.
- **Never write "7년차" or higher** without explicit user confirmation of a
  later end-date.

## Unverified Stack Prohibition

Do **not** claim real-work experience with any of the following unless
`experience-bank.md` has confirmed evidence:

- gRPC, GraphQL
- WebSocket (production use) — side-project implementation (user-attested
  2026-07-22) is acceptable **in cover letters only**
- TCP/UDP
- Go, Angular
- Vite/ESBuild, Emotion, PNPM
- GitHub Actions, Jira/Confluence

When these skills appear in a JD requirement, cite adjacent verified experience
(e.g. SSE, REST, Next.js bundling, Jenkins/GitLab CI/CD) and do not fabricate.

## Sensitive Data

Ask before including:

- Phone number
- Email
- Home address
- Birth year / age
- Gender
- Salary
- TOEIC date or validity
- Certificate issue details
- TOEIC score or certificate name when the destination requires proof

## Preferred Positioning

Use one of these depending on the target role:

- "프론트엔드에서 풀스택으로 확장한 Frontend-focused Product Engineer"
- "AI 서비스 PoC를 실사용 가능한 제품으로 전환해 온 프론트엔드 중심 Product Engineer"
- "React·TypeScript 기반 아키텍처와 B2B 플랫폼 내재화 경험을 가진 프론트엔드 개발자"

Avoid unsupported superlatives such as "최고의", "완벽한", "압도적인".

## Product Name Normalization

Normalize product names within each final document:

- `비즈케어` and `비즈36.5` may refer to related contexts. Pick one name based on
  the target document and use it consistently.
- `생체나이` and `바이오에이지` may refer to related contexts. Pick one name based
  on the target document and use it consistently.
- When unsure, use the name from the source or ask the user.

## Experience Selection

Use these experience IDs from `ai-readable.yaml`:

- `exp-ai-health-chatbot`: AI, LLM, productization, frontend architecture
- `exp-b2b-health-platform`: full-stack, B2B platform, internalization, CI/CD
- `exp-fe-ax-automation`: QA automation, developer productivity, AI development process
- `exp-samsung-data-mobile`: data visualization, mobile app, performance
- `exp-misumi-commerce`: commerce, legacy modernization, Next.js, SEO/performance

## Drafting Rules

- Start with the job posting or target company requirement.
- Select 2-4 relevant experience IDs, not every project.
- Use metrics only when they strengthen the target claim.
- Convert raw facts into concise Korean business writing.
- Keep raw source excerpts out of final documents.
- For web forms, prioritize field prompts and character limits.
- For A4/PDF/HTML output, follow `../../DESIGN.md`.

## Safe Bullet Patterns

```text
[문제/목표]를 해결하기 위해 [행동]을 수행했고, [검증된 결과]를 만들었다.
```

```text
[기술/구조]를 도입해 [반복 문제]를 줄이고, [시간/품질/운영 지표]를 개선했다.
```

```text
[기존 구조]를 분석해 [전환 구조]로 개선하고, [운영 가능성/확장성]을 확보했다.
```
