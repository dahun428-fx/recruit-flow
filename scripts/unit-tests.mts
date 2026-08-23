// 순수 로직 단위 테스트 — DB·서버·LLM 없이 실행(감사 R2, 2026-08-23).
// 폐기된 스모크(smoke-engine의 gate 파서 케이스)를 흡수하고, e2e 스텁이 우회하는
// 실사용 최빈 실패모드(채점 JSON 파싱·1회 재시도)를 직접 검증한다.
// 실행: npm run test:unit  (e2e-heal 재검증 게이트에도 포함)

import { readFileSync } from "node:fs";
import path from "node:path";
import { evaluateGate, buildGateContext } from "../src/lib/engine/gate";
import {
  parseJsonLoose,
  runAgentJson,
  type RunAgentParams,
  type RunAgentResult,
} from "../src/lib/engine/sdk";

let pass = 0;
let fail = 0;
const failures: string[] = [];
function check(label: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    failures.push(`${label}${detail ? " — " + detail : ""}`);
    console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`);
  }
}

// ===========================================================================
// 1) parseJsonLoose — 코드펜스·잡텍스트 관용 파싱
// ===========================================================================
function testParseJsonLoose() {
  console.log("\n[1] parseJsonLoose");
  check("순수 JSON 객체", (parseJsonLoose('{"total": 85}') as { total: number }).total === 85);
  check("순수 JSON 배열", Array.isArray(parseJsonLoose("[1,2,3]")));
  check(
    "```json 코드펜스 벗김",
    (parseJsonLoose('앞말\n```json\n{"verdict":"PASS"}\n```\n뒷말') as { verdict: string })
      .verdict === "PASS",
  );
  check(
    "언어표기 없는 ``` 펜스",
    (parseJsonLoose('```\n{"a":1}\n```') as { a: number }).a === 1,
  );
  check(
    "앞뒤 산문 속 JSON 추출",
    (parseJsonLoose('채점 결과는 다음과 같습니다: {"total": 70, "issues": []} 이상입니다.') as {
      total: number;
    }).total === 70,
  );
  let threw = false;
  try {
    parseJsonLoose("JSON이 전혀 없는 문장");
  } catch {
    threw = true;
  }
  check("JSON 부재 시 throw", threw);
}

// ===========================================================================
// 2) runAgentJson — 스키마 힌트 주입 + 파싱 실패 1회 재시도(nodes.md Q12)
// ===========================================================================
type Stub = (p: RunAgentParams) => Promise<RunAgentResult>;
const g = globalThis as unknown as { __recruitFlowAgentStub?: Stub };

async function testRunAgentJson() {
  console.log("\n[2] runAgentJson — JSON 강제·1회 재시도");

  // (a) 1차 성공 — 스키마 힌트가 system·user 양쪽 말미에 주입되는가.
  let seen: RunAgentParams[] = [];
  g.__recruitFlowAgentStub = async (p) => {
    seen.push(p);
    return { text: '{"total": 88}' };
  };
  const ok = await runAgentJson({
    systemPrompt: "ROLE",
    userPrompt: "INPUT",
    jsonSchema: "{total:number}",
  });
  check("1차 성공: parsed", (ok.parsed as { total: number }).total === 88);
  check("1차 성공: 호출 1회", seen.length === 1);
  check(
    "스키마 힌트 system 주입",
    seen[0].systemPrompt.includes("{total:number}") && seen[0].systemPrompt.startsWith("ROLE"),
  );
  check("스키마 힌트 user 주입", seen[0].userPrompt.includes("{total:number}"));

  // (b) 1차 파싱 실패 → 파싱 에러 피드백 포함 재시도 → 2차 성공.
  seen = [];
  let call = 0;
  g.__recruitFlowAgentStub = async (p) => {
    seen.push(p);
    call++;
    return call === 1
      ? { text: "점수는 여든다섯 점입니다" } // JSON 아님
      : { text: '```json\n{"total": 85}\n```' }; // 펜스째 파싱돼야 함
  };
  const retried = await runAgentJson({
    systemPrompt: "ROLE",
    userPrompt: "INPUT",
    jsonSchema: "{total:number}",
  });
  check("재시도 후 성공: parsed", (retried.parsed as { total: number }).total === 85);
  check("재시도: 호출 2회", seen.length === 2);
  check(
    "재시도 프롬프트에 파싱 실패 피드백",
    seen[1].userPrompt.includes("## 재시도") &&
      seen[1].userPrompt.includes("JSON으로 파싱"),
  );
  check("normalizeJson: 정렬된 text 반환", JSON.parse(retried.text).total === 85);

  // (c) 2회 연속 실패 → throw(노드 실패로 격리될 경로).
  g.__recruitFlowAgentStub = async () => ({ text: "여전히 JSON 아님" });
  let threw = false;
  try {
    await runAgentJson({ systemPrompt: "R", userPrompt: "I" });
  } catch {
    threw = true;
  }
  check("2연속 파싱 실패 → throw", threw);

  delete g.__recruitFlowAgentStub;
}

// ===========================================================================
// 3) evaluateGate / buildGateContext — 조건식 파서 (폐기 스모크 [f] 흡수)
// ===========================================================================
function testGateParser() {
  console.log("\n[3] evaluateGate — 조건식 파서(eval 미사용)");
  const two = buildGateContext([
    { nodeName: "a", artifact: { id: "x", nodeRunId: "x", format: "json", content: JSON.stringify({ total: 85, verdict: "PASS", issues: [] }) } },
    { nodeName: "b", artifact: { id: "y", nodeRunId: "y", format: "json", content: JSON.stringify({ total: 90, verdict: "PASS", issues: ["x"] }) } },
  ]);
  const single = buildGateContext([
    { nodeName: "only", artifact: { id: "z", nodeRunId: "z", format: "json", content: JSON.stringify({ score: 70, verdict: "FAIL", issues: ["a", "b"] }) } },
  ]);

  check("a.total >= 80 && b.total >= 80 → true", evaluateGate("a.total >= 80 && b.total >= 80", two) === true);
  check("a.total >= 80 && b.total >= 95 → false", evaluateGate("a.total >= 80 && b.total >= 95", two) === false);
  check('단일 출처 평탄화: verdict == "PASS" (FAIL) → false', evaluateGate('verdict == "PASS"', single) === false);
  const singlePass = buildGateContext([
    { nodeName: "only", artifact: { id: "z2", nodeRunId: "z2", format: "json", content: JSON.stringify({ verdict: "PASS" }) } },
  ]);
  check('단일 출처: verdict == "PASS" → true', evaluateGate('verdict == "PASS"', singlePass) === true);
  check("issues.length == 0 (2건) → false", evaluateGate("issues.length == 0", single) === false);
  const noIssues = buildGateContext([
    { nodeName: "only", artifact: { id: "z3", nodeRunId: "z3", format: "json", content: JSON.stringify({ issues: [] }) } },
  ]);
  check("issues.length == 0 (빈 배열) → true", evaluateGate("issues.length == 0", noIssues) === true);
  check("괄호+부정 !(a.total < 80) → true", evaluateGate("!(a.total < 80)", two) === true);
  check("|| 단락: a.total>=99 || b.total>=80 → true", evaluateGate("a.total >= 99 || b.total >= 80", two) === true);
  check('문자열 비교 b.verdict != "FAIL" → true', evaluateGate('b.verdict != "FAIL"', two) === true);
  check("score >= 80 → false (70)", evaluateGate("score >= 80", single) === false);

  // eval 미사용 증명: 소스 검사 + 위험 표현은 파서 에러로 격리.
  const gateSrc = readFileSync(
    path.join(process.cwd(), "src", "lib", "engine", "gate.ts"),
    "utf8",
  );
  check(
    "gate.ts에 eval()/new Function 없음",
    !/[^A-Za-z_.]eval\s*\(/.test(gateSrc) && !/new\s+Function/.test(gateSrc),
  );
  let threw = false;
  try {
    evaluateGate("process.exit(1)", two);
  } catch {
    threw = true;
  }
  check("위험 표현(process.exit)은 파서 에러", threw);
}

// ===========================================================================
async function main() {
  testParseJsonLoose();
  await testRunAgentJson();
  testGateParser();

  console.log(`\n===== 단위 테스트: PASS ${pass} / FAIL ${fail} =====`);
  if (fail > 0) {
    for (const f of failures) console.log("  - " + f);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("단위 테스트 크래시:", e);
  process.exit(2);
});
