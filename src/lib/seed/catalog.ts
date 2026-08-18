// 정본 시드 카탈로그 — 순수 데이터 상수. DB 의존 없음.
// provisionSeedForUser()가 이 상수를 userId로 각인해 복제한다(auth.md §7 SG-4).
// G4: seed/ 파일은 런타임 fs.readFileSync로 읽는다(대형 문서 인라인 금지).

import * as fs from "node:fs";
import * as path from "node:path";

// ---------------------------------------------------------------------------
// seed/ 루트 — 저장소 루트 기준
// ---------------------------------------------------------------------------
const SEED_ROOT = path.join(process.cwd(), "seed");

function readSeed(relativePath: string): string {
  return fs.readFileSync(path.join(SEED_ROOT, relativePath), "utf-8");
}

/** YAML 프론트매터(--- ... ---)를 벗기고 본문만 반환한다. */
function stripFrontmatter(raw: string): string {
  const match = raw.match(/^---[\s\S]*?---\n?([\s\S]*)$/);
  return match ? match[1].trimStart() : raw;
}

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
  /** 문서 이름 — documents.name. 이 이름이 Input 노드 config.documentId 해소에 쓰임. */
  name: string;
  /** document_versions.content */
  content: string;
};

// ---------------------------------------------------------------------------
// 파이프라인 노드/엣지 카탈로그 항목 타입
// ---------------------------------------------------------------------------

/** 카탈로그 파이프라인 노드. blockDefSlug는 삽입 후 blockDefId로 해소된다. */
export type CatalogNode = {
  /** 노드 type */
  type: "agent" | "input" | "output" | "gate" | "human";
  /** 인스턴스 이름(Gate expr의 접두와 일치해야 함) */
  name: string;
  positionX: number;
  positionY: number;
  /**
   * 참조할 block_def slug. null=맨손 노드.
   * blockDefId는 삽입 시 slug→id 맵으로 해소.
   */
  blockDefSlug: string | null;
  /**
   * 해소 후 저장할 config 필드.
   * Input: documentName 키워드로 문서 id 해소.
   * Gate: failTargetNodeName 키워드로 노드 id 해소.
   */
  config: Record<string, unknown>;
};

/** 카탈로그 파이프라인 엣지. sourceNodeName/targetNodeName은 삽입 후 id로 해소된다. */
export type CatalogEdge = {
  sourceNodeName: string;
  targetNodeName: string;
  kind: "flow" | "mount";
  sourceHandle: null | "pass" | "fail";
  inputOrder: number;
};

export type CatalogPipeline = {
  name: string;
  nodes: CatalogNode[];
  edges: CatalogEdge[];
};

// ---------------------------------------------------------------------------
// 스타터 block_def 목록 (11개)
// ---------------------------------------------------------------------------
// 삽입 순서 의존: block_defs 먼저 삽입 → slug→id 맵 확보 → 문서/파이프라인 삽입.
// 파이프라인 노드의 mounts[].blockDefId는 이 순서로 해소된다.

export const STARTER_BLOCK_DEFS: CatalogBlockDef[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // tool (2개) — agent mounts에서 blockDefId로 참조되므로 먼저 선언한다.
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "canonical:tool:get_document",
    type: "tool",
    name: "문서 가져오기",
    description: "이름으로 문서를 조회해 전문을 반환하는 내장 도구.",
    config: {
      toolName: "get_document",
    },
  },
  {
    slug: "canonical:tool:search_documents",
    type: "tool",
    name: "문서 검색",
    description: "키워드로 문서 목록을 검색하는 내장 도구.",
    config: {
      toolName: "search_documents",
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // rule (3개)
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "canonical:rule:writing-guidelines",
    type: "rule",
    name: "작문 가이드",
    description:
      "이력서·커버레터·자기소개서 작성 보편 원칙: 증거 우선·수치 기반·한국어 어투.",
    config: {
      content: readSeed("rules/writing-guidelines.md"),
    },
  },
  {
    slug: "canonical:rule:feedback-rules",
    type: "rule",
    name: "소유자 스타일 원장",
    description:
      "소유자 피드백에서 일반화한 개인 선호 규칙(어투·문장·내용·구조). 작문 가이드보다 우선.",
    config: {
      content: readSeed("rules/feedback-rules.md"),
    },
  },
  {
    slug: "canonical:rule:ai-use-rules",
    type: "rule",
    name: "AI 사용 가드",
    description:
      "AI가 초안 생성 시 반드시 준수해야 할 팩트 규칙·민감 정보·금지 스택 목록.",
    config: {
      content: readSeed("rules/ai-use-rules.md"),
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // skill (2개)
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "canonical:skill:role-presets",
    type: "skill",
    name: "직무군 타겟팅",
    description:
      "직무군별(fe-platform·ai-product·fullstack·fintech·commerce·ax-harness) 타겟팅 프리셋 및 브리프 형식.",
    config: {
      // 공통 가드 섹션은 규칙(writing-guidelines·feedback-rules·ai-use-rules)에서
      // 커버되므로 skill content에는 방법론(프리셋·브리프 형식)만 포함한다.
      // 원문 전체를 그대로 사용하되, 공통 가드 항목은 ai-use-rules에 병합 완료.
      content: readSeed("skills/role-presets.md"),
    },
  },
  {
    slug: "canonical:skill:screen-profiles",
    type: "skill",
    name: "채점 루브릭",
    description:
      "recruiter-screen·tech-screen 채점 프리셋(Balanced·AI-Product·Platform-DS·Scale-Perf) 가중치 표 및 회사 블로커 정의.",
    config: {
      content: readSeed("skills/screen-profiles.md"),
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // agent (4개)
  // ─────────────────────────────────────────────────────────────────────────
  {
    slug: "canonical:agent:tailor",
    type: "agent",
    name: "tailor",
    description:
      "JD에 맞춰 기존 초안을 타겟팅하는 에이전트. 증거 선별·요건 매핑·타겟팅 브리프 승인 후 변형본 생성.",
    config: {
      role: stripFrontmatter(readSeed("agents/tailor.md")),
      outputFormat: "markdown",
      mounts: [
        // 직무군 타겟팅 프리셋 skill — 삽입 후 blockDefId로 해소
        { blockDefId: "__slug:canonical:skill:role-presets" },
      ],
    },
  },
  {
    slug: "canonical:agent:writer",
    type: "agent",
    name: "writer",
    description:
      "검증된 증거 기반으로 이력서·커버레터·자기소개서 초안을 작성하는 에이전트. 날조 없음.",
    config: {
      role: stripFrontmatter(readSeed("agents/writer.md")),
      outputFormat: "markdown",
      mounts: [
        { blockDefId: "__slug:canonical:rule:writing-guidelines" },
        { blockDefId: "__slug:canonical:rule:feedback-rules" },
        { blockDefId: "__slug:canonical:rule:ai-use-rules" },
        { blockDefId: "__slug:canonical:tool:get_document" },
        { blockDefId: "__slug:canonical:tool:search_documents" },
      ],
    },
  },
  {
    slug: "canonical:agent:recruiter-screen",
    type: "agent",
    name: "recruiter-screen",
    description:
      "인사담당자 관점에서 이력서 초안을 채점해 PASS/FAIL 판정과 JSON 결과를 반환하는 에이전트.",
    config: {
      role: stripFrontmatter(readSeed("agents/recruiter-screen.md")),
      outputFormat: "json",
      jsonSchema: JSON.stringify({
        total: "number",
        verdict: '"PASS" | "FAIL"',
        passBar: "number",
        blockers: "string[]",
      }),
      mounts: [
        { blockDefId: "__slug:canonical:skill:screen-profiles" },
      ],
    },
  },
  {
    slug: "canonical:agent:tech-screen",
    type: "agent",
    name: "tech-screen",
    description:
      "기술담당자(엔지니어링 매니저) 관점에서 이력서 초안을 채점해 PASS/FAIL 판정과 JSON 결과를 반환하는 에이전트.",
    config: {
      role: stripFrontmatter(readSeed("agents/tech-screen.md")),
      outputFormat: "json",
      jsonSchema: JSON.stringify({
        total: "number",
        verdict: '"PASS" | "FAIL"',
        passBar: "number",
        blockers: "string[]",
      }),
      mounts: [
        { blockDefId: "__slug:canonical:skill:screen-profiles" },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// 스타터 문서 목록 (5개)
// ---------------------------------------------------------------------------
// 삽입 후 name→id 맵을 확보해 Input 노드 config.documentId를 해소한다.

export const STARTER_DOCUMENTS: CatalogDocument[] = [
  {
    name: "현재 JD",
    content: `# 현재 JD

> 이 문서에 지원할 채용 공고 전문을 붙여넣으세요.
>
> 형식 제한 없음 — 회사명·포지션명·요구 역량·우대 사항·회사 소개를 그대로
> 붙여넣으면 됩니다.
>
> 안정 이름 규약: 이 문서 이름("현재 JD")을 바꾸지 마세요. 파이프라인의
> "현재 JD" Input 노드가 이 이름으로 문서를 참조합니다(nodes.md §3 M5).

---

(채용 공고를 여기에 붙여넣으세요)
`,
  },
  {
    name: "지원자 프로필",
    content: readSeed("documents/profile.md"),
  },
  {
    name: "경험 뱅크",
    content: readSeed("documents/experience-bank.md"),
  },
  {
    name: "지표 레지스트리",
    content: readSeed("documents/metric-registry.md"),
  },
  {
    name: "정본 문장 뱅크",
    content: readSeed("documents/canonical-lines.md"),
  },
];

// ---------------------------------------------------------------------------
// 표준 파이프라인 (노드 10개 + 엣지)
// ---------------------------------------------------------------------------
//
// 노드명 ↔ Gate expr 정합:
//   - Gate expr: `recruiter-screen.verdict == "PASS" && tech-screen.verdict == "PASS"`
//   - 채점 노드 name: "recruiter-screen", "tech-screen" — expr 접두와 정확히 일치.
//
// 삽입 순서:
//   1. blockDefSlug "__slug:<slug>" → id 해소
//   2. config.documentName → documentId 해소
//   3. config.failTargetNodeName → failTargetNodeId 해소 (Gate)

export const STARTER_PIPELINE: CatalogPipeline = {
  name: "my-recruit 표준 파이프라인",
  nodes: [
    // ── 입력 노드 3개 ──────────────────────────────────────────────────────
    {
      type: "input",
      name: "현재 JD",
      positionX: 100,
      positionY: 50,
      blockDefSlug: null,
      config: {
        // provision.ts가 문서 이름 "현재 JD"를 documentId로 해소한다.
        documentName: "현재 JD",
      },
    },
    {
      type: "input",
      name: "지원자 프로필",
      positionX: 350,
      positionY: 50,
      blockDefSlug: null,
      config: {
        documentName: "지원자 프로필",
      },
    },
    {
      type: "input",
      name: "경험 뱅크",
      positionX: 600,
      positionY: 50,
      blockDefSlug: null,
      config: {
        documentName: "경험 뱅크",
      },
    },

    // ── 에이전트 노드 4개 ──────────────────────────────────────────────────
    {
      type: "agent",
      name: "tailor",
      positionX: 350,
      positionY: 250,
      blockDefSlug: "canonical:agent:tailor",
      config: {},
    },
    {
      type: "agent",
      name: "writer",
      positionX: 350,
      positionY: 450,
      blockDefSlug: "canonical:agent:writer",
      config: {},
    },
    {
      // 노드 name이 Gate expr의 "recruiter-screen" 접두와 정확히 일치
      type: "agent",
      name: "recruiter-screen",
      positionX: 150,
      positionY: 650,
      blockDefSlug: "canonical:agent:recruiter-screen",
      config: {},
    },
    {
      // 노드 name이 Gate expr의 "tech-screen" 접두와 정확히 일치
      type: "agent",
      name: "tech-screen",
      positionX: 550,
      positionY: 650,
      blockDefSlug: "canonical:agent:tech-screen",
      config: {},
    },

    // ── Gate ───────────────────────────────────────────────────────────────
    {
      type: "gate",
      name: "관문",
      positionX: 350,
      positionY: 850,
      blockDefSlug: null,
      config: {
        // expr의 접두("recruiter-screen", "tech-screen")가 해당 노드 name과 일치.
        expr: 'recruiter-screen.verdict == "PASS" && tech-screen.verdict == "PASS"',
        maxLoops: 3,
        // provision.ts가 노드 name "writer"를 failTargetNodeId로 해소한다.
        failTargetNodeName: "writer",
      },
    },

    // ── Human ──────────────────────────────────────────────────────────────
    {
      type: "human",
      name: "내 검토",
      positionX: 350,
      positionY: 1050,
      blockDefSlug: null,
      config: {
        instruction: "채점 통과 초안을 검토하고 필요한 수정 후 승인하세요.",
        allowEdit: true,
      },
    },

    // ── Output ─────────────────────────────────────────────────────────────
    {
      type: "output",
      name: "완성본",
      positionX: 350,
      positionY: 1250,
      blockDefSlug: null,
      config: {
        templateId: "default",
      },
    },
  ],

  edges: [
    // 입력 → tailor
    { sourceNodeName: "현재 JD",     targetNodeName: "tailor",           kind: "flow", sourceHandle: null, inputOrder: 0 },
    { sourceNodeName: "지원자 프로필", targetNodeName: "tailor",          kind: "flow", sourceHandle: null, inputOrder: 1 },
    { sourceNodeName: "경험 뱅크",    targetNodeName: "tailor",          kind: "flow", sourceHandle: null, inputOrder: 2 },

    // tailor → writer (사실 직접 공급 위해 프로필·경험뱅크도 writer에 배선)
    { sourceNodeName: "tailor",        targetNodeName: "writer",          kind: "flow", sourceHandle: null, inputOrder: 0 },
    { sourceNodeName: "지원자 프로필", targetNodeName: "writer",          kind: "flow", sourceHandle: null, inputOrder: 1 },
    { sourceNodeName: "경험 뱅크",    targetNodeName: "writer",          kind: "flow", sourceHandle: null, inputOrder: 2 },

    // writer → 채점기 2개 (초안 입력)
    { sourceNodeName: "writer",        targetNodeName: "recruiter-screen", kind: "flow", sourceHandle: null, inputOrder: 0 },
    { sourceNodeName: "writer",        targetNodeName: "tech-screen",      kind: "flow", sourceHandle: null, inputOrder: 0 },

    // writer + 채점기 2개 → 관문 (초안 passthrough + JSON 채점)
    { sourceNodeName: "writer",        targetNodeName: "관문",            kind: "flow", sourceHandle: null, inputOrder: 0 },
    { sourceNodeName: "recruiter-screen", targetNodeName: "관문",         kind: "flow", sourceHandle: null, inputOrder: 1 },
    { sourceNodeName: "tech-screen",   targetNodeName: "관문",            kind: "flow", sourceHandle: null, inputOrder: 2 },

    // 관문 pass → 내 검토, 관문 fail → writer (failTargetNodeId와 일치)
    { sourceNodeName: "관문",          targetNodeName: "내 검토",         kind: "flow", sourceHandle: "pass", inputOrder: 0 },
    { sourceNodeName: "관문",          targetNodeName: "writer",          kind: "flow", sourceHandle: "fail", inputOrder: 0 },

    // 내 검토 → 완성본
    { sourceNodeName: "내 검토",       targetNodeName: "완성본",          kind: "flow", sourceHandle: null, inputOrder: 0 },
  ],
};

// ---------------------------------------------------------------------------
// 레거시 내보내기 (provision.ts 기존 참조 호환)
// ---------------------------------------------------------------------------
/** @deprecated STARTER_DOCUMENTS[0]~[4]를 직접 사용하라. 호환용 별칭. */
export const STARTER_EVIDENCE_DOCUMENT: CatalogDocument = STARTER_DOCUMENTS[1];
/** @deprecated STARTER_BLOCK_DEFS를 직접 사용하라. 호환용 별칭. */
export { STARTER_BLOCK_DEFS as STARTER_BLOCK_DEFS_LEGACY };
