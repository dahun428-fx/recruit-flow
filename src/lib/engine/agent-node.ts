// Agent 노드 실행 — 역할(시스템)+장착(mount)+합성 입력(Q11) → query() 1회(nodes.md §2).
// 델타를 아티팩트에 스트리밍 저장(1초 flush) + SSE artifact_delta 발행. 완료 시 확정.
// JSON 출력이면 파싱 강제·1회 재시도. gapMode==='ask'면 ask_human tool 장착.

import {
  createArtifact,
  finalizeArtifact,
  updateArtifactContent,
} from "../db/queries";
import type { AgentConfig, Artifact } from "../types";
import { eventBus } from "./events";
import { composeInput, type UpstreamInput } from "./input-composer";
import type { AgentMounts } from "./mount";
import { composeSystemPrompt } from "./mount";
import { runAgent, runAgentJson, type AskHumanHandler } from "./sdk";

const FLUSH_INTERVAL_MS = 1000;

export interface RunAgentNodeParams {
  runId: string;
  nodeRunId: string;
  config: AgentConfig;
  inputs: UpstreamInput[];
  abortController?: AbortController;
  /** mount 엣지 파생 장착(rule/skill/tool). */
  mounts?: AgentMounts;
  /** gapMode==='ask'일 때 러너가 주입하는 ask_human 대기 핸들러. */
  askHuman?: AskHumanHandler;
}

/**
 * Agent 노드 1회 실행. 시스템 프롬프트(역할+장착) 합성 → SDK 호출 →
 * 델타 스트리밍 저장·발행 → 아티팩트 확정.
 * @throws SDK 호출 실패·JSON 파싱 재실패 시(호출자가 노드 실패로 격리).
 */
export async function runAgentNode(
  params: RunAgentNodeParams,
): Promise<Artifact> {
  const { runId, nodeRunId, config, inputs, abortController, mounts, askHuman } =
    params;

  const userPrompt = composeInput(inputs);
  const format = config.outputFormat === "json" ? "json" : "markdown";

  const emptyMounts: AgentMounts = { rules: [], skills: [], tools: [] };
  const activeMounts = mounts ?? emptyMounts;
  const systemPrompt = composeSystemPrompt(config.role, activeMounts);
  const mountedTools = activeMounts.tools.map((t) => t.toolName);
  // gapMode==='ask'일 때만 ask_human 부여(nodes.md Q12).
  const askHandler: AskHumanHandler | undefined =
    config.gapMode === "ask" ? askHuman : undefined;

  const art = await createArtifact(nodeRunId, format, "");

  let buffer = "";
  let lastFlushed = "";
  let lastFlushAt = Date.now();

  // 주기적 flush는 누적 버퍼의 DB 스냅샷(스트리밍 중간 저장)이다. onDelta 콜백은
  // SDK가 동기 호출하므로 여기서 DB await로 블로킹하지 않고 fire-and-forget한다
  // (완료 시 finalizeArtifact가 await로 확정 — 그것이 진실). force=true(최종)일 때만
  // Promise를 반환해 호출자가 확정 전에 await할 수 있게 한다.
  const flush = (force = false): Promise<void> => {
    if (!force && Date.now() - lastFlushAt < FLUSH_INTERVAL_MS) return Promise.resolve();
    if (buffer === lastFlushed) return Promise.resolve();
    const snapshot = buffer;
    lastFlushed = snapshot;
    lastFlushAt = Date.now();
    return updateArtifactContent(art.id, snapshot);
  };

  const onDelta = (chunk: string) => {
    const offset = buffer.length;
    buffer += chunk;
    eventBus.emitArtifactDelta(runId, { nodeRunId, offset, chunk });
    // 주기 flush는 대기하지 않는다(중간 스냅샷). 오류는 무시(최종 확정이 진실).
    void flush(false).catch(() => {});
  };

  try {
    if (format === "json") {
      const { text } = await runAgentJson({
        systemPrompt,
        userPrompt,
        model: config.model,
        abortController,
        onDelta,
        jsonSchema: config.jsonSchema,
        mountedTools,
        askHuman: askHandler,
      });
      await finalizeArtifact(art.id, text, null);
      return { ...art, content: text };
    }

    const { text } = await runAgent({
      systemPrompt,
      userPrompt,
      model: config.model,
      abortController,
      onDelta,
      mountedTools,
      askHuman: askHandler,
    });
    await flush(true);
    await finalizeArtifact(art.id, text, null);
    return { ...art, content: text };
  } catch (e) {
    await flush(true);
    throw e;
  }
}
