/**
 * import-my-recruit.ts
 * my-recruit 하네스 자산을 recruit-flow DB로 이관하는 1회성 시드 스크립트.
 *
 * 실행:
 *   export PATH="/c/workspaces/recruit-flow/.node22:$PATH"
 *   npx tsx scripts/import-my-recruit.ts [--source <경로>] [--db <경로>]
 *
 * 환경 변수:
 *   RECRUIT_FLOW_DB_PATH — DB 경로 오버라이드 (--db 보다 낮은 우선순위)
 *
 * 완전 idempotent: 재실행 시 block_defs는 name+type upsert, document는 name 중복 스킵.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

// ---------------------------------------------------------------------------
// CLI 인자 파싱
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    source: { type: "string", default: "C:\\workspaces2\\my-recruit" },
    db: { type: "string" },
  },
});

const SOURCE_DIR = args.source as string;
const AGENTS_DIR = path.join(SOURCE_DIR, ".claude", "agents");
const DOCS_DIR = path.join(SOURCE_DIR, "docs", "resume-reference");

// DB 경로: --db > RECRUIT_FLOW_DB_PATH > 기본값
const DB_PATH =
  (args.db as string | undefined) ||
  process.env.RECRUIT_FLOW_DB_PATH ||
  path.join(process.cwd(), "data", "recruit-flow.db");

// DB 경로를 환경변수로 주입해 client.ts가 같은 경로를 사용하게 함
process.env.RECRUIT_FLOW_DB_PATH = DB_PATH;

console.log(`[importer] source  : ${SOURCE_DIR}`);
console.log(`[importer] db      : ${DB_PATH}`);

// DB 디렉터리 생성
const DB_DIR = path.dirname(DB_PATH);
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// DB 클라이언트 & 쿼리 헬퍼 임포트 (동적 — DB_PATH 환경변수 주입 후)
// ---------------------------------------------------------------------------

// NOTE: Next.js App Router 전용 경로가 아닌 순수 TS 모듈이므로 직접 임포트.
// tsx가 TypeScript를 그대로 실행하므로 .ts 확장자 유지.

import Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "../src/lib/db/schema";

// ---------------------------------------------------------------------------
// 마이그레이션 자동 적용 (격리 DB 지원 — migrations 폴더 기준)
// ---------------------------------------------------------------------------

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

function ensureSchema(): void {
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const tempDb = drizzle(sqlite, { schema });
  try {
    migrate(tempDb, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("[importer] 스키마 확인/적용 완료");
  } catch (err) {
    // 이미 적용된 경우 migrate는 no-op이므로 오류면 진짜 오류
    console.error("[importer] 마이그레이션 실패:", err);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

// queries는 client.ts를 평가하면서 DB 커넥션을 즉시 연다. 반드시 위에서
// RECRUIT_FLOW_DB_PATH를 설정하고 스키마를 적용한 뒤 동적으로 불러와야
// --db 오버라이드가 실제 쿼리 커넥션에도 반영된다.
type Queries = typeof import("../src/lib/db/queries");
let createBlockDef: Queries["createBlockDef"];
let createDocument: Queries["createDocument"];
let listBlockDefs: Queries["listBlockDefs"];
let listDocuments: Queries["listDocuments"];

// ---------------------------------------------------------------------------
// 상수: 에이전트별 outputFormat 하드코딩 매핑
// ---------------------------------------------------------------------------

type OutputFormat = "markdown" | "json";

const OUTPUT_FORMAT_MAP: Record<string, OutputFormat> = {
  // json 출력 에이전트
  "recruiter-screen": "json",
  "tech-screen": "json",
  // markdown 출력 에이전트
  writer: "markdown",
  reviewer: "markdown",
  tailor: "markdown",
  ats: "markdown",
  archivist: "markdown",
  designer: "markdown",
  "headhunter-searchfirm": "markdown",
  "headhunter-startup": "markdown",
  "headhunter-techlead": "markdown",
  "portfolio-curator": "markdown",
  "portfolio-fact-checker": "markdown",
  "portfolio-story-reviewer": "markdown",
  "portfolio-synthesizer": "markdown",
  "portfolio-ux-reviewer": "markdown",
};

// json 에이전트에 주입할 채점 스키마
const SCORING_JSON_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    total: { type: "number" },
    verdict: { type: "string", enum: ["PASS", "FAIL"] },
    passBar: { type: "number" },
    blockers: { type: "array", items: { type: "string" } },
  },
  required: ["total", "verdict"],
});

const JSON_SCHEMA_ROLE_SUFFIX =
  "\n\n반드시 위 JSON 스키마 형태로만 출력하세요(total/verdict/passBar/blockers).";

// 파일시스템 접근 불가 헤더 (§8-C)
const FS_UNAVAILABLE_HEADER =
  "이 에이전트는 파일시스템에 접근할 수 없습니다. " +
  "입력은 `## 입력:` 섹션으로 주어지며, 문서는 장착된 get_document/search_documents tool로 접근하세요.";

// model 매핑
const MODEL_MAP: Record<string, string> = {
  opus: "claude-opus-4-8",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5",
};

// ---------------------------------------------------------------------------
// 프런트매터 파서 (YAML 미사용 — 필요한 키만 regex 파싱)
// ---------------------------------------------------------------------------

interface Frontmatter {
  name?: string;
  description?: string;
  tools?: string;
  model?: string;
}

function parseFrontmatter(src: string): { fm: Frontmatter; body: string } {
  const fmMatch = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!fmMatch) {
    return { fm: {}, body: src };
  }
  const fmRaw = fmMatch[1];
  const body = fmMatch[2];

  const fm: Frontmatter = {};

  const extract = (key: string): string | undefined => {
    const m = fmRaw.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return m ? m[1].trim() : undefined;
  };

  fm.name = extract("name");
  fm.description = extract("description");
  fm.tools = extract("tools");
  fm.model = extract("model");

  return { fm, body };
}

// ---------------------------------------------------------------------------
// 에이전트 파일 → block_def 임포트
// ---------------------------------------------------------------------------

let blockDefsCreated = 0;
let blockDefsUpdated = 0;

function importAgents(): void {
  if (!existsSync(AGENTS_DIR)) {
    console.warn(`[importer] 에이전트 디렉터리 없음: ${AGENTS_DIR}`);
    return;
  }

  const files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const filePath = path.join(AGENTS_DIR, file);
    const src = readFileSync(filePath, "utf-8");
    const { fm, body } = parseFrontmatter(src);

    const agentName = fm.name ?? path.basename(file, ".md");
    const description = buildDescription(agentName, fm.description);
    const outputFormat = OUTPUT_FORMAT_MAP[agentName] ?? "markdown";
    const modelRaw = (fm.model ?? "sonnet").toLowerCase();
    const model = resolveModel(modelRaw);

    // role = FS 불가 헤더 + 원문 본문 (경로 지시 원문 유지 — §8-C)
    let role = `${FS_UNAVAILABLE_HEADER}\n\n${body.trim()}`;

    // JSON 에이전트: role 말미에 스키마 안내 append
    if (outputFormat === "json") {
      role += JSON_SCHEMA_ROLE_SUFFIX;
    }

    const config: import("../src/lib/types").AgentConfig = {
      role,
      outputFormat,
      model,
      ...(outputFormat === "json" ? { jsonSchema: SCORING_JSON_SCHEMA } : {}),
    };

    const existing = listBlockDefs().find(
      (b) => b.name === agentName && b.type === "agent",
    );

    createBlockDef({
      type: "agent",
      name: agentName,
      description,
      config,
      origin: "import",
      enabled: true,
      tray: false,
    });

    if (existing) {
      blockDefsUpdated++;
      console.log(`  [갱신] block_def agent/${agentName}`);
    } else {
      blockDefsCreated++;
      console.log(`  [생성] block_def agent/${agentName}`);
    }
  }
}

/** designer는 Output 노드로 대체됨을 description에 명시 */
function buildDescription(name: string, raw?: string): string {
  if (!raw) return name;
  if (name === "designer") {
    return `${raw} [참고: recruit-flow에서는 Output 노드가 이 역할을 대체합니다. 이 블록은 참고용으로만 임포트됩니다.]`;
  }
  return raw;
}

/** "opus" → "claude-opus-4-8" 등. 미인식 시 원문 반환. */
function resolveModel(raw: string): string {
  // MODEL_MAP에 정확히 일치하는 키가 없으면 키워드 포함 여부로 추정
  if (MODEL_MAP[raw]) return MODEL_MAP[raw];
  for (const [key, val] of Object.entries(MODEL_MAP)) {
    if (raw.includes(key)) return val;
  }
  return raw; // 알 수 없는 모델은 원문 유지
}

// ---------------------------------------------------------------------------
// resume-reference/*.md → documents 임포트
// ---------------------------------------------------------------------------

let docsCreated = 0;
let docsSkipped = 0;

function importDocuments(): void {
  if (!existsSync(DOCS_DIR)) {
    console.warn(`[importer] 문서 디렉터리 없음: ${DOCS_DIR}`);
    return;
  }

  // 기존 문서 이름 목록 (중복 스킵용)
  const existingNames = new Set(listDocuments().map((d) => d.name));

  const files = readdirSync(DOCS_DIR).filter((f) => f.endsWith(".md"));

  for (const file of files) {
    const docName = file; // 파일명 그대로 (예: "profile.md")
    const filePath = path.join(DOCS_DIR, file);
    const content = readFileSync(filePath, "utf-8");

    if (existingNames.has(docName)) {
      docsSkipped++;
      console.log(`  [스킵]  document "${docName}" (이미 존재)`);
      continue;
    }

    createDocument(docName, content, "human");
    docsCreated++;
    console.log(`  [생성] document "${docName}"`);
  }
}

// ---------------------------------------------------------------------------
// 메인
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  ensureSchema();
  ({ createBlockDef, createDocument, listBlockDefs, listDocuments } =
    await import("../src/lib/db/queries"));

  console.log("\n=== 에이전트 임포트 ===");
  importAgents();

  console.log("\n=== 문서 임포트 ===");
  importDocuments();

  console.log("\n=== 완료 ===");
  console.log(
    `block_defs: 생성 ${blockDefsCreated}개 / 갱신 ${blockDefsUpdated}개`,
  );
  console.log(`documents : 생성 ${docsCreated}개 / 스킵 ${docsSkipped}개`);
}

void main().catch((error: unknown) => {
  console.error("[importer] 실패:", error);
  process.exit(1);
});
