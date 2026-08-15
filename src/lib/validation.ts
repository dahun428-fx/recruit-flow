// run 시작 그래프 검증 — 순수 함수(런타임 의존 없음). UI·러너 공유.
// 출처: specs/nodes.md Q11/Q15, specs/m1-plan.md §검증, m2-plan §3.1.
// M1 규칙: 고아 노드, 사이클, Output 상류 마크다운 정확히 1개.
// M2 규칙: Gate 상류에 JSON 출력 노드 필요, Gate fail 핸들 배선, mount 배선 제약.

import { MOUNT_NODE_TYPES } from "./types";
import type { EdgeRow, NodeRow, ValidationError } from "./types";

/**
 * 실행 노드가 마크다운 아티팩트를 방출하는가(마크다운을 그대로 흘리는지).
 * - input: 항상 마크다운(문서 → 마크다운)
 * - output: HTML(마크다운 아님)
 * - agent: outputFormat === 'markdown'일 때만
 * - gate: 순수 라우터 — 상류 마크다운을 그대로 통과(상류에 마크다운이 있으면 전달)
 * - human: 주 입력(마크다운) 승인본을 통과
 */
function emitsMarkdown(node: NodeRow, upstreamEmitsMarkdown: boolean): boolean {
  if (node.type === "input") return true;
  if (node.type === "output") return false;
  if (node.type === "agent") {
    const format = (node.config as { outputFormat?: string }).outputFormat;
    return format === "markdown";
  }
  // gate/human: 순수 통과 — 상류가 마크다운을 냈으면 마크다운을 흘린다.
  if (node.type === "gate" || node.type === "human") return upstreamEmitsMarkdown;
  return false;
}

/** 실행 노드가 JSON 아티팩트를 방출하는가(Gate 상류 검사용). */
function emitsJson(node: NodeRow): boolean {
  if (node.type !== "agent") return false;
  return (node.config as { outputFormat?: string }).outputFormat === "json";
}

/**
 * 그래프 PUT **구조** 검증(engine.md §2). 문제 없으면 빈 배열.
 *
 * validateGraph(아래)는 run 시작 전 **의미** 검증이고, 이건 쓰기 시점의
 * 형태 검증이다. DB 제약 위반이 그대로 새어나가 500이 되는 것을 막는 게
 * 목적 — 위반은 전부 400 + 한국어 사유로 돌려준다.
 *
 * UI는 항상 완전한 그래프를 보내므로 영향받지 않는다. 스크립트·curl·
 * 임포터 등 API를 직접 호출하는 경로를 위한 방어선이다.
 */
export function validateGraphPayload(
  nodes: unknown,
  edges: unknown,
): string[] {
  const errors: string[] = [];
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return ["nodes와 edges는 배열이어야 합니다."];
  }

  const isNonEmptyString = (v: unknown): v is string =>
    typeof v === "string" && v.trim() !== "";

  const nodeIds = new Set<string>();
  nodes.forEach((raw, i) => {
    const n = raw as Record<string, unknown>;
    const where = `nodes[${i}]`;
    if (!n || typeof n !== "object") {
      errors.push(`${where}: 객체가 아닙니다.`);
      return;
    }
    for (const f of ["id", "type", "name"] as const) {
      if (!isNonEmptyString(n[f])) errors.push(`${where}.${f}: 비어 있지 않은 문자열이어야 합니다.`);
    }
    for (const f of ["positionX", "positionY"] as const) {
      if (typeof n[f] !== "number" || !Number.isFinite(n[f])) {
        errors.push(`${where}.${f}: 숫자여야 합니다.`);
      }
    }
    // config는 JSON 컬럼(NOT NULL) — null/undefined면 저장 시 제약 위반.
    if (n.config === undefined || n.config === null) {
      errors.push(`${where}.config: 필수입니다(빈 객체 {} 허용).`);
    }
    if (isNonEmptyString(n.id)) {
      if (nodeIds.has(n.id)) errors.push(`${where}.id: 중복된 노드 id '${n.id}'.`);
      nodeIds.add(n.id);
    }
  });

  const edgeIds = new Set<string>();
  edges.forEach((raw, i) => {
    const e = raw as Record<string, unknown>;
    const where = `edges[${i}]`;
    if (!e || typeof e !== "object") {
      errors.push(`${where}: 객체가 아닙니다.`);
      return;
    }
    for (const f of ["id", "sourceNodeId", "targetNodeId"] as const) {
      if (!isNonEmptyString(e[f])) errors.push(`${where}.${f}: 비어 있지 않은 문자열이어야 합니다.`);
    }
    if (isNonEmptyString(e.id)) {
      if (edgeIds.has(e.id)) errors.push(`${where}.id: 중복된 엣지 id '${e.id}'.`);
      edgeIds.add(e.id);
    }
    // edges에는 nodes FK가 없어 dangling edge가 조용히 저장된다.
    // validateGraph는 런타임에 이를 무시하므로 쓰기 시점에 드러낸다.
    for (const f of ["sourceNodeId", "targetNodeId"] as const) {
      const v = e[f];
      if (isNonEmptyString(v) && !nodeIds.has(v)) {
        errors.push(`${where}.${f}: 존재하지 않는 노드 '${v}'를 가리킵니다.`);
      }
    }
  });

  return errors;
}

/**
 * run 시작 전 그래프 검증. 문제 없으면 빈 배열.
 * M1은 실선(flow) 엣지만 존재한다고 가정.
 */
export function validateGraph(
  nodes: NodeRow[],
  edges: EdgeRow[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // 그래프가 비면 실행할 것이 없음 → 고아로 취급하지 않고 별도 메시지.
  if (nodes.length === 0) {
    errors.push({
      code: "orphan",
      message: "그래프가 비어 있습니다. 실행할 노드가 없습니다.",
    });
    return errors;
  }

  // 유효한 엣지만(양 끝 노드가 실재) flow 인접 리스트로. M4 재설계로 mount 엣지·
  // skill/rule/tool 노드는 폐기됐다(장착은 Agent config.mounts[] 칩) — 기존 데이터에
  // 남아 있을 수 있는 mount 엣지는 위상·고아 판정에서 조용히 무시한다(방어).
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const n of nodes) {
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  }
  for (const e of edges) {
    if (!nodeById.has(e.sourceNodeId) || !nodeById.has(e.targetNodeId)) {
      continue; // 끊긴 엣지는 무시(그래프 저장 정합성은 별개)
    }
    if (e.kind === "mount") continue; // 폐기된 장착 엣지 — 무시.
    // Gate fail 엣지는 재실행 라우팅(역방향 back-edge) — 전방 데이터 흐름이 아니다.
    // 위상·사이클·입력 판정에서 제외(러너 flowUpstream과 동일 규약, nodes.md Q13).
    if (e.sourceHandle === "fail") continue;
    outgoing.get(e.sourceNodeId)!.push(e.targetNodeId);
    incoming.get(e.targetNodeId)!.push(e.sourceNodeId);
  }

  // --- 1. 고아 노드: 노드가 2개 이상인데 flow 연결이 전혀 없는 노드.
  //   폐기된 장착 노드(skill/rule/tool)는 원래 flow가 없으므로 고아 검사에서 제외
  //   한다(기존 데이터에 남은 vestigial 노드가 run 시작을 막지 않도록 — 러너도
  //   이들을 실행 대상에서 건너뛴다).
  if (nodes.length > 1) {
    for (const n of nodes) {
      if (MOUNT_NODE_TYPES.includes(n.type)) continue;
      const deg =
        (incoming.get(n.id)?.length ?? 0) + (outgoing.get(n.id)?.length ?? 0);
      if (deg === 0) {
        errors.push({
          code: "orphan",
          nodeId: n.id,
          message: `노드 "${n.name}"가 어디에도 연결되지 않았습니다.`,
        });
      }
    }
  }

  // --- 2. 사이클: Kahn 위상 정렬로 잔여 노드 존재 여부 판정.
  const indeg = new Map<string, number>();
  for (const n of nodes) indeg.set(n.id, incoming.get(n.id)!.length);
  const queue: string[] = [];
  for (const [id, d] of indeg) if (d === 0) queue.push(id);
  let visited = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    visited++;
    for (const t of outgoing.get(id)!) {
      const d = indeg.get(t)! - 1;
      indeg.set(t, d);
      if (d === 0) queue.push(t);
    }
  }
  if (visited < nodes.length) {
    // 위상 정렬에서 소진되지 않은 노드 = 사이클 관여.
    const cyclic = nodes.filter((n) => (indeg.get(n.id) ?? 0) > 0);
    errors.push({
      code: "cycle",
      nodeId: cyclic[0]?.id,
      message: "그래프에 사이클이 있습니다. 순환 연결을 제거하세요.",
    });
  }

  // 위상 순서로 노드별 "마크다운 방출" 플래그 계산(gate/human 통과 반영).
  // 사이클이 없을 때만 신뢰(사이클이면 아래 위상 결과가 부분적일 수 있음).
  const emitsMd = new Map<string, boolean>();
  const order = topoOrder(nodes, incoming, outgoing);
  for (const id of order) {
    const node = nodeById.get(id)!;
    const ups = incoming.get(id) ?? [];
    const upMd = ups.some((u) => emitsMd.get(u) === true);
    emitsMd.set(id, emitsMarkdown(node, upMd));
  }

  // --- 3. Output 상류 마크다운 정확히 1개(JSON 상류는 무시).
  for (const n of nodes) {
    if (n.type !== "output") continue;
    const upstreamIds = incoming.get(n.id) ?? [];
    const markdownCount = upstreamIds.filter((id) => emitsMd.get(id) === true).length;
    if (markdownCount !== 1) {
      errors.push({
        code: "output_markdown_count",
        nodeId: n.id,
        message: `Output 노드 "${n.name}"의 마크다운 상류가 ${markdownCount}개입니다(정확히 1개여야 함).`,
      });
    }
  }

  // --- 4. Gate 상류에 JSON 출력 노드가 최소 1개(nodes.md Q11).
  for (const n of nodes) {
    if (n.type !== "gate") continue;
    const upstreamIds = incoming.get(n.id) ?? [];
    const hasJson = upstreamIds
      .map((id) => nodeById.get(id))
      .some((u) => !!u && emitsJson(u));
    if (!hasJson) {
      errors.push({
        code: "gate_json_upstream",
        nodeId: n.id,
        message: `Gate 노드 "${n.name}"의 상류에 JSON 출력 노드가 없습니다(판정 근거 필요).`,
      });
    }
    // Gate fail 핸들 배선 필수(fail 라우팅 대상이 있어야 루프 성립).
    const hasFailEdge = edges.some(
      (e) => e.kind !== "mount" && e.sourceNodeId === n.id && e.sourceHandle === "fail",
    );
    if (!hasFailEdge) {
      errors.push({
        code: "gate_missing_fail",
        nodeId: n.id,
        message: `Gate 노드 "${n.name}"에 fail 라우팅 엣지가 없습니다.`,
      });
    }
  }

  // --- 5. (폐기) mount 배선 제약. M4 재설계로 skill/rule/tool 노드·점선 mount
  //   엣지가 사라지고 장착은 Agent config.mounts[] 칩이 됐다(engine.md §1,
  //   nodes.md §7). 배선 규칙(mount_wiring)은 검사 대상이 없어져 제거한다.
  //   대신 각 Agent의 config.mounts가 참조하는 정의 id가 비어 있지 않은지만
  //   가볍게 검사한다(빈 blockDefId는 resolve 불가 → 장착 유실). 실재 여부까지는
  //   여기서 확인하지 않는다(검증은 순수 함수 — DB 조회 없음).
  for (const n of nodes) {
    if (n.type !== "agent") continue;
    const mounts = (n.config as { mounts?: { blockDefId?: string }[] }).mounts;
    if (!mounts) continue;
    for (const m of mounts) {
      if (typeof m.blockDefId !== "string" || m.blockDefId.trim() === "") {
        errors.push({
          code: "mount_wiring",
          nodeId: n.id,
          message: `Agent "${n.name}"에 정의 참조가 빈 장착이 있습니다.`,
        });
        break;
      }
    }
  }

  return errors;
}

/** flow 엣지 위상 정렬(Kahn). 사이클 노드는 뒤에 임의 순서로 붙인다. */
function topoOrder(
  nodes: NodeRow[],
  incoming: Map<string, string[]>,
  outgoing: Map<string, string[]>,
): string[] {
  const indeg = new Map<string, number>();
  for (const n of nodes) indeg.set(n.id, incoming.get(n.id)!.length);
  const q: string[] = [];
  for (const [id, d] of indeg) if (d === 0) q.push(id);
  const out: string[] = [];
  const seen = new Set<string>();
  while (q.length > 0) {
    const id = q.shift()!;
    out.push(id);
    seen.add(id);
    for (const t of outgoing.get(id)!) {
      const d = indeg.get(t)! - 1;
      indeg.set(t, d);
      if (d === 0) q.push(t);
    }
  }
  for (const n of nodes) if (!seen.has(n.id)) out.push(n.id);
  return out;
}
