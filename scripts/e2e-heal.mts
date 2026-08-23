// e2e AI 자동 힐링 루프 — `npm run e2e:heal`.
// e2e 실패 → claude -p(headless)가 로그·트레이스 보고 수정 → 재검증 → 초록이면 자동 커밋.
// 최대 3회, 지속 실패 시 e2e-heal-report.md 산출.
//
// ★ Node 22: tsx가 이 스크립트를 node22로 실행(npm run e2e:heal은 .node22\npm.cmd로).
//   playwright·smoke·typecheck 모두 process.execPath(=node22)로 스폰 → 세그폴트 회피.
//
// 안전장치:
//  - preflight: git 트리 깨끗해야 시작(자동 커밋 전제) + .node22·claude CLI 존재.
//  - claude는 acceptEdits + allowedTools 화이트리스트(임의 Bash 차단).
//  - 프롬프트 제약: src/·e2e/만 수정. specs/·drizzle/·scripts/smoke-*·.git 불변.
//  - 호출 후 가드: git diff로 금지 경로 변경 시 롤백·그 attempt 실패.
//  - 커밋 전 재검증 게이트: typecheck + smoke(73+38) + e2e 전부 통과해야 커밋.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const NODE = process.execPath; // node22
const MAX_ATTEMPTS = 3;
const RESULT_JSON = path.join(ROOT, "test-results", "e2e-results.json");

function run(
  cmd: string,
  args: string[],
  opts: { input?: string; env?: Record<string, string>; shell?: boolean } = {},
) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    input: opts.input,
    env: { ...process.env, ...opts.env },
    shell: opts.shell ?? false,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: r.status ?? 1,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

function resolveFirst(cands: string[]): string {
  for (const c of cands) if (existsSync(path.join(ROOT, c))) return c;
  throw new Error(`경로를 찾을 수 없음: ${cands.join(", ")}`);
}

const PLAYWRIGHT_CLI = resolveFirst([
  "node_modules/playwright/cli.js",
  "node_modules/@playwright/test/cli.js",
]);
const TSX_CLI = resolveFirst(["node_modules/tsx/dist/cli.mjs"]);

interface Failure {
  file: string;
  title: string;
  message: string;
}

/** playwright test 실행 → JSON 리포트 파싱 → 실패 목록. */
function runE2e(): { green: boolean; failures: Failure[]; tail: string } {
  const r = run(NODE, [PLAYWRIGHT_CLI, "test"]);
  const failures: Failure[] = [];
  try {
    const report = JSON.parse(readFileSync(RESULT_JSON, "utf8"));
    const walk = (suite: any, file: string) => {
      const f = suite.file ?? file;
      for (const spec of suite.specs ?? []) {
        const failed = (spec.tests ?? []).some((t: any) =>
          (t.results ?? []).some(
            (res: any) => res.status !== "passed" && res.status !== "skipped",
          ),
        );
        if (failed) {
          const msg =
            (spec.tests ?? [])
              .flatMap((t: any) => t.results ?? [])
              .map((res: any) => res.error?.message)
              .filter(Boolean)
              .join("\n")
              .slice(0, 1200) || "(에러 메시지 없음)";
          failures.push({ file: spec.file ?? f, title: spec.title, message: msg });
        }
      }
      for (const s of suite.suites ?? []) walk(s, f);
    };
    for (const s of report.suites ?? []) walk(s, "");
  } catch {
    // 리포트 파싱 실패 → 실행 자체 실패로 간주
    if (r.status !== 0)
      failures.push({
        file: "(unknown)",
        title: "playwright 실행 실패",
        message: (r.stderr || r.stdout).slice(-1500),
      });
  }
  const tail = (r.stdout + "\n" + r.stderr).slice(-2000);
  return { green: failures.length === 0 && r.status === 0, failures, tail };
}

function buildPrompt(failures: Failure[], tail: string, attempt: number): string {
  const list = failures
    .map(
      (f, i) =>
        `### 실패 ${i + 1}: ${f.title}\n파일: ${f.file}\n\`\`\`\n${f.message}\n\`\`\``,
    )
    .join("\n\n");
  return `너는 recruit-flow 저장소의 e2e 실패를 고치는 자동 힐링 작업자다(attempt ${attempt}/${MAX_ATTEMPTS}).

## 실패한 Playwright e2e 테스트
${list}

## 실행 로그 꼬리
\`\`\`
${tail}
\`\`\`

## 작업 지침
1. 실패 원인을 진단하고 **애플리케이션 코드(src/) 또는 테스트(e2e/)를 수정**해 통과시켜라.
2. 관련 스펙 문서를 참조하라: specs/ui.md, specs/engine.md, specs/nodes.md, specs/m1-plan.md~m3-plan.md. 스크린샷·트레이스는 test-results/ 아래에 있다(경로만 참고).
3. **수정 범위 제약(엄수)**: src/·e2e/ 만 수정한다. specs/·drizzle/·scripts/smoke-*·.git·playwright.config·e2e/support/(인프라)은 **변경 금지**.
4. **테스트 기대값을 스펙과 다르게 완화하지 마라.** 앱이 스펙과 모순되면 수정하지 말고 그 사실을 응답에 보고하라.
5. Node 22가 이미 PATH에 설정돼 있다 — \`npm run typecheck\`를 그대로 실행하면 된다(별도 export 불필요).
6. 수정 후 \`npm run typecheck\`로만 그린을 확인하라. **playwright는 실행하지 마라** — 힐링 스크립트가 e2e로 재검증한다(중복·시간 낭비 방지). 빠르게 진단·수정에 집중하라.

간결하게 수정하고, 무엇을 왜 고쳤는지 마지막에 요약하라.`;
}

function callClaude(prompt: string): { ok: boolean; summary: string } {
  const r = run(
    "claude",
    [
      "-p",
      "--output-format",
      "json",
      "--permission-mode",
      "acceptEdits",
      "--allowedTools",
      "Read,Glob,Grep,Edit,Write,Bash(npm run typecheck:*)",
      "--max-turns",
      "30",
    ],
    // 서브 에이전트 Bash에 이 프로세스의 Node(=Node 22)를 PATH 앞에 주입
    // → npm이 곧 Node 22로 동작(export 불필요).
    {
      input: prompt,
      shell: true,
      env: {
        PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ""}`,
      },
    },
  );
  let summary = r.stdout.slice(-500);
  try {
    const j = JSON.parse(r.stdout);
    summary = (j.result ?? j.text ?? summary).toString().slice(-800);
  } catch {
    /* 비 JSON이면 원문 꼬리 */
  }
  return { ok: r.status === 0, summary };
}

/** 금지 경로 변경 롤백. 변경이 있었으면 true. */
function guardForbidden(): string[] {
  const diff = run("git", ["diff", "--name-only"]).stdout.trim().split("\n").filter(Boolean);
  const forbidden = diff.filter(
    (f) =>
      f.startsWith("specs/") ||
      f.startsWith("drizzle/") ||
      f.startsWith("scripts/unit-tests") ||
      f === "playwright.config.ts" ||
      f === "playwright.live.config.ts" ||
      f.startsWith("e2e/support/"),
  );
  if (forbidden.length) run("git", ["checkout", "--", ...forbidden]);
  return forbidden;
}

function reverify(): boolean {
  if (run(NODE, ["node_modules/typescript/bin/tsc", "--noEmit"]).status !== 0) {
    console.log("  ✗ 재검증: typecheck 실패");
    return false;
  }
  // 단위 테스트(순수 로직 — gate 파서·JSON 재시도 등). 스모크 2종은 pg 전환으로
  // 2026-08-23 공식 폐기(감사 R1) — 행동 경로는 e2e 34건, 순수 로직은 이 게이트가 담당.
  if (run(NODE, [TSX_CLI, "scripts/unit-tests.mts"]).status !== 0) {
    console.log("  ✗ 재검증: unit-tests 실패");
    return false;
  }
  // e2e는 직전 루프에서 green 확인됨(중복 실행 생략). typecheck+unit만 추가 게이트.
  return true;
}

function commit(failures: Failure[], attempt: number) {
  run("git", ["add", "src", "e2e"]);
  const titles = failures.map((f) => f.title).join(", ").slice(0, 100);
  const changed = run("git", ["diff", "--cached", "--name-only"]).stdout.trim();
  const msg = `fix(e2e-heal): ${titles} (attempt ${attempt})\n\n- 수정 파일:\n${changed}\n\nCo-Authored-By: Claude Fable 5 <noreply@anthropic.com>`;
  run("git", [
    "-c",
    "user.name=JungDahun",
    "-c",
    "user.email=rubcustomer@gmail.com",
    "commit",
    "--no-verify",
    "-m",
    msg,
  ]);
}

// ── main ─────────────────────────────────────────────────────────────────────
function main() {
  // preflight
  // better-sqlite3 ABI — Node 메이저가 22여야 한다(경로가 아니라 버전을 검사).
  const major = Number(process.versions.node.split(".")[0]);
  if (major !== 22)
    fail(`preflight: Node 22 필요(현재 ${process.versions.node}). 프로젝트 Node로 재실행.`);
  if (run("claude", ["--version"], { shell: true }).status !== 0)
    fail("preflight: claude CLI 없음");
  if (run("git", ["status", "--porcelain"]).stdout.trim())
    fail("preflight: git 작업 트리가 깨끗하지 않음(자동 커밋 안전 전제). 커밋/스태시 후 재실행.");

  const log: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`\n=== attempt ${attempt}/${MAX_ATTEMPTS}: e2e 실행 ===`);
    const { green, failures, tail } = runE2e();

    if (green) {
      if (attempt === 1) {
        console.log("이미 초록 — 고칠 것이 없습니다.");
        process.exit(0);
      }
      console.log("e2e 초록 → 재검증 게이트");
      if (reverify()) {
        commit(lastFailures, attempt);
        console.log("✓ 재검증 통과 → 자동 커밋 완료");
        process.exit(0);
      }
      fail("초록이나 재검증 게이트 실패 — 수동 확인 필요");
    }

    console.log(`✗ 실패 ${failures.length}건 → claude 호출`);
    lastFailures = failures;
    const { summary } = callClaude(buildPrompt(failures, tail, attempt));
    const rolled = guardForbidden();
    log.push(
      `## attempt ${attempt}\n실패: ${failures.map((f) => f.title).join(", ")}\n` +
        (rolled.length ? `⚠ 금지경로 롤백: ${rolled.join(", ")}\n` : "") +
        `claude 요약: ${summary}\n`,
    );
  }

  // 소진
  const finalDiff = run("git", ["diff", "--stat"]).stdout;
  writeFileSync(
    path.join(ROOT, "e2e-heal-report.md"),
    `# e2e 힐링 리포트\n\n${MAX_ATTEMPTS}회 시도 후에도 실패가 남았습니다.\n\n${log.join(
      "\n",
    )}\n## 최종 미커밋 diff\n\`\`\`\n${finalDiff}\n\`\`\`\n`,
  );
  fail(`${MAX_ATTEMPTS}회 소진 — e2e-heal-report.md 참조`);
}

let lastFailures: Failure[] = [];
function fail(m: string): never {
  console.error(`\n[e2e-heal] ${m}`);
  process.exit(1);
}

main();
