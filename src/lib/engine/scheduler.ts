// 스케줄링 — 상류 없는 노드 큐 투입 + AND-join(nodes.md Q15, engine.md §스케줄링).
// 순수 함수: 스냅샷 그래프 + 완료 상태를 받아 다음에 큐잉할 노드 id를 계산.
// M1 동시 실행 한도 1(순차)은 러너 루프가 강제 — 여기선 준비된 노드 집합만 계산.

import type { EdgeRow, NodeRow } from "../types";

export interface GraphIndex {
  nodeById: Map<string, NodeRow>;
  /** targetNodeId → 상류 노드 id 목록(유효 엣지만). */
  upstream: Map<string, string[]>;
  /** sourceNodeId → 하류 노드 id 목록. */
  downstream: Map<string, string[]>;
}

/** 스냅샷 그래프를 인접 인덱스로. 끊긴 엣지(양 끝 노드 부재)는 무시. */
export function indexGraph(nodes: NodeRow[], edges: EdgeRow[]): GraphIndex {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const upstream = new Map<string, string[]>();
  const downstream = new Map<string, string[]>();
  for (const n of nodes) {
    upstream.set(n.id, []);
    downstream.set(n.id, []);
  }
  for (const e of edges) {
    if (!nodeById.has(e.sourceNodeId) || !nodeById.has(e.targetNodeId)) continue;
    upstream.get(e.targetNodeId)!.push(e.sourceNodeId);
    downstream.get(e.sourceNodeId)!.push(e.targetNodeId);
  }
  return { nodeById, upstream, downstream };
}

/** 상류 엣지가 전혀 없는 루트 노드 id들(초기 큐 투입 대상). */
export function rootNodeIds(index: GraphIndex): string[] {
  const roots: string[] = [];
  for (const [id, ups] of index.upstream) {
    if (ups.length === 0) roots.push(id);
  }
  return roots;
}

/**
 * AND-join: 노드의 모든 상류가 succeeded면 실행 준비 완료.
 * @param succeeded 완료(succeeded)된 노드 id 집합
 * @returns 준비됐지만 아직 처리 안 된 노드 id 목록
 */
export function readyNodeIds(
  index: GraphIndex,
  succeeded: Set<string>,
  alreadyHandled: Set<string>,
): string[] {
  const ready: string[] = [];
  for (const [id, ups] of index.upstream) {
    if (alreadyHandled.has(id)) continue;
    if (ups.length === 0) continue; // 루트는 초기 투입에서 처리
    if (ups.every((u) => succeeded.has(u))) ready.push(id);
  }
  return ready;
}

/**
 * 상류 중 하나라도 실패/스킵이면 이 노드는 실행 불가(스킵 대상).
 * @returns 스킵해야 하는(상류가 죽은) 노드 id 목록
 */
export function deadNodeIds(
  index: GraphIndex,
  failedOrSkipped: Set<string>,
  alreadyHandled: Set<string>,
): string[] {
  const dead: string[] = [];
  for (const [id, ups] of index.upstream) {
    if (alreadyHandled.has(id)) continue;
    if (ups.some((u) => failedOrSkipped.has(u))) dead.push(id);
  }
  return dead;
}
