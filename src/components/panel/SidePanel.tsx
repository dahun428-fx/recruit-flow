// 사이드 패널 — [속성]/[아티팩트] 탭.
// M2b: Gate/Human/Skill/Rule/Tool 폼 추가, 아티팩트 회차 칩, Human 편집+승인.
"use client";

import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import { api } from "@/lib/api";
import { NODE_COLOR, useCanvasStore } from "@/store/canvas";
import { useGraphSave } from "@/hooks/useGraphSave";
import type {
  AgentConfig,
  Document,
  GateConfig,
  HumanConfig,
  InputConfig,
  NodeRun,
  NodeRow,
  OutputConfig,
  RuleConfig,
  SkillConfig,
  ToolConfig,
} from "@/lib/types";
import styles from "./SidePanel.module.css";

marked.setOptions({ gfm: true, breaks: false, async: false });

type Tab = "prop" | "art";

interface Props {
  onDownload: (artifactId: string) => void;
}

export function SidePanel({ onDownload }: Props) {
  const [tab, setTab] = useState<Tab>("prop");
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const nodes = useCanvasStore((s) => s.nodes);
  const node = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <div className={styles.panel}>
      <div className={styles.tabs}>
        <button
          className={tab === "prop" ? styles.active : undefined}
          onClick={() => setTab("prop")}
        >
          속성
        </button>
        <button
          className={tab === "art" ? styles.active : undefined}
          onClick={() => setTab("art")}
        >
          아티팩트
        </button>
      </div>
      <div className={styles.body}>
        {!node ? (
          <div className={styles.empty}>
            노드를 선택하면 속성과 아티팩트를 봅니다.
          </div>
        ) : tab === "prop" ? (
          <Properties node={node} />
        ) : (
          <Artifacts node={node} onDownload={onDownload} />
        )}
      </div>
    </div>
  );
}

function NodeTitle({ node }: { node: NodeRow }) {
  return (
    <div className={styles.nodeTitle}>
      <span className={styles.dot} style={{ background: NODE_COLOR[node.type] }} />
      {node.name}
    </div>
  );
}

// ───────────────────────── 속성 ─────────────────────────

function Properties({ node }: { node: NodeRow }) {
  const renameNode = useCanvasStore((s) => s.renameNode);
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig);
  const run = useCanvasStore((s) => s.run);
  const save = useGraphSave();
  const isRunning = run?.status === "running" || run?.status === "waiting_human";

  const setName = (name: string) => {
    renameNode(node.id, name);
    save();
  };
  const setConfig = (config: NodeRow["config"]) => {
    updateNodeConfig(node.id, config);
    save();
  };

  return (
    <>
      <NodeTitle node={node} />
      <div className={styles.field}>
        <label data-tip="노드 표시 이름">이름</label>
        <input value={node.name} onChange={(e) => setName(e.target.value)} />
      </div>

      {node.type === "agent" && (
        <AgentForm config={node.config as AgentConfig} onChange={setConfig} />
      )}
      {node.type === "input" && (
        <InputForm config={node.config as InputConfig} onChange={setConfig} />
      )}
      {node.type === "output" && (
        <OutputForm config={node.config as OutputConfig} onChange={setConfig} />
      )}
      {node.type === "gate" && (
        <GateForm config={node.config as GateConfig} onChange={setConfig} nodeId={node.id} />
      )}
      {node.type === "human" && (
        <HumanForm config={node.config as HumanConfig} onChange={setConfig} />
      )}
      {node.type === "skill" && (
        <SkillForm config={node.config as SkillConfig} onChange={setConfig} />
      )}
      {node.type === "rule" && (
        <RuleForm config={node.config as RuleConfig} onChange={setConfig} />
      )}
      {node.type === "tool" && (
        <ToolForm config={node.config as ToolConfig} onChange={setConfig} />
      )}

      {isRunning && (
        <div className={styles.runningNote}>
          ⚠ 실행 중 — 수정은 다음 run에 반영됩니다
        </div>
      )}
    </>
  );
}

function AgentForm({
  config,
  onChange,
}: {
  config: AgentConfig;
  onChange: (c: AgentConfig) => void;
}) {
  // 장착된 Skill/Rule/Tool 목록(읽기 전용 — 배선은 캔버스에서)
  const edges = useCanvasStore((s) => s.edges);
  const nodes = useCanvasStore((s) => s.nodes);
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const mountedNodes = edges
    .filter((e) => e.kind === "mount" && e.targetNodeId === selectedNodeId)
    .map((e) => nodes.find((n) => n.id === e.sourceNodeId))
    .filter(Boolean) as NodeRow[];

  return (
    <>
      <div className={styles.field}>
        <label data-tip="이 에이전트의 역할을 정의하는 시스템 프롬프트. doc: 접두사로 문서를 포인터로 삽입">
          역할
        </label>
        <textarea
          value={config.role}
          placeholder="예: JD에 비추어 이력서 초안을 작성한다…"
          onChange={(e) => onChange({ ...config, role: e.target.value })}
        />
      </div>
      <div className={styles.field}>
        <label data-tip="아티팩트 형태. 산문은 마크다운, 채점은 JSON">
          출력 형식
        </label>
        <select
          value={config.outputFormat}
          onChange={(e) =>
            onChange({
              ...config,
              outputFormat: e.target.value as AgentConfig["outputFormat"],
            })
          }
        >
          <option value="markdown">마크다운</option>
          <option value="json">JSON</option>
        </select>
      </div>
      {mountedNodes.length > 0 && (
        <div className={styles.field}>
          <label data-tip="캔버스에서 점선으로 장착된 블록들. 배선 변경은 캔버스에서">
            장착됨
          </label>
          <div className={styles.mountedList}>
            {mountedNodes.map((n) => (
              <span key={n.id} className={styles.mountedChip}>
                {n.type.toUpperCase()} {n.name}
              </span>
            ))}
          </div>
        </div>
      )}
      <details className={styles.adv}>
        <summary data-tip="자주 바꾸지 않는 설정. 기본값으로 두면 됩니다">
          고급 설정
        </summary>
        <div className={styles.field}>
          <label data-tip="미지정 시 엔진 기본 모델">모델</label>
          <input
            value={config.model ?? ""}
            placeholder="(기본 모델)"
            onChange={(e) =>
              onChange({ ...config, model: e.target.value || undefined })
            }
          />
        </div>
        {config.outputFormat === "json" && (
          <div className={styles.field}>
            <label data-tip="JSON 출력의 구조를 강제하는 스키마(텍스트)">
              JSON 스키마
            </label>
            <textarea
              value={config.jsonSchema ?? ""}
              placeholder='{ "score": "number", "issues": "string[]" }'
              onChange={(e) =>
                onChange({ ...config, jsonSchema: e.target.value || undefined })
              }
            />
          </div>
        )}
        <div className={styles.field}>
          <label data-tip="증거가 부족한 갭을 발견했을 때의 행동. ask=멈추고 묻기, annotate=[확인 필요] 표시 후 계속">
            갭 인터뷰 모드
          </label>
          <select
            value={config.gapMode ?? "annotate"}
            onChange={(e) =>
              onChange({
                ...config,
                gapMode: e.target.value as AgentConfig["gapMode"],
              })
            }
          >
            <option value="annotate">[확인 필요] 표시하고 계속</option>
            <option value="ask">멈추고 묻기</option>
          </select>
        </div>
      </details>
    </>
  );
}

function InputForm({
  config,
  onChange,
}: {
  config: InputConfig;
  onChange: (c: InputConfig) => void;
}) {
  const [docs, setDocs] = useState<Document[]>([]);
  useEffect(() => {
    api.listDocuments().then(setDocs).catch(() => {});
  }, []);

  return (
    <>
      <div className={styles.field}>
        <label data-tip="문서 라이브러리에서 이 Input이 공급할 문서를 선택">
          문서 선택
        </label>
        <select
          value={config.documentId ?? ""}
          onChange={(e) =>
            onChange({
              ...config,
              documentId: e.target.value || undefined,
              inlineText: e.target.value ? undefined : config.inlineText,
            })
          }
        >
          <option value="">(문서 선택)</option>
          {docs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <details className={styles.adv}>
        <summary data-tip="문서 대신 직접 입력한 텍스트를 공급">
          고급 설정
        </summary>
        <div className={styles.field}>
          <label data-tip="documentId 대신 인라인 텍스트 모드">
            인라인 텍스트
          </label>
          <textarea
            value={config.inlineText ?? ""}
            placeholder="문서 대신 직접 입력…"
            onChange={(e) =>
              onChange({
                ...config,
                inlineText: e.target.value || undefined,
                documentId: e.target.value ? undefined : config.documentId,
              })
            }
          />
        </div>
      </details>
    </>
  );
}

function OutputForm({
  config,
  onChange,
}: {
  config: OutputConfig;
  onChange: (c: OutputConfig) => void;
}) {
  return (
    <>
      <div className={styles.field}>
        <label data-tip="최종 마크다운을 렌더링할 HTML 템플릿">템플릿</label>
        <select
          value={config.templateId}
          onChange={(e) => onChange({ ...config, templateId: e.target.value })}
        >
          <option value="default">기본 (미니멀 이력서)</option>
        </select>
      </div>
      <details className={styles.adv}>
        <summary data-tip="자주 바꾸지 않는 설정">고급 설정</summary>
        <div className={styles.field}>
          <label data-tip="다운로드 파일명 규칙">파일명 규칙</label>
          <input
            value={config.filenameRule ?? ""}
            placeholder="(기본: resume-<id>.html)"
            onChange={(e) =>
              onChange({ ...config, filenameRule: e.target.value || undefined })
            }
          />
        </div>
      </details>
    </>
  );
}

function GateForm({
  config,
  onChange,
  nodeId,
}: {
  config: GateConfig;
  onChange: (c: GateConfig) => void;
  nodeId: string;
}) {
  const nodes = useCanvasStore((s) => s.nodes);
  const execNodes = nodes.filter(
    (n) => n.id !== nodeId && !["skill", "rule", "tool"].includes(n.type),
  );

  return (
    <>
      <div className={styles.field}>
        <label data-tip="LLM 없이 코드로 평가되는 조건식. 예: score >= 8 또는 recruiter-screen.total >= 80 && tech-screen.total >= 80">
          조건식
        </label>
        <input
          value={config.expr}
          placeholder="예: score >= 80"
          onChange={(e) => onChange({ ...config, expr: e.target.value })}
        />
      </div>
      <details className={styles.adv}>
        <summary data-tip="Gate 루프·실패 동작 설정">고급 설정</summary>
        <div className={styles.field}>
          <label data-tip="최대 루프 횟수. 초과 시 run이 gate_failed로 종료됩니다">
            최대 루프
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={config.maxLoops}
            onChange={(e) =>
              onChange({ ...config, maxLoops: Number(e.target.value) || 3 })
            }
          />
        </div>
        <div className={styles.field}>
          <label data-tip="fail 시 재실행 시작 노드. 미지정 시 상류 마크다운 생성 노드">
            실패 시 재실행 노드
          </label>
          <select
            value={config.failTargetNodeId ?? ""}
            onChange={(e) =>
              onChange({
                ...config,
                failTargetNodeId: e.target.value || undefined,
              })
            }
          >
            <option value="">(자동 — 상류 마크다운 노드)</option>
            {execNodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name} ({n.type})
              </option>
            ))}
          </select>
        </div>
      </details>
    </>
  );
}

function HumanForm({
  config,
  onChange,
}: {
  config: HumanConfig;
  onChange: (c: HumanConfig) => void;
}) {
  return (
    <>
      <div className={styles.field}>
        <label data-tip="실행이 멈춘 후 사람에게 보여줄 안내 메시지">
          지시문
        </label>
        <textarea
          value={config.instruction}
          placeholder="예: 초안을 검토하고 필요 시 수정 후 승인해 주세요."
          onChange={(e) => onChange({ ...config, instruction: e.target.value })}
        />
      </div>
      <details className={styles.adv}>
        <summary data-tip="Human 노드 동작 설정">고급 설정</summary>
        <div className={styles.field}>
          <label data-tip="체크 시 사람이 아티팩트를 직접 편집 후 승인할 수 있습니다">
            <input
              type="checkbox"
              checked={config.allowEdit}
              onChange={(e) =>
                onChange({ ...config, allowEdit: e.target.checked })
              }
            />
            {" "}편집 허용
          </label>
        </div>
      </details>
    </>
  );
}

function SkillForm({
  config,
  onChange,
}: {
  config: SkillConfig;
  onChange: (c: SkillConfig) => void;
}) {
  return (
    <div className={styles.field}>
      <label data-tip="Agent 시스템 프롬프트에 주입될 기술 마크다운">
        내용
      </label>
      <textarea
        value={config.content}
        placeholder="예: ## 채점 가이드라인&#10;- 성과는 숫자로 표현…"
        rows={8}
        onChange={(e) => onChange({ ...config, content: e.target.value })}
      />
    </div>
  );
}

function RuleForm({
  config,
  onChange,
}: {
  config: RuleConfig;
  onChange: (c: RuleConfig) => void;
}) {
  return (
    <div className={styles.field}>
      <label data-tip="Agent 시스템 프롬프트 뒤에 append될 규칙 마크다운">
        내용
      </label>
      <textarea
        value={config.content}
        placeholder="예: ## 제약 규칙&#10;- 성과는 반드시 숫자로…"
        rows={8}
        onChange={(e) => onChange({ ...config, content: e.target.value })}
      />
    </div>
  );
}

function ToolForm({
  config,
  onChange,
}: {
  config: ToolConfig;
  onChange: (c: ToolConfig) => void;
}) {
  return (
    <div className={styles.field}>
      <label data-tip="Agent에 장착할 내장 도구. get_document=문서 ID로 조회, search_documents=키워드 검색">
        도구
      </label>
      <select
        value={config.toolName}
        onChange={(e) =>
          onChange({
            ...config,
            toolName: e.target.value as ToolConfig["toolName"],
          })
        }
      >
        <option value="get_document">get_document(id)</option>
        <option value="search_documents">search_documents(query)</option>
      </select>
    </div>
  );
}

// ─────────────────────── 아티팩트 ───────────────────────

function Artifacts({
  node,
  onDownload,
}: {
  node: NodeRow;
  onDownload: (artifactId: string) => void;
}) {
  const run = useCanvasStore((s) => s.run);
  const pipelineId = useCanvasStore((s) => s.pipelineId);
  const [raw, setRaw] = useState(false);
  const [editContent, setEditContent] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveMsg, setApproveMsg] = useState<string | null>(null);

  // 이 노드의 모든 nodeRun(회차별) — run.nodeRuns에서 뽑기
  // 스토어에 전체 nodeRuns 없으므로 run.nodeRunId와 run.artifacts만 사용.
  // 회차 칩: nodeRunId가 여러 개일 수 있지만 현재 스토어는 최신 것만 보관.
  // M2 범위에서 최신 회차만 표시(회차 칩은 API 사용시 구현).
  const [iterations, setIterations] = useState<NodeRun[]>([]);
  const [selectedIteration, setSelectedIteration] = useState<number | null>(null);

  useEffect(() => {
    // run이 있으면 노드의 모든 회차를 조회
    if (!run || !pipelineId) {
      setIterations([]);
      return;
    }
    fetch(`/api/runs/${run.runId}`)
      .then((r) => r.json())
      .then((state: { nodeRuns: NodeRun[] }) => {
        const nodeIter = state.nodeRuns.filter((nr) => nr.nodeId === node.id);
        setIterations(nodeIter);
        if (nodeIter.length > 0) setSelectedIteration(nodeIter[nodeIter.length - 1].iteration);
      })
      .catch(() => {});
  }, [run?.runId, node.id, pipelineId]);

  // 선택된 회차의 nodeRunId
  const selectedNodeRun = iterations.find((nr) => nr.iteration === selectedIteration);
  const nodeRunId = selectedNodeRun?.id ?? run?.nodeRunId[node.id];
  const artifact = nodeRunId ? run?.artifacts[nodeRunId] : undefined;
  const status = run?.nodeStatus[node.id];
  const streaming = status === "running";

  const isHuman = node.type === "human";
  const humanConfig = isHuman ? (node.config as HumanConfig) : null;

  const renderedMd = useMemo(() => {
    if (!artifact || artifact.format !== "markdown") return "";
    return marked.parse(artifact.content) as string;
  }, [artifact]);

  // Human 편집 초기화
  useEffect(() => {
    if (artifact && isHuman && humanConfig?.allowEdit) {
      setEditContent(artifact.content);
    }
  }, [artifact?.id]);

  async function handleApprove() {
    if (!nodeRunId || !run) return;
    // nodeRunId를 key로 실제 node_run id 조회
    const nrId = selectedNodeRun?.id ?? Object.entries(run.nodeRunId).find(([k]) => k === node.id)?.[1];
    if (!nrId) return;
    setApproving(true);
    try {
      const body: { editedContent?: string } = {};
      if (humanConfig?.allowEdit && editContent !== null) {
        body.editedContent = editContent;
      }
      const res = await fetch(`/api/node-runs/${nrId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setApproveMsg("승인 완료");
      } else {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setApproveMsg(err.error ?? "승인 실패");
      }
    } finally {
      setApproving(false);
    }
  }

  if (!run) {
    return (
      <>
        <NodeTitle node={node} />
        <div className={styles.empty}>
          아직 실행 기록이 없습니다. 상단 ▶ 실행 후 이 노드의 아티팩트가
          여기에 스트리밍됩니다.
        </div>
      </>
    );
  }

  if (!artifact) {
    return (
      <>
        <NodeTitle node={node} />
        <div className={styles.empty}>
          {status
            ? "이 노드의 아티팩트를 기다리는 중…"
            : "이번 run에서 아직 실행되지 않은 노드입니다."}
        </div>
      </>
    );
  }

  const isHtml = artifact.format === "html";
  const isJson = artifact.format === "json";

  return (
    <>
      <NodeTitle node={node} />
      {streaming && <div className={styles.streamChip}>스트리밍 중</div>}

      {/* 회차 칩 */}
      {iterations.length > 1 && (
        <div className={styles.rounds}>
          {iterations.map((nr) => (
            <span
              key={nr.id}
              className={nr.iteration === selectedIteration ? styles.roundOn : undefined}
              onClick={() => setSelectedIteration(nr.iteration)}
              data-tip={`${nr.iteration}회차 아티팩트 보기`}
            >
              {nr.iteration}회차
            </span>
          ))}
        </div>
      )}

      {artifact.format === "markdown" && !isHuman && (
        <div className={styles.toolbar}>
          <button
            className={!raw ? styles.on : undefined}
            onClick={() => setRaw(false)}
          >
            렌더링
          </button>
          <button
            className={raw ? styles.on : undefined}
            onClick={() => setRaw(true)}
          >
            원문
          </button>
        </div>
      )}

      {isHtml && node.type === "output" && (
        <>
          <div className={styles.toolbar}>
            <button
              className={styles.dlBtn}
              onClick={() => onDownload(artifact.id)}
            >
              ⬇ HTML 다운로드
            </button>
          </div>
          <div className={styles.preview}>
            <iframe title="이력서 미리보기" srcDoc={artifact.content} />
          </div>
        </>
      )}

      {/* Human 노드: 편집 가능 텍스트 + 승인 버튼 */}
      {isHuman && artifact.format === "markdown" && (
        <>
          {humanConfig?.allowEdit ? (
            <div className={styles.field}>
              <label data-tip="내용을 직접 편집 후 승인할 수 있습니다">편집</label>
              <textarea
                value={editContent ?? artifact.content}
                rows={10}
                onChange={(e) => setEditContent(e.target.value)}
              />
            </div>
          ) : (
            <div className={styles.artifact}>
              <div dangerouslySetInnerHTML={{ __html: renderedMd }} />
            </div>
          )}
          <div className={styles.humanActions}>
            {humanConfig?.instruction && (
              <div className={styles.humanInstruction}>{humanConfig.instruction}</div>
            )}
            <button
              className={styles.approveBtn}
              onClick={handleApprove}
              disabled={approving || status !== "waiting_human"}
              data-tip="이 노드의 아티팩트를 승인하고 파이프라인 실행을 재개합니다"
            >
              {approving ? "승인 중…" : "승인"}
            </button>
            {approveMsg && <span className={styles.approveMsg}>{approveMsg}</span>}
          </div>
        </>
      )}

      {artifact.format === "markdown" && !isHuman &&
        (raw ? (
          <div className={styles.artifact}>
            <pre className={styles.jsonView}>{artifact.content}</pre>
            {streaming && <span className={styles.cursor} />}
          </div>
        ) : (
          <div className={styles.artifact}>
            <div dangerouslySetInnerHTML={{ __html: renderedMd }} />
            {streaming && <span className={styles.cursor} />}
          </div>
        ))}

      {isJson && (
        <div className={styles.artifact}>
          <pre className={styles.jsonView}>{formatJson(artifact.content)}</pre>
          {streaming && <span className={styles.cursor} />}
        </div>
      )}
    </>
  );
}

/** JSON 구조화 뷰 — 파싱되면 들여쓰기, 아니면(스트리밍 중 미완) 원문. */
function formatJson(content: string): string {
  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}
