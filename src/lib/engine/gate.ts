// Gate 노드 — 순수 라우터(아티팩트 없음, nodes.md Q13). 상류 JSON 필드로 판정.
// 조건식 평가기 = 자체 재귀하강 파서(eval 금지, m2-plan §8-A).
//
// 문법(우선순위 낮음→높음):
//   or      := and ( "||" and )*
//   and     := not ( "&&" not )*
//   not     := "!" not | comparison
//   comparison := additive ( ( ">=" | ">" | "<=" | "<" | "==" | "!=" ) additive )?
//   additive := primary                       (산술 없음 — 값 접근·리터럴만)
//   primary := number | string | boolean
//            | "(" or ")"
//            | path ( ".length" )?
//   path    := ident ( "." ident )*           (출처.필드 접근, JSON 1개면 필드만)
//
// 지원: 숫자/문자열/불린 리터럴, `출처.필드` 접근, 비교 6종, 논리 3종,
//       괄호, `.length`(문자열·배열), `verdict == "PASS"` 문자열 비교.

import type { Artifact } from "../types";

// ---------------------------------------------------------------------------
// 토크나이저
// ---------------------------------------------------------------------------

type TokKind =
  | "num"
  | "str"
  | "bool"
  | "ident"
  | "op"
  | "lparen"
  | "rparen"
  | "dot";

interface Token {
  kind: TokKind;
  value: string;
  pos: number;
}

const OPS = [">=", "<=", "==", "!=", "&&", "||", ">", "<", "!"];

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (c === "(") {
      tokens.push({ kind: "lparen", value: "(", pos: i });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ kind: "rparen", value: ")", pos: i });
      i++;
      continue;
    }
    if (c === ".") {
      tokens.push({ kind: "dot", value: ".", pos: i });
      i++;
      continue;
    }
    // 문자열 리터럴("..." 또는 '...')
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let str = "";
      while (j < n && src[j] !== quote) {
        if (src[j] === "\\" && j + 1 < n) {
          str += src[j + 1];
          j += 2;
        } else {
          str += src[j];
          j++;
        }
      }
      if (j >= n) throw new GateExprError(`문자열이 닫히지 않았습니다`, i);
      tokens.push({ kind: "str", value: str, pos: i });
      i = j + 1;
      continue;
    }
    // 숫자 리터럴
    if (c >= "0" && c <= "9") {
      let j = i;
      while (j < n && ((src[j] >= "0" && src[j] <= "9") || src[j] === ".")) {
        // 소수점은 뒤에 숫자가 이어질 때만 숫자에 포함(.length와 구분)
        if (src[j] === "." && !(j + 1 < n && src[j + 1] >= "0" && src[j + 1] <= "9")) {
          break;
        }
        j++;
      }
      tokens.push({ kind: "num", value: src.slice(i, j), pos: i });
      i = j;
      continue;
    }
    // 연산자
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      tokens.push({ kind: "op", value: op, pos: i });
      i += op.length;
      continue;
    }
    // 식별자(영문·숫자·_·-·유니코드 — 한글 출처 이름 허용)
    if (/[A-Za-z0-9_\-À-￿]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_\-À-￿]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (word === "true" || word === "false") {
        tokens.push({ kind: "bool", value: word, pos: i });
      } else {
        tokens.push({ kind: "ident", value: word, pos: i });
      }
      i = j;
      continue;
    }
    throw new GateExprError(`알 수 없는 문자 '${c}'`, i);
  }
  return tokens;
}

export class GateExprError extends Error {
  constructor(message: string, public readonly pos?: number) {
    super(message);
    this.name = "GateExprError";
  }
}

// ---------------------------------------------------------------------------
// 값 · 컨텍스트
// ---------------------------------------------------------------------------

type Scalar = number | string | boolean | null;

/** 출처 이름 → 파싱된 JSON 값. JSON 입력 1개면 필드 직접 접근을 위해 병합 컨텍스트도 만든다. */
export interface GateContext {
  /** 출처(노드 이름) → 파싱 JSON 값 */
  bySource: Record<string, unknown>;
  /** JSON 입력이 정확히 1개일 때 그 객체(필드 직접 접근용). */
  single: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// 파서(재귀하강) → AST 없이 즉시 평가
// ---------------------------------------------------------------------------

class Parser {
  private p = 0;
  constructor(private readonly toks: Token[], private readonly ctx: GateContext) {}

  parse(): boolean {
    const v = this.parseOr();
    if (this.p < this.toks.length) {
      throw new GateExprError(
        `조건식 끝에 남은 토큰: '${this.toks[this.p].value}'`,
        this.toks[this.p].pos,
      );
    }
    return toBool(v);
  }

  private peek(): Token | undefined {
    return this.toks[this.p];
  }

  private eatOp(value: string): boolean {
    const t = this.peek();
    if (t && t.kind === "op" && t.value === value) {
      this.p++;
      return true;
    }
    return false;
  }

  private parseOr(): Scalar {
    let left = this.parseAnd();
    while (this.eatOp("||")) {
      const right = this.parseAnd();
      left = toBool(left) || toBool(right);
    }
    return left;
  }

  private parseAnd(): Scalar {
    let left = this.parseNot();
    while (this.eatOp("&&")) {
      const right = this.parseNot();
      left = toBool(left) && toBool(right);
    }
    return left;
  }

  private parseNot(): Scalar {
    if (this.eatOp("!")) {
      return !toBool(this.parseNot());
    }
    return this.parseComparison();
  }

  private parseComparison(): Scalar {
    const left = this.parsePrimary();
    const t = this.peek();
    if (
      t &&
      t.kind === "op" &&
      [">=", ">", "<=", "<", "==", "!="].includes(t.value)
    ) {
      this.p++;
      const right = this.parsePrimary();
      return compare(t.value, left, right, t.pos);
    }
    return left;
  }

  private parsePrimary(): Scalar {
    const t = this.peek();
    if (!t) throw new GateExprError("조건식이 갑자기 끝났습니다");

    if (t.kind === "num") {
      this.p++;
      return Number(t.value);
    }
    if (t.kind === "str") {
      this.p++;
      return t.value;
    }
    if (t.kind === "bool") {
      this.p++;
      return t.value === "true";
    }
    if (t.kind === "lparen") {
      this.p++;
      const v = this.parseOr();
      const close = this.peek();
      if (!close || close.kind !== "rparen") {
        throw new GateExprError("괄호가 닫히지 않았습니다", t.pos);
      }
      this.p++;
      return v;
    }
    if (t.kind === "ident") {
      return this.parsePath();
    }
    throw new GateExprError(`예상치 못한 토큰 '${t.value}'`, t.pos);
  }

  /** ident ( "." ident )* — 마지막이 length면 .length 연산. */
  private parsePath(): Scalar {
    const parts: string[] = [];
    const first = this.peek()!;
    parts.push(first.value);
    this.p++;
    while (this.peek()?.kind === "dot") {
      this.p++;
      const next = this.peek();
      if (!next || next.kind !== "ident") {
        // .length 뒤 등 — ident 없으면 오류
        throw new GateExprError("'.' 뒤에 필드 이름이 필요합니다", first.pos);
      }
      parts.push(next.value);
      this.p++;
    }
    return this.resolvePath(parts, first.pos);
  }

  private resolvePath(parts: string[], pos: number): Scalar {
    // 마지막이 length면 length 연산으로 처리.
    let wantLength = false;
    if (parts.length >= 2 && parts[parts.length - 1] === "length") {
      wantLength = true;
      parts = parts.slice(0, -1);
    }

    // 루트 결정: bySource[parts[0]]가 있으면 출처 접근, 아니면 single에서 필드.
    let current: unknown;
    let rest: string[];
    if (Object.prototype.hasOwnProperty.call(this.ctx.bySource, parts[0])) {
      current = this.ctx.bySource[parts[0]];
      rest = parts.slice(1);
    } else if (this.ctx.single) {
      current = this.ctx.single;
      rest = parts;
    } else {
      throw new GateExprError(
        `조건식의 출처 '${parts[0]}'를 입력에서 찾을 수 없습니다`,
        pos,
      );
    }

    for (const key of rest) {
      if (current == null || typeof current !== "object") {
        throw new GateExprError(
          `필드 '${key}'에 접근할 수 없습니다(값이 객체가 아님)`,
          pos,
        );
      }
      current = (current as Record<string, unknown>)[key];
    }

    if (wantLength) {
      if (typeof current === "string" || Array.isArray(current)) {
        return current.length;
      }
      throw new GateExprError(".length는 문자열·배열에만 쓸 수 있습니다", pos);
    }

    return toScalar(current);
  }
}

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

function toScalar(v: unknown): Scalar {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") {
    return v;
  }
  // 객체/배열을 비교에 직접 못 씀 — 명확히 실패시킴.
  throw new GateExprError("객체·배열 값은 비교할 수 없습니다(.length 등 사용)");
}

function toBool(v: Scalar): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v.length > 0;
  return false;
}

function compare(op: string, l: Scalar, r: Scalar, pos: number): boolean {
  switch (op) {
    case "==":
      return l === r;
    case "!=":
      return l !== r;
    case ">=":
    case ">":
    case "<=":
    case "<": {
      if (typeof l !== "number" || typeof r !== "number") {
        throw new GateExprError(`'${op}'는 숫자 비교입니다`, pos);
      }
      if (op === ">=") return l >= r;
      if (op === ">") return l > r;
      if (op === "<=") return l <= r;
      return l < r;
    }
    default:
      throw new GateExprError(`알 수 없는 비교 연산 '${op}'`, pos);
  }
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

/** 상류 JSON 아티팩트들 → GateContext. JSON 입력 1개면 필드 직접 접근 허용. */
export function buildGateContext(
  inputs: { nodeName: string; artifact: Artifact }[],
): GateContext {
  const bySource: Record<string, unknown> = {};
  const jsonValues: Record<string, unknown>[] = [];
  for (const inp of inputs) {
    if (inp.artifact.format !== "json") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(inp.artifact.content);
    } catch {
      // 파싱 불가한 JSON은 건너뜀(판정 시 출처 미발견 오류로 표면화).
      continue;
    }
    bySource[inp.nodeName] = parsed;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      jsonValues.push(parsed as Record<string, unknown>);
    }
  }
  return {
    bySource,
    single: jsonValues.length === 1 ? jsonValues[0] : null,
  };
}

/**
 * 조건식 평가. true=pass, false=fail.
 * @throws GateExprError 파싱·평가 오류(러너가 Gate 노드 실패로 격리).
 */
export function evaluateGate(expr: string, ctx: GateContext): boolean {
  const trimmed = expr.trim();
  if (!trimmed) throw new GateExprError("조건식이 비어 있습니다");
  const toks = tokenize(trimmed);
  return new Parser(toks, ctx).parse();
}
