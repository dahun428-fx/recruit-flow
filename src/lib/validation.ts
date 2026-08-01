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

  // 유효한 엣지만(양 끝 노드가 실재) 인접 리스트로. flow(데이터 흐름)와
  // mount(장착)를 분리 — 위상·join·마크다운 판정은 flow만, 배선 제약은 별도.
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const n of nodes) {
    incoming.set(n.id, []);
    outgoing.set(n.id, []);
  }
  const mountEdges: EdgeRow[] = [];
  for (const e of edges) {
    if (!nodeById.has(e.sourceNodeId) || !nodeById.has(e.targetNodeId)) {
      continue; // 끊긴 엣지는 무시(그래프 저장 정합성은 별개)
    }
    if (e.kind === "mount") {
      mountEdges.push(e);
      continue;
    }
    // Gate fail 엣지는 재실행 라우팅(역방향 back-edge) — 전방 데이터 흐름이 아니다.
    // 위상·사이클·입력 판정에서 제외(러너 flowUpstream과 동일 규약, nodes.md Q13).
    if (e.sourceHandle === "fail") continue;
    outgoing.get(e.sourceNodeId)!.push(e.targetNodeId);
    incoming.get(e.targetNodeId)!.push(e.sourceNodeId);
  }

  // 노드별 mount 차수(고아 판정·배선 제약).
  const mountDegree = new Map<string, number>();
  for (const n of nodes) mountDegree.set(n.id, 0);
  for (const e of mountEdges) {
    mountDegree.set(e.sourceNodeId, (mountDegree.get(e.sourceNodeId) ?? 0) + 1);
    mountDegree.set(e.targetNodeId, (mountDegree.get(e.targetNodeId) ?? 0) + 1);
  }

  // --- 1. 고아 노드: 노드가 2개 이상인데 flow·mount 연결이 전혀 없는 노드.
  if (nodes.length > 1) {
    for (const n of nodes) {
      const deg =
        (incoming.get(n.id)?.length ?? 0) +
        (outgoing.get(n.id)?.length ?? 0) +
        (mountDegree.get(n.id) ?? 0);
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

  // --- 5. mount 배선 제약: source=장착 노드(skill/rule/tool), target=Agent.
  for (const e of mountEdges) {
    const src = nodeById.get(e.sourceNodeId);
    const tgt = nodeById.get(e.targetNodeId);
    const srcOk = !!src && MOUNT_NODE_TYPES.includes(src.type);
    const tgtOk = !!tgt && tgt.type === "agent";
    if (!srcOk || !tgtOk) {
      errors.push({
        code: "mount_wiring",
        nodeId: e.sourceNodeId,
        message: `장착(점선) 엣지는 skill/rule/tool → agent만 허용됩니다.`,
      });
    }
  }
  // 실행 노드끼리 mount로 잇거나, 장착 노드가 flow로 이어진 경우도 배선 위반.
  for (const n of nodes) {
    if (!MOUNT_NODE_TYPES.includes(n.type)) continue;
    const flowDeg =
      (incoming.get(n.id)?.length ?? 0) + (outgoing.get(n.id)?.length ?? 0);
    if (flowDeg > 0) {
      errors.push({
        code: "mount_wiring",
        nodeId: n.id,
        message: `장착 노드 "${n.name}"는 실선(flow)으로 연결할 수 없습니다(점선 장착만).`,
      });
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
