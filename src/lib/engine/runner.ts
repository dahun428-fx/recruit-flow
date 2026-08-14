// 싱글턴 러너 + 백그라운드 병렬 루프(engine.md §1, m2-plan §4).
// 진실은 DB, SSE는 통지 — 상태 전이는 DB 기록이 먼저, 그 뒤 eventBus 발행.
// M2: 동시 실행 풀(MAX_CONCURRENCY=2), Gate fail 루프((nodeId,iteration) 키),
//     waiting_human(Human·ask_human), 부분 재실행, chat_card. 예외는 노드 실패로 격리.

import {
  copyUpstreamArtifacts,
  createNodeRun,
  createRun,
  getArtifactByNodeRun,
  getGraph,
  getRun,
  getRunSnapshot,
  setNodeRunGateDecision,
  setNodeRunStatus,
  setRunStatus,
} from "../db/queries";
import { db } from "../db/client";
import { nodeRuns as nodeRunsTable, runs as runsTable } from "../db/schema";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { validateGraph } from "../validation";
import type {
  AgentConfig,
  Artifact,
  GateConfig,
  Graph,
  HumanConfig,
  InputConfig,
  NodeRow,
  NodeRunStatus,
  OutputConfig,
  RunStartResult,
  RunStatus,
  ValidationError,
} from "../types";
import { runAgentNode } from "./agent-node";
import { eventBus } from "./events";
import { buildGateContext, evaluateGate, GateExprError } from "./gate";
import { humanWait, type HumanApproval } from "./human";
import { runInputNode } from "./input-node";
import { deriveMounts } from "./mount";
import { runOutputNode } from "./output-node";
import { finalizeArtifact, createArtifact } from "../db/queries";
import type { UpstreamInput } from "./input-composer";
import {
  indexGraph,
  rootNodeIds,
  type GraphIndex,
} from "./scheduler";

/** SDK 동시 호출 한도(engine.md §스케줄링 4). 상수. */
export const MAX_CONCURRENCY = 2;

/** 재방문 키 = nodeId#iteration (Gate 루프 재실행 허용). */
type NodeKey = string;
const keyOf = (nodeId: string, iteration: number): NodeKey =>
  `${nodeId}#${iteration}`;

/** run별 인메모리 실행 상태(진실은 DB, 이건 제어용). */
interface RunControl {
  runId: string;
  pipelineId: string;
  index: GraphIndex;
  snapshot: Graph;
  /** (nodeId,iteration) → nodeRunId. */
  nodeRunIdByKey: Map<NodeKey, string>;
  /** nodeId → 현재 회차. 기본 1, Gate fail로 하류가 증가. */
  iterationByNode: Map<string, number>;
  /** 완료(succeeded) 키. */
  succeeded: Set<NodeKey>;
  /** 실패/스킵 키. */
  failedOrSkipped: Set<NodeKey>;
  /** 처리 착수(handled) 키 — 중복 실행 방지. */
  handled: Set<NodeKey>;
  /** 현재 실행 중인 SDK 호출 취소용. */
  abort: AbortController;
  cancelled: boolean;
  /** 이 run 스케줄링 정지(waiting_human 중). */
  paused: boolean;
  /** Gate fail로 폐기된(재실행 대상으로 무효화된) 키 — 결과 무시. */
  invalidated: Set<NodeKey>;
  /**
   * Gate 라우팅 결정 — keyOf(gateId, iter) → "pass" | "fail".
   * pickReady가 Gate 상류의 pass/fail 엣지 하류를 열 때, 그 엣지의 sourceHandle이
   * Gate의 실제 결정과 일치하는지 검사하는 데 쓴다(불일치면 하류 미충족).
   */
  gateDecision: Map<NodeKey, "pass" | "fail">;
  /** 루프 깨우기용 — 슬롯 비거나 join 갱신 시 resolve. */
  wake: (() => void) | null;
  /** Gate maxLoops 초과 → 이 run은 gate_failed로 마감. */
  gateFailedReason?: { finalScoreText: string; gateName: string; loops: number };
}

class Runner {
  private controls = new Map<string, RunControl>();

  // =========================================================================
  // run 시작
  // =========================================================================

  start(pipelineId: string): RunStartResult {
    const graph = getGraph(pipelineId);
    const errors: ValidationError[] = validateGraph(graph.nodes, graph.edges);
    if (errors.length > 0) return { errors };

    const run = createRun(pipelineId, graph, null);
    const control = this.buildControl(run.id, pipelineId, graph);

    // 루트 노드(상류 없는 flow 노드)만 초기 큐잉 — node_run 생성.
    // 장착 계층 노드(skill/rule/tool)는 실행 대상이 아니므로 node_run을 만들지
    // 않는다 — mount 엣지의 source라 상류가 없어 root로 잡히지만, 실행되지
    // 않고 skipUnhandled에서도 제외돼 queued 유령 행으로 남기 때문.
    for (const nodeId of rootNodeIds(control.index)) {
      const n = control.index.nodeById.get(nodeId);
      if (n?.type === "skill" || n?.type === "rule" || n?.type === "tool") continue;
      this.ensureNodeRun(control, nodeId, 1, "queued");
    }

    this.controls.set(run.id, control);
    this.emitRunStatus(control, "running");
    this.emitChatCard(control, "card_run", {
      event: "started",
      title: "실행 시작",
    });

    this.launch(control);
    return { runId: run.id };
  }

  /**
   * 부분 재실행(A4) — from_node 상류 전이 폐포를 직전 완료 run에서 복사,
   * from_node부터 하류만 큐잉(§8-B). 현재 그래프로 스냅샷.
   */
  startFrom(pipelineId: string, fromNodeId: string, upstreamRunId: string): RunStartResult {
    const graph = getGraph(pipelineId);
    const errors: ValidationError[] = validateGraph(graph.nodes, graph.edges);
    if (errors.length > 0) return { errors };

    const index = indexGraph(graph.nodes, graph.edges);
    if (!index.nodeById.has(fromNodeId)) {
      return {
        errors: [
          { code: "orphan", nodeId: fromNodeId, message: "재실행 시작 노드가 그래프에 없습니다." },
        ],
      };
    }

    const run = createRun(pipelineId, graph, upstreamRunId);

    // from_node의 상류 전이 폐포(엄격 상류 — from_node 제외) 복사 대상.
    const closure = upstreamClosure(index, fromNodeId);
    // 현재 그래프에 존재하는 노드만 복사(id 불일치 상류는 재실행).
    const copyTargets = [...closure].filter((id) => index.nodeById.has(id));
    const copied = copyUpstreamArtifacts(run.id, upstreamRunId, copyTargets);

    const control = this.buildControl(run.id, pipelineId, graph);
    // 복사된 노드는 succeeded로 표시(재실행 안 함) + nodeRun id 매핑 확보.
    const copiedSet = new Set(copied);
    this.hydrateCopiedNodeRuns(control, copiedSet);

    // from_node를 큐잉(복사 폐포는 succeeded 취급되어 join 충족).
    this.ensureNodeRun(control, fromNodeId, 1, "queued");
    // from_node의 상류 중 복사 못 한 게 있으면(id 불일치) 그 상류부터 재큐잉.
    for (const upId of index.upstream.get(fromNodeId) ?? []) {
      if (!copiedSet.has(upId)) this.ensureNodeRun(control, upId, 1, "queued");
    }

    this.controls.set(run.id, control);
    this.emitRunStatus(control, "running");
    this.emitChatCard(control, "card_run", {
      event: "started",
      title: "부분 재실행 시작",
      fromNodeId,
    });

    this.launch(control);
    return { runId: run.id };
  }

  private buildControl(runId: string, pipelineId: string, graph: Graph): RunControl {
    return {
      runId,
      pipelineId,
      index: indexGraph(graph.nodes, graph.edges),
      snapshot: graph,
      nodeRunIdByKey: new Map(),
      iterationByNode: new Map(),
      succeeded: new Set(),
      failedOrSkipped: new Set(),
      handled: new Set(),
      abort: new AbortController(),
      cancelled: false,
      paused: false,
      invalidated: new Set(),
      gateDecision: new Map(),
      wake: null,
    };
  }

  /** 복사된 상류 노드(succeeded)의 최신 node_run id를 control에 반영. */
  private hydrateCopiedNodeRuns(control: RunControl, copied: Set<string>): void {
    if (copied.size === 0) return;
    const rows = db
      .select()
      .from(nodeRunsTable)
      .where(and(eq(nodeRunsTable.runId, control.runId), eq(nodeRunsTable.status, "succeeded")))
      .all();
    for (const r of rows) {
      if (!copied.has(r.nodeId)) continue;
      const iter = r.iteration;
      control.iterationByNode.set(r.nodeId, iter);
      control.nodeRunIdByKey.set(keyOf(r.nodeId, iter), r.id);
      control.succeeded.add(keyOf(r.nodeId, iter));
      control.handled.add(keyOf(r.nodeId, iter));
    }
  }

  // =========================================================================
  // 중단
  // =========================================================================

  cancel(runId: string): { ok: boolean } {
    const control = this.controls.get(runId);
    if (!control) {
      const run = getRun(runId);
      if (run && (run.status === "running" || run.status === "waiting_human")) {
        this.forceFinalizeOrphan(runId, "cancelled");
        return { ok: true };
      }
      return { ok: false };
    }
    control.cancelled = true;
    control.abort.abort();
    // 대기 중 사람 입력이 있으면 reject해서 노드 실패로.
    for (const key of control.handled) {
      const nrId = control.nodeRunIdByKey.get(key);
      if (nrId && humanWait.has(nrId)) {
        humanWait.reject(nrId, new Error("실행이 취소되었습니다"));
      }
    }
    control.wake?.();
    return { ok: true };
  }

  // =========================================================================
  // 동시 실행 풀 드라이버 (A1)
  // =========================================================================

  /** 백그라운드 루프 시작(fire-and-forget). 예외는 내부 격리, 마지막 방어선만. */
  private launch(control: RunControl): void {
    void this.drive(control).catch((e) => {
      // eslint-disable-next-line no-console
      console.error(`[runner] drive crashed for run ${control.runId}:`, e);
      this.finalizeRun(control, "failed");
    });
  }

  /**
   * 이벤트 구동 병렬 드라이버. 준비된 노드를 최대 MAX_CONCURRENCY개 동시 실행,
   * 하나 완료 시 join 재계산 → 빈 슬롯 충전. paused(waiting_human) 시 대기.
   */
  private async drive(control: RunControl): Promise<void> {
    const inFlight = new Set<Promise<void>>();

    while (true) {
      if (control.cancelled) break;

      // gate_failed 확정 시 즉시 종료 흐름으로.
      if (control.gateFailedReason) break;

      // 준비된(join 충족) 큐 노드를 슬롯이 빌 때까지 실행.
      if (!control.paused) {
        let launched = true;
        while (launched && inFlight.size < MAX_CONCURRENCY && !control.cancelled) {
          launched = this.launchNextReady(control, inFlight);
        }
      }

      // 실행 중인 게 없고 더 준비될 것도 없으면 종료.
      if (inFlight.size === 0) {
        if (control.paused) {
          // 사람 대기 중 — approve/answer가 wake로 깨울 때까지 대기.
          await this.waitForWake(control);
          continue;
        }
        // 큐에 남은 준비 노드가 있으면 계속, 없으면 완주.
        if (!this.hasSchedulable(control)) break;
        continue;
      }

      // 최소 하나 완료 또는 wake 신호까지 대기.
      await Promise.race([...inFlight, this.waitForWake(control)]);
    }

    // 마감.
    if (control.gateFailedReason) {
      this.finishGateFailed(control);
      return;
    }
    if (control.cancelled) {
      this.finishCancelled(control);
      return;
    }
    if (control.paused) {
      // 사람 대기로 드라이버가 나감 — run은 waiting_human 유지, 마감 안 함.
      return;
    }
    const anyFailure = control.failedOrSkipped.size > 0;
    this.finalizeRun(control, anyFailure ? "failed" : "succeeded");
  }

  /** 준비된 다음 노드 1개를 실행에 투입(inFlight에 추가). 없으면 false. */
  private launchNextReady(control: RunControl, inFlight: Set<Promise<void>>): boolean {
    const nodeId = this.pickReady(control);
    if (!nodeId) return false;

    const iter = control.iterationByNode.get(nodeId) ?? 1;
    const key = keyOf(nodeId, iter);
    control.handled.add(key);

    const node = control.index.nodeById.get(nodeId)!;
    const nodeRunId = this.ensureNodeRun(control, nodeId, iter, "queued");

    // 상류가 죽었으면 스킵.
    const deadUpstream = this.upstreamFailed(control, nodeId, iter);
    if (deadUpstream) {
      this.markNode(control, nodeId, nodeRunId, iter, "skipped");
      control.failedOrSkipped.add(key);
      control.wake?.();
      return true;
    }

    const p = this.runNode(control, node, nodeRunId, iter)
      .catch(() => {
        // runNode 내부에서 이미 실패 마감 — 방어.
      })
      .finally(() => {
        inFlight.delete(p);
        control.wake?.();
      });
    inFlight.add(p);
    return true;
  }

  /** 실행 준비된(모든 flow 상류가 현재 회차 succeeded, 미처리) 노드 1개. */
  private pickReady(control: RunControl): string | null {
    for (const node of control.snapshot.nodes) {
      const nodeId = node.id;
      // 장착 노드(skill/rule/tool)는 실행 대상 아님.
      if (node.type === "skill" || node.type === "rule" || node.type === "tool") continue;
      const iter = control.iterationByNode.get(nodeId) ?? 1;
      const key = keyOf(nodeId, iter);
      if (control.handled.has(key)) continue;
      const ups = this.flowUpstream(control, nodeId);
      // 루트: 상류 없음 → 준비(단, 초기 큐잉된 것만 — iterationByNode 세팅 여부로 판단).
      if (ups.length === 0) {
        if (control.iterationByNode.has(nodeId)) return nodeId;
        continue;
      }
      // 모든 상류가 현재 회차에서 완료(succeeded 또는 스킵판정 필요)면 준비.
      // 상류가 Gate면 이 엣지의 sourceHandle(pass)이 Gate의 라우팅 결정과
      // 일치할 때만 충족으로 친다 — Gate가 fail로 라우팅한 경우 pass-하류는
      // 열리지 않는다(불필요한 Output 실행 방지).
      const allDone = ups.every((u) => this.upstreamSatisfiesEdge(control, u, nodeId));
      if (allDone) {
        // 하나라도 실패/스킵이면 이 노드도 스킵 대상(launchNextReady에서 처리).
        return nodeId;
      }
    }
    return null;
  }

  /** 상류 노드가 이번 하류 실행 기준으로 완료(succeeded/failed/skipped)됐는가. */
  private upstreamSettled(control: RunControl, upId: string): boolean {
    const iter = control.iterationByNode.get(upId);
    if (iter === undefined) return false;
    const key = keyOf(upId, iter);
    return control.succeeded.has(key) || control.failedOrSkipped.has(key);
  }

  /**
   * upId(상류)가 targetId로 향하는 flow 엣지 기준으로 충족됐는가.
   * - 기본: 상류가 settled면 충족(기존 동작).
   * - 상류가 Gate면 라우팅 게이팅: 이 엣지의 sourceHandle이 Gate의 실제
   *   결정(pass/fail)과 일치할 때만 충족. flowUpstream이 fail 엣지를 이미
   *   걸러내므로 여기 도달하는 Gate 엣지는 pass(또는 미지정) — Gate가 pass로
   *   결정한 경우에만 열린다. Gate가 fail이면 이 pass-하류는 미충족(→ 유령
   *   실행 없이 gate_failed/루프 흐름에서 skipped로 마감).
   */
  private upstreamSatisfiesEdge(control: RunControl, upId: string, targetId: string): boolean {
    if (!this.upstreamSettled(control, upId)) return false;
    const up = control.index.nodeById.get(upId);
    if (up?.type !== "gate") return true;
    // 실패/스킵으로 마감된 Gate(조건식 오류 등)는 결정 없음 → 하류로 죽음 전파.
    const upIter = control.iterationByNode.get(upId)!;
    if (control.failedOrSkipped.has(keyOf(upId, upIter))) return true;
    const decision = control.gateDecision.get(keyOf(upId, upIter));
    if (!decision) return false; // 아직 결정 전(방어) — 열지 않음.
    // 이 엣지의 sourceHandle: pass(기본) 이어야 Gate pass 결정과 일치.
    const edge = this.flowEdge(control, upId, targetId);
    const handle = edge?.sourceHandle === "fail" ? "fail" : "pass";
    return decision === handle;
  }

  /** 이 노드의 flow 상류 중 하나라도 실패/스킵인가. */
  private upstreamFailed(control: RunControl, nodeId: string, _iter: number): boolean {
    const ups = this.flowUpstream(control, nodeId);
    return ups.some((u) => {
      const it = control.iterationByNode.get(u);
      if (it === undefined) return false;
      return control.failedOrSkipped.has(keyOf(u, it));
    });
  }

  /** flow 상류(Gate fail 엣지는 fail 대상에서만 유효 — 여기선 pass 흐름 기준). */
  private flowUpstream(control: RunControl, nodeId: string): string[] {
    // scheduler.upstream은 flow만 담는다(mount 제외는 indexGraph가 kind 무시하므로
    // 여기서 mount 엣지를 걸러야 한다). 스냅샷 엣지에서 flow만 재계산.
    const ups: string[] = [];
    for (const e of control.snapshot.edges) {
      if (e.kind === "mount") continue;
      if (e.targetNodeId !== nodeId) continue;
      // Gate fail 엣지는 정상(pass) 흐름의 상류로 치지 않는다 — fail 재큐잉 전용.
      if (e.sourceHandle === "fail") continue;
      if (control.index.nodeById.has(e.sourceNodeId)) ups.push(e.sourceNodeId);
    }
    return ups;
  }

  /** 아직 실행할 준비 노드가 남아있는가(완주 판정용). */
  private hasSchedulable(control: RunControl): boolean {
    return this.pickReady(control) !== null;
  }

  private waitForWake(control: RunControl): Promise<void> {
    return new Promise<void>((resolve) => {
      const prev = control.wake;
      control.wake = () => {
        control.wake = prev;
        resolve();
      };
    });
  }

  // =========================================================================
  // 노드 실행
  // =========================================================================

  private async runNode(
    control: RunControl,
    node: NodeRow,
    nodeRunId: string,
    iter: number,
  ): Promise<void> {
    this.markNode(control, node.id, nodeRunId, iter, "running");
    const key = keyOf(node.id, iter);

    try {
      if (node.type === "input") {
        runInputNode(nodeRunId, node.config as InputConfig);
        this.settleSucceeded(control, node, nodeRunId, iter);
      } else if (node.type === "output") {
        const inputs = this.collectInputs(control, node.id, iter);
        const title = deriveTitle(node.config as OutputConfig, node.name);
        runOutputNode(nodeRunId, inputs, title);
        this.settleSucceeded(control, node, nodeRunId, iter);
      } else if (node.type === "agent") {
        const inputs = this.collectInputs(control, node.id, iter);
        await runAgentNode({
          runId: control.runId,
          nodeRunId,
          config: node.config as AgentConfig,
          inputs,
          abortController: control.abort,
          mounts: deriveMounts(control.snapshot, node.id),
          askHuman: (question) => this.onAskHuman(control, node, nodeRunId, iter, question),
        });
        if (control.invalidated.has(key)) return; // 취소로 무효화됨
        this.settleSucceeded(control, node, nodeRunId, iter);
      } else if (node.type === "gate") {
        await this.runGate(control, node, nodeRunId, iter);
      } else if (node.type === "human") {
        await this.runHuman(control, node, nodeRunId, iter);
      } else {
        throw new Error(`알 수 없는 노드 타입: ${node.type}`);
      }
    } catch (e) {
      if (control.invalidated.has(key)) return;
      const msg = control.cancelled
        ? "실행 중 취소됨"
        : (e as Error).message || String(e);
      this.markNode(control, node.id, nodeRunId, iter, "failed", msg);
      control.failedOrSkipped.add(key);
    }
  }

  private settleSucceeded(
    control: RunControl,
    node: NodeRow,
    nodeRunId: string,
    iter: number,
  ): void {
    this.markNode(control, node.id, nodeRunId, iter, "succeeded");
    control.succeeded.add(keyOf(node.id, iter));
    this.emitRunStatus(control, "running");
  }

  // =========================================================================
  // Gate (A2)
  // =========================================================================

  private async runGate(
    control: RunControl,
    node: NodeRow,
    nodeRunId: string,
    iter: number,
  ): Promise<void> {
    const config = node.config as GateConfig;
    const inputs = this.collectInputs(control, node.id, iter);
    const jsonInputs = inputs
      .filter((i) => i.artifact.format === "json")
      .map((i) => ({ nodeName: i.nodeName, artifact: i.artifact }));

    let pass: boolean;
    try {
      const ctx = buildGateContext(jsonInputs);
      pass = evaluateGate(config.expr, ctx);
    } catch (e) {
      const msg =
        e instanceof GateExprError
          ? `Gate 조건식 오류: ${e.message}`
          : (e as Error).message;
      this.markNode(control, node.id, nodeRunId, iter, "failed", msg);
      control.failedOrSkipped.add(keyOf(node.id, iter));
      return;
    }

    // Gate는 아티팩트를 만들지 않는다(순수 라우터). node_run만 succeeded.
    // 라우팅 결정을 기록 — pickReady가 pass/fail 하류를 이 결정과 대조한다.
    if (pass) {
      this.recordGateDecision(control, node.id, nodeRunId, iter, "pass");
      this.markNode(control, node.id, nodeRunId, iter, "succeeded");
      control.succeeded.add(keyOf(node.id, iter));
      this.emitRunStatus(control, "running");
      return;
    }
    this.recordGateDecision(control, node.id, nodeRunId, iter, "fail");

    // fail: maxLoops 판정. 이 Gate가 이미 몇 번 fail 했는가 = gate 노드 회차.
    const loopCount = iter; // Gate 노드의 회차 = 실행 횟수.
    const maxLoops = config.maxLoops ?? 3;
    // Gate 자체는 succeeded로 마감(판정 완료). fail은 라우팅으로 표현.
    this.markNode(control, node.id, nodeRunId, iter, "succeeded");
    control.succeeded.add(keyOf(node.id, iter));

    if (loopCount >= maxLoops) {
      const finalScoreText = jsonInputs.map((j) => j.artifact.content).join("\n\n");
      control.gateFailedReason = {
        finalScoreText,
        gateName: node.name,
        loops: loopCount,
      };
      control.wake?.();
      return;
    }

    // fail 대상: failTargetNodeId 또는 상류 마크다운 생성 노드.
    const failTarget = this.resolveFailTarget(control, node, config);
    if (!failTarget) {
      this.markNode(control, node.id, nodeRunId, iter, "failed", "Gate fail 대상 노드를 찾을 수 없습니다");
      control.failedOrSkipped.delete(keyOf(node.id, iter));
      control.failedOrSkipped.add(keyOf(node.id, iter));
      return;
    }

    // failTarget부터 (이 Gate 포함) 하류를 iteration+1로 재큐잉.
    this.requeueForFail(control, node, failTarget, jsonInputs);
    this.emitRunStatus(control, "running");
    control.wake?.();
  }

  /** fail 대상 노드 결정 — 지정 우선, 없으면 상류 마크다운 생성 노드. */
  private resolveFailTarget(
    control: RunControl,
    gate: NodeRow,
    config: GateConfig,
  ): string | null {
    if (config.failTargetNodeId && control.index.nodeById.has(config.failTargetNodeId)) {
      return config.failTargetNodeId;
    }
    // Gate의 flow 상류 중 마크다운 생성 노드(agent markdown / input).
    for (const upId of this.flowUpstream(control, gate.id)) {
      const up = control.index.nodeById.get(upId);
      if (!up) continue;
      if (up.type === "input") return upId;
      if (up.type === "agent" && (up.config as AgentConfig).outputFormat === "markdown") {
        return upId;
      }
    }
    return null;
  }

  /**
   * fail 재큐잉 — failTarget부터 Gate까지의 경로 노드를 iteration+1로 재실행.
   * failTarget에는 직전 회차 채점 JSON을 자동 포함(iterationFeedbackByNode).
   */
  private requeueForFail(
    control: RunControl,
    gate: NodeRow,
    failTargetId: string,
    priorScores: { nodeName: string; artifact: Artifact }[],
  ): void {
    // failTarget → 트리거 Gate 경로만 재실행 대상. Gate는 포함하되 그 pass/fail
    // 하류(Output 등)로는 전개하지 않는다 — 그렇지 않으면 pass-하류가 유령
    // iteration+1 node_run으로 재큐잉됨.
    const toRequeue = downstreamClosure(control.index, failTargetId, control.snapshot, gate.id);
    toRequeue.add(failTargetId);

    // 직전 회차 채점 JSON을 failTarget 입력에 주입(nodes.md Q13).
    this.pendingFeedback.set(
      `${control.runId}:${failTargetId}`,
      priorScores.map((p) => ({ nodeName: p.nodeName, artifact: p.artifact })),
    );

    for (const nodeId of toRequeue) {
      const cur = control.iterationByNode.get(nodeId) ?? 1;
      const next = cur + 1;
      // 이전 회차 키 상태는 남기고, 새 회차 키로 재큐잉.
      control.iterationByNode.set(nodeId, next);
      this.ensureNodeRun(control, nodeId, next, "queued");
    }
  }

  /** failTarget → 재실행 입력에 주입할 직전 회차 채점 JSON. runId:nodeId 키. */
  private pendingFeedback = new Map<string, { nodeName: string; artifact: Artifact }[]>();

  // =========================================================================
  // Human (A3)
  // =========================================================================

  private async runHuman(
    control: RunControl,
    node: NodeRow,
    nodeRunId: string,
    iter: number,
  ): Promise<void> {
    const config = node.config as HumanConfig;
    const inputs = this.collectInputs(control, node.id, iter);

    // node_run·run을 waiting_human으로. run 스케줄링 정지(다른 진행 노드는 마저).
    setNodeRunStatus(nodeRunId, "waiting_human", null);
    this.emitNodeStatus(control, node.id, nodeRunId, iter, "waiting_human");
    setRunStatus(control.runId, "waiting_human", false);
    this.emitRunStatus(control, "waiting_human");
    control.paused = true;
    this.emitChatCard(
      control,
      "card_human",
      {
        event: "waiting",
        nodeId: node.id,
        nodeName: node.name,
        instruction: config.instruction,
        allowEdit: config.allowEdit,
      },
      nodeRunId,
    );

    // approve까지 대기(재개 시 러너가 resolve).
    let approval: HumanApproval;
    try {
      approval = await humanWait.waitForApproval(nodeRunId);
    } catch (e) {
      // 취소 등으로 reject → 노드 실패.
      this.markNode(control, node.id, nodeRunId, iter, "failed", (e as Error).message);
      control.failedOrSkipped.add(keyOf(node.id, iter));
      control.paused = false;
      return;
    }

    // 승인본 아티팩트 생성: 주 입력을 승인본으로(편집이면 editedBy=human).
    const primary = this.pickPrimaryInput(inputs, config);
    const content = approval.editedContent ?? primary?.artifact.content ?? "";
    const format = primary?.artifact.format ?? "markdown";
    const art = createArtifact(nodeRunId, format, "");
    finalizeArtifact(art.id, content, approval.editedContent ? { editedBy: "human" } : null);

    // run을 다시 running으로.
    setRunStatus(control.runId, "running", false);
    control.paused = false;
    this.emitRunStatus(control, "running");
    this.settleSucceeded(control, node, nodeRunId, iter);
    this.emitChatCard(control, "card_human", { event: "approved", nodeName: node.name }, nodeRunId);
  }

  private pickPrimaryInput(
    inputs: UpstreamInput[],
    config: HumanConfig,
  ): UpstreamInput | null {
    const md = inputs.filter((i) => i.artifact.format === "markdown");
    if (config.primaryInputNodeId) {
      const byId = inputs.find(
        (i) => i.sourceNodeId === config.primaryInputNodeId,
      );
      if (byId) return byId;
    }
    if (md.length >= 1) return md[0];
    return inputs[0] ?? null;
  }

  /** ask_human(Agent 내부 갭) — run/node_run을 waiting_human으로 멈추고 답변 대기. */
  private async onAskHuman(
    control: RunControl,
    node: NodeRow,
    nodeRunId: string,
    iter: number,
    question: string,
  ): Promise<string> {
    setNodeRunStatus(nodeRunId, "waiting_human", null);
    this.emitNodeStatus(control, node.id, nodeRunId, iter, "waiting_human");
    setRunStatus(control.runId, "waiting_human", false);
    this.emitRunStatus(control, "waiting_human");
    control.paused = true;
    this.emitChatCard(
      control,
      "card_human",
      { event: "gap_question", nodeName: node.name, question },
      nodeRunId,
    );
    control.wake?.();

    const answer = await humanWait.waitForAnswer(nodeRunId);

    // 답변 도착 → 노드 실행 재개(SDK가 tool 결과로 이어감). run running 복귀.
    setNodeRunStatus(nodeRunId, "running", null);
    this.emitNodeStatus(control, node.id, nodeRunId, iter, "running");
    setRunStatus(control.runId, "running", false);
    control.paused = false;
    this.emitRunStatus(control, "running");
    control.wake?.();
    return answer;
  }

  // =========================================================================
  // 재개 API(approve / answer) — 라우트가 호출
  // =========================================================================

  /** Human 승인. 인메모리 대기가 있으면 해소, 없으면 재하이드레이션 후 해소(§8-E). */
  approve(nodeRunId: string, editedContent?: string): { ok: boolean; error?: string } {
    if (humanWait.resolveApproval(nodeRunId, { editedContent })) {
      return { ok: true };
    }
    // 재하이드레이션: DB에서 run·node_run 복구 후 러너 재구성.
    const rehydrated = this.rehydrateForApproval(nodeRunId);
    if (!rehydrated) return { ok: false, error: "승인 대기 상태가 아닙니다" };
    if (humanWait.resolveApproval(nodeRunId, { editedContent })) {
      return { ok: true };
    }
    return { ok: false, error: "재개에 실패했습니다" };
  }

  /** ask_human 답변. 대기가 없으면(세션 죽음) node_run failed 마감(§8-E). */
  answer(nodeRunId: string, text: string): { ok: boolean; error?: string } {
    if (humanWait.resolveAnswer(nodeRunId, text)) {
      return { ok: true };
    }
    // 세션이 죽었으면 이 node_run을 failed로 마감(부분 재실행 유도).
    const nr = db.select().from(nodeRunsTable).where(eq(nodeRunsTable.id, nodeRunId)).get();
    if (nr && nr.status === "waiting_human") {
      setNodeRunStatus(nodeRunId, "failed", "프로세스 재시작으로 갭 인터뷰 세션이 종료됨");
      setRunStatus(nr.runId, "failed");
      return { ok: false, error: "세션이 종료되어 재실행이 필요합니다" };
    }
    return { ok: false, error: "답변 대기 상태가 아닙니다" };
  }

  /**
   * approve 재하이드레이션(§8-E) — 프로세스 재시작 후 인메모리 control이 없을 때
   * DB 스냅샷·node_run에서 러너를 재구성하고 Human 대기 Promise를 다시 건다.
   */
  private rehydrateForApproval(nodeRunId: string): boolean {
    const nr = db.select().from(nodeRunsTable).where(eq(nodeRunsTable.id, nodeRunId)).get();
    if (!nr || nr.status !== "waiting_human") return false;
    const run = getRun(nr.runId);
    if (!run || run.status !== "waiting_human") return false;
    if (this.controls.has(run.id)) return true; // 이미 살아있음

    const snapshot = getRunSnapshot(run.id);
    if (!snapshot) return false;

    // 크래시로 남은 형제 node_run(running/queued)을 먼저 마감 — 재구성한 control이
    // 이들을 실행 중으로 오인해 중복 실행/유령 행을 남기지 않도록(대기 노드는 유지).
    this.cleanupStaleSiblings(run.id);

    const control = this.buildControl(run.id, run.pipelineId, snapshot);
    // DB의 node_run 상태로 control 복원.
    const rows = db
      .select()
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.runId, run.id))
      .orderBy(asc(nodeRunsTable.iteration))
      .all();
    for (const r of rows) {
      const key = keyOf(r.nodeId, r.iteration);
      control.nodeRunIdByKey.set(key, r.id);
      const prev = control.iterationByNode.get(r.nodeId) ?? 0;
      if (r.iteration >= prev) control.iterationByNode.set(r.nodeId, r.iteration);
      if (r.status === "succeeded") control.succeeded.add(key);
      if (r.status === "failed" || r.status === "skipped") control.failedOrSkipped.add(key);
      if (r.status === "succeeded" || r.status === "failed" || r.status === "skipped") {
        control.handled.add(key);
      }
    }
    // Gate 라우팅 결정 복원 — DB에 기록된 값을 그대로 읽는다.
    // (이전에는 "succeeded Gate의 최대 회차 = pass" 휴리스틱이었으나,
    //  maxLoops 소진 시 Gate는 succeeded+fail로 마감하고 다음 회차를 만들지
    //  않으므로 최대 회차가 fail인 경우를 pass로 뒤집는 버그가 있었다.)
    for (const r of rows) {
      if (r.gateDecision === "pass" || r.gateDecision === "fail") {
        control.gateDecision.set(keyOf(r.nodeId, r.iteration), r.gateDecision);
      }
    }
    // 대기 노드는 handled로 두되 succeeded/failed 아님 — 드라이버가 재개 후 처리.
    // Human 노드는 runHuman을 다시 걸어 approve를 기다리게 한다.
    const humanNr = rows.find((r) => r.id === nodeRunId)!;
    const node = snapshot.nodes.find((n) => n.id === humanNr.nodeId);
    if (!node) return false;

    control.paused = true;
    this.controls.set(run.id, control);

    // Human 노드 재개 태스크를 붙이고 드라이버 시작.
    // ★ 이 태스크는 drive()의 inFlight에 없으므로(=완료 시 자동 wake가 없다)
    //   반드시 여기서 직접 깨워야 한다. 그러지 않으면 승인 후 Human만
    //   succeeded가 되고 드라이버는 waitForWake에 영원히 머문다 — 재시작 후
    //   승인 시 파이프라인이 재개되지 않는 결함이었다.
    control.handled.add(keyOf(humanNr.nodeId, humanNr.iteration));
    void this.runHuman(control, node, nodeRunId, humanNr.iteration)
      .catch(() => {})
      .finally(() => {
        control.wake?.();
      });
    this.launch(control);
    return true;
  }

  // =========================================================================
  // 입력 수집
  // =========================================================================

  /**
   * 상류(flow) 노드들의 아티팩트를 inputOrder 라벨과 함께 수집.
   * - 각 상류의 "현재 회차" node_run 아티팩트를 취한다.
   * - Gate fail 재실행이면 직전 채점 JSON을 자동 포함(pendingFeedback).
   */
  private collectInputs(
    control: RunControl,
    nodeId: string,
    _iter: number,
  ): UpstreamInput[] {
    const inputs: UpstreamInput[] = this.gatherUpstreamInputs(
      control,
      nodeId,
      new Set(),
    );

    // Gate fail 재실행 시 직전 채점 JSON 자동 포함.
    const fb = this.pendingFeedback.get(`${control.runId}:${nodeId}`);
    if (fb) {
      let order = 1000;
      for (const f of fb) {
        // 이미 상류로 들어온 동일 출처는 중복 추가 안 함.
        if (inputs.some((i) => i.nodeName === f.nodeName)) continue;
        inputs.push({
          nodeName: `${f.nodeName} (직전 회차 채점)`,
          sourceNodeId: null,
          artifact: f.artifact,
          order: order++,
        });
      }
      this.pendingFeedback.delete(`${control.runId}:${nodeId}`);
    }

    return inputs;
  }

  /**
   * nodeId의 flow 상류 아티팩트를 라벨과 함께 수집. Gate는 아티팩트가 없는
   * 순수 라우터라 상류를 그대로 흘려보내므로(nodes.md Q13 pass), Gate 상류를
   * 만나면 그 Gate의 flow 상류로 투명하게 파고들어 원본 아티팩트를 가져온다.
   * @param seen 순환 방지(Gate fail back-edge는 flowUpstream이 이미 제외).
   */
  private gatherUpstreamInputs(
    control: RunControl,
    nodeId: string,
    seen: Set<string>,
  ): UpstreamInput[] {
    const inputs: UpstreamInput[] = [];
    for (const upId of this.flowUpstream(control, nodeId)) {
      const upNode = control.index.nodeById.get(upId);
      if (!upNode) continue;

      // Gate 상류: 아티팩트 없음 → Gate의 상류를 그대로 통과(라벨 유지).
      if (upNode.type === "gate") {
        if (seen.has(upId)) continue;
        seen.add(upId);
        const edge = this.flowEdge(control, upId, nodeId);
        const baseOrder = edge?.inputOrder ?? 0;
        for (const passed of this.gatherUpstreamInputs(control, upId, seen)) {
          inputs.push({ ...passed, order: passed.order + baseOrder });
        }
        continue;
      }

      const upIter = control.iterationByNode.get(upId) ?? 1;
      const upNodeRunId = control.nodeRunIdByKey.get(keyOf(upId, upIter));
      if (!upNodeRunId) continue;
      const artifact: Artifact | null = getArtifactByNodeRun(upNodeRunId);
      if (!artifact) continue;
      const edge = this.flowEdge(control, upId, nodeId);
      inputs.push({
        nodeName: upNode.name,
        sourceNodeId: upId,
        artifact,
        order: edge?.inputOrder ?? 0,
      });
    }
    return inputs;
  }

  /** source→target 사이의 flow(비 mount·비 fail) 엣지. */
  private flowEdge(
    control: RunControl,
    sourceId: string,
    targetId: string,
  ) {
    return control.snapshot.edges.find(
      (e) =>
        e.kind !== "mount" &&
        e.sourceHandle !== "fail" &&
        e.sourceNodeId === sourceId &&
        e.targetNodeId === targetId,
    );
  }

  // =========================================================================
  // node_run 보장 · 상태 전이 헬퍼 (DB 먼저, SSE 통지)
  // =========================================================================

  /** (nodeId,iteration)에 대한 node_run을 보장(없으면 생성). id 반환. */
  private ensureNodeRun(
    control: RunControl,
    nodeId: string,
    iteration: number,
    status: NodeRunStatus,
  ): string {
    if (!control.iterationByNode.has(nodeId)) {
      control.iterationByNode.set(nodeId, iteration);
    }
    const key = keyOf(nodeId, iteration);
    const existing = control.nodeRunIdByKey.get(key);
    if (existing) return existing;
    const nr = createNodeRun(control.runId, nodeId, status, iteration);
    control.nodeRunIdByKey.set(key, nr.id);
    this.emitNodeStatus(control, nodeId, nr.id, iteration, status);
    return nr.id;
  }

  private markNode(
    control: RunControl,
    nodeId: string,
    nodeRunId: string,
    iteration: number,
    status: NodeRunStatus,
    error?: string,
  ): void {
    setNodeRunStatus(nodeRunId, status, error ?? null);
    this.emitNodeStatus(control, nodeId, nodeRunId, iteration, status);
  }

  /**
   * Gate 라우팅 결정을 인메모리 맵과 DB에 동시 기록.
   * 인메모리는 현재 run의 빠른 경로, DB는 재시작·재하이드레이션의 진실
   * (schema.md node_runs.gate_decision).
   */
  private recordGateDecision(
    control: RunControl,
    nodeId: string,
    nodeRunId: string,
    iteration: number,
    decision: "pass" | "fail",
  ): void {
    control.gateDecision.set(keyOf(nodeId, iteration), decision);
    setNodeRunGateDecision(nodeRunId, decision);
  }

  private emitNodeStatus(
    control: RunControl,
    nodeId: string,
    nodeRunId: string,
    iteration: number,
    status: NodeRunStatus,
  ): void {
    eventBus.emitNodeStatus(control.runId, { nodeId, nodeRunId, iteration, status });
  }

  private emitRunStatus(control: RunControl, status: RunStatus): void {
    const done = this.countSucceeded(control.runId);
    eventBus.emitRunStatus(control.runId, {
      runId: control.runId,
      status,
      progress: { done, total: control.snapshot.nodes.length },
    });
  }

  private emitChatCard(
    control: RunControl,
    kind: "card_run" | "card_human",
    payload: unknown,
    nodeRunId?: string,
  ): void {
    eventBus.emitChatCard(control.pipelineId, kind, payload, control.runId, nodeRunId ?? null);
  }

  // =========================================================================
  // 마감
  // =========================================================================

  private finalizeRun(control: RunControl, status: RunStatus): void {
    setRunStatus(control.runId, status);
    this.controls.delete(control.runId);
    this.emitRunStatus(control, status);
    this.clearFeedback(control.runId);
    this.emitChatCard(control, "card_run", {
      event: status,
      title: statusTitle(status),
    });
  }

  private finishGateFailed(control: RunControl): void {
    const reason = control.gateFailedReason!;
    // 남은 미처리 노드는 skipped.
    this.skipUnhandled(control);
    setRunStatus(control.runId, "gate_failed");
    this.controls.delete(control.runId);
    this.emitRunStatus(control, "gate_failed");
    this.clearFeedback(control.runId);
    this.emitChatCard(control, "card_run", {
      event: "gate_failed",
      title: "게이트 실패(최대 루프 초과)",
      gateName: reason.gateName,
      loops: reason.loops,
      finalScore: reason.finalScoreText,
    });
  }

  private finishCancelled(control: RunControl): void {
    this.skipUnhandled(control);
    setRunStatus(control.runId, "cancelled");
    this.controls.delete(control.runId);
    this.emitRunStatus(control, "cancelled");
    this.clearFeedback(control.runId);
    this.emitChatCard(control, "card_run", { event: "cancelled", title: "실행 중단" });
  }

  private skipUnhandled(control: RunControl): void {
    for (const node of control.snapshot.nodes) {
      if (node.type === "skill" || node.type === "rule" || node.type === "tool") continue;
      const iter = control.iterationByNode.get(node.id) ?? 1;
      const key = keyOf(node.id, iter);
      if (control.succeeded.has(key) || control.failedOrSkipped.has(key)) continue;
      const nrId = control.nodeRunIdByKey.get(key) ?? this.ensureNodeRun(control, node.id, iter, "queued");
      this.markNode(control, node.id, nrId, iter, "skipped");
      control.failedOrSkipped.add(key);
    }
  }

  private clearFeedback(runId: string): void {
    for (const k of [...this.pendingFeedback.keys()]) {
      if (k.startsWith(`${runId}:`)) this.pendingFeedback.delete(k);
    }
  }

  private countSucceeded(runId: string): number {
    const rows = db
      .select({ status: nodeRunsTable.status })
      .from(nodeRunsTable)
      .where(eq(nodeRunsTable.runId, runId))
      .all();
    return rows.filter((r) => r.status === "succeeded").length;
  }

  /** 인메모리 제어가 없는 running run을 강제 마감(cancel·복구용). */
  private forceFinalizeOrphan(runId: string, status: RunStatus = "failed"): void {
    db.update(nodeRunsTable)
      .set({ status: "failed", endedAt: Date.now(), error: "프로세스 재시작으로 중단" })
      .where(and(eq(nodeRunsTable.runId, runId), inArray(nodeRunsTable.status, ["running", "waiting_human"])))
      .run();
    db.update(nodeRunsTable)
      .set({ status: "skipped", endedAt: Date.now() })
      .where(and(eq(nodeRunsTable.runId, runId), eq(nodeRunsTable.status, "queued")))
      .run();
    setRunStatus(runId, status);
  }

  // =========================================================================
  // 프로세스 재시작 복구
  // =========================================================================

  /**
   * 기동 시 running run을 failed로 마감(engine.md §복구).
   * waiting_human run은 복원 유지(마감 안 함, m2-plan §복구) — approve 시
   * rehydrateForApproval로 재구성한다.
   */
  recoverOnBoot(): void {
    const runningRuns = db
      .select({ id: runsTable.id })
      .from(runsTable)
      .where(eq(runsTable.status, "running"))
      .all();
    for (const r of runningRuns) {
      if (this.controls.has(r.id)) continue;
      this.forceFinalizeOrphan(r.id, "failed");
    }
    // waiting_human run은 복원 유지(마감 안 함) — approve로 재개. 단, 크래시로
    // 남은 병렬 형제 node_run(running/queued)은 인메모리 실행이 사라져 재개
    // 불가하므로 failed로 마감한다(재개 시 중복 실행·유령 행 방지). 대기 노드
    // (status=waiting_human) 자체는 건드리지 않는다.
    const waitingRuns = db
      .select({ id: runsTable.id })
      .from(runsTable)
      .where(eq(runsTable.status, "waiting_human"))
      .all();
    for (const r of waitingRuns) {
      if (this.controls.has(r.id)) continue;
      this.cleanupStaleSiblings(r.id);
    }
  }

  /** waiting_human run에서 크래시로 남은 running/queued 형제 node_run을 마감. */
  private cleanupStaleSiblings(runId: string): void {
    db.update(nodeRunsTable)
      .set({ status: "failed", endedAt: Date.now(), error: "프로세스 재시작으로 중단" })
      .where(and(eq(nodeRunsTable.runId, runId), eq(nodeRunsTable.status, "running")))
      .run();
    db.update(nodeRunsTable)
      .set({ status: "skipped", endedAt: Date.now() })
      .where(and(eq(nodeRunsTable.runId, runId), eq(nodeRunsTable.status, "queued")))
      .run();
  }

  isActive(runId: string): boolean {
    return this.controls.has(runId);
  }

  /** 부분 재실행의 상류 출처 = 직전 완료(succeeded/gate_failed/failed 등 종결) run. */
  latestFinishedRunId(pipelineId: string): string | null {
    const row = db
      .select({ id: runsTable.id })
      .from(runsTable)
      .where(
        and(
          eq(runsTable.pipelineId, pipelineId),
          inArray(runsTable.status, ["succeeded", "failed", "gate_failed", "cancelled"]),
        ),
      )
      .orderBy(desc(runsTable.startedAt))
      .get();
    return row?.id ?? null;
  }
}

/** OutputConfig.filenameRule에서 title 추출(없으면 노드 이름). */
function deriveTitle(config: OutputConfig, fallback: string): string {
  return config.filenameRule?.trim() || fallback;
}

function statusTitle(status: RunStatus): string {
  switch (status) {
    case "succeeded":
      return "실행 완료";
    case "failed":
      return "실행 실패";
    case "cancelled":
      return "실행 중단";
    case "gate_failed":
      return "게이트 실패";
    default:
      return status;
  }
}

/** from_node의 엄격 상류 전이 폐포(flow 상류만). from_node 자신 제외. */
function upstreamClosure(index: GraphIndex, fromNodeId: string): Set<string> {
  const seen = new Set<string>();
  const stack = [...(index.upstream.get(fromNodeId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const up of index.upstream.get(id) ?? []) stack.push(up);
  }
  return seen;
}

/**
 * node의 flow 하류 전이 폐포(node 제외). Gate fail 엣지 포함(재실행 경로).
 * @param stopAt 지정 시 이 노드는 폐포에 포함하되, 그 하류로는 더 전개하지 않는다
 *   (트리거 Gate에서 멈춰 pass-하류 Output 등이 재큐잉되지 않게 함).
 */
function downstreamClosure(
  index: GraphIndex,
  fromNodeId: string,
  snapshot: Graph,
  stopAt?: string,
): Set<string> {
  const down = new Map<string, string[]>();
  for (const n of snapshot.nodes) down.set(n.id, []);
  for (const e of snapshot.edges) {
    if (e.kind === "mount") continue;
    if (!down.has(e.sourceNodeId)) continue;
    down.get(e.sourceNodeId)!.push(e.targetNodeId);
  }
  const seen = new Set<string>();
  const stack = [...(down.get(fromNodeId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    // stopAt 노드는 포함하되 그 하류로는 전개하지 않는다.
    if (id === stopAt) continue;
    for (const d of down.get(id) ?? []) stack.push(d);
  }
  return seen;
}

// 싱글턴(Next dev HMR 재평가에도 하나만).
const globalForRunner = globalThis as unknown as { __recruitFlowRunner?: Runner };
export const runner: Runner = globalForRunner.__recruitFlowRunner ?? new Runner();
if (process.env.NODE_ENV !== "production") {
  globalForRunner.__recruitFlowRunner = runner;
}
