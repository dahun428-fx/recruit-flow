// 스타터 시드 카탈로그 — 순수 데이터 상수. DB 의존 없음.
// provisionSeedForUser()가 이 상수를 userId로 각인해 복제한다(auth.md §7 SG-4).
// 새 유저가 처음 볼 "유용한 최소 구성"을 담는다.

// ---------------------------------------------------------------------------
// block_def 카탈로그 항목 타입
// ---------------------------------------------------------------------------
export type CatalogBlockDef = {
  /** 슬러그 형태의 안정 식별자 — 중복 프로비저닝 감지용(미래 멱등화에 활용). */
  slug: string;
  /** block_defs.type */
  type: "agent" | "skill" | "rule" | "tool";
  name: string;
  description: string;
  /** block_defs.config — Drizzle jsonb로 그대로 삽입. */
  config: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// 증거 문서 카탈로그 항목 타입
// ---------------------------------------------------------------------------
export type CatalogDocument = {
  name: string;
  /** document_versions.content */
  content: string;
};

// ---------------------------------------------------------------------------
// 스타터 block_def 목록
// ---------------------------------------------------------------------------
export const STARTER_BLOCK_DEFS: CatalogBlockDef[] = [
  {
    slug: "starter:resume-writer",
    type: "agent",
    name: "이력서 작성기",
    description:
      "JD와 증거 문서를 받아 마크다운 이력서 초안을 작성하는 에이전트.",
    config: {
      role: "채용 공고(JD)와 지원자 증거 문서를 분석해 강점을 부각한 마크다운 이력서를 작성한다.",
      outputFormat: "markdown",
    },
  },
  {
    slug: "starter:relevance-scorer",
    type: "agent",
    name: "적합도 채점기",
    description:
      "이력서 초안과 JD를 비교해 0~100 점수와 항목별 피드백을 JSON으로 반환하는 에이전트.",
    config: {
      role: "이력서와 JD를 비교해 적합도를 0~100 점수로 채점하고, 강점·약점·개선 제안을 JSON으로 출력한다.",
      outputFormat: "json",
      schema: {
        score: "number",
        strengths: "string[]",
        weaknesses: "string[]",
        suggestions: "string[]",
      },
    },
  },
  {
    slug: "starter:keyword-extractor",
    type: "skill",
    name: "키워드 추출기",
    description:
      "JD에서 핵심 기술·역량 키워드를 추출해 목록으로 반환하는 스킬.",
    config: {
      role: "JD 텍스트를 받아 기술 스택·직무 역량·자격 요건 키워드를 JSON 배열로 추출한다.",
      outputFormat: "json",
    },
  },
  {
    slug: "starter:tone-rule",
    type: "rule",
    name: "문체 규칙",
    description:
      "이력서 문체 규칙: 능동태·수치 중심·간결 문장 3원칙을 강제한다.",
    config: {
      constraints: [
        "동사는 능동태로 시작한다 (예: '담당했다' → '설계했다').",
        "성과는 반드시 수치와 함께 기술한다 (예: '개선' → 'p99 30% 개선').",
        "문장당 30자 이내로 간결하게 작성한다.",
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// 스타터 증거 문서
// ---------------------------------------------------------------------------
export const STARTER_EVIDENCE_DOCUMENT: CatalogDocument = {
  name: "나의 증거 문서 (예시)",
  content: `# 증거 문서

> 이 파일에 자신의 경력·성과를 정리하세요.
> 이력서 작성기 에이전트가 이 내용을 바탕으로 이력서를 생성합니다.

## 경력 요약

- 재직 기간 / 회사명 / 직함을 여기에 적으세요.

## 주요 성과

- **성과 1** — 구체적인 수치와 함께 기술하세요 (예: API 응답 시간 p99 1.2s → 180ms 개선).
- **성과 2** — 팀 규모·역할·기여 범위를 명시하세요.
- **성과 3** — 사용한 기술 스택을 함께 기재하세요.

## 기술 스택

- 언어: (예: TypeScript, Python, Go)
- 프레임워크: (예: Next.js, FastAPI)
- 인프라: (예: AWS ECS, PostgreSQL, Redis)

## 학력 / 자격증

- 학교명, 전공, 졸업연도
- 취득 자격증 (있는 경우)
`,
};
