// 탭 편집기 — 중앙 영역. 캔버스 탭(항상) + 문서 탭 + 블록 정의 탭 + 노드 편집기 탭.
// M4: SidePanel 기능 → NodeEditor 탭으로 이관. 노드 클릭 시 노드 탭 열림.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { marked } from "marked";
import { api } from "@/lib/api";
import { NODE_COLOR, useCanvasStore } from "@/store/canvas";
import { useGraphSave } from "@/hooks/useGraphSave";
import type {
  AgentConfig,
  BlockDef,
  DocumentDetail,
  GateConfig,
  HumanConfig,
  InputConfig,
  NodeConfig,
  NodeRow,
  NodeRun,
  OutputConfig,
  RuleConfig,
  SkillConfig,
  ToolConfig,
} from "@/lib/types";
import styles from "./TabEditor.module.css";
import panelStyles from "./NodeEditor.module.css";
import { ScoreCard } from "./ScoreCard";
import {
  AgentForm,
  GateForm,
  getOverriddenKeys,
  HumanForm,
  InputForm,
  OutputForm,
  RuleForm,
  SkillForm,
  ToolForm,
} from "./ConfigForms";

// PipelineView는 dynamic import 불필요 — 이미 "use client"
import { PipelineView } from "@/components/canvas/PipelineView";

marked.setOptions({ gfm: true, breaks: false, async: false });

// ──────────────────────────────────────────────────────────
// 탭 타입 정의
// ──────────────────────────────────────────────────────────

type CanvasTab = { kind: "canvas" };
type DocumentTab = { kind: "document"; docId: string; name: string };
/** M4: 블록 정의 탭 — blockDefId로 정의 파일 편집. nodeId가 있으면 오버라이드 섹션도 표시. */
type BlockDefTab = { kind: "blockdef"; defId: string; name: string; nodeId?: string };
/** M4: 노드 편집기 탭 — 노드 클릭 시 열림. 속성 폼 + 아티팩트. */
type NodeTab = { kind: "node"; nodeId: string; name: string };

type Tab = CanvasTab | DocumentTab | BlockDefTab | NodeTab;

function tabId(t: Tab): string {
  if (t.kind === "canvas") return "canvas";
  if (t.kind === "document") return `doc:${t.docId}`;
  if (t.kind === "node") return `node:${t.nodeId}`;
  return `def:${t.defId}`;
}

// ──────────────────────────────────────────────────────────
// 문서 편집기 (탭 내부 컴포넌트)
// ──────────────────────────────────────────────────────────

function DocumentEditor({ docId }: { docId: string }) {
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  // dirty 상태를 ref로도 추적 — 이벤트 핸들러에서 stale closure 방지
  const dirtyRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    let cancelled = false;
    api.getDocument(docId).then((d) => {
      if (cancelled) return;
      setDetail(d);
      setContent(d.content);
      setDirty(false);
      dirtyRef.current = false;
    }).catch(() => {
      if (!cancelled) setDetail(null);
    });
    return () => { cancelled = true; };
  }, [docId]);

  // 문서 변경 SSE → 열린 문서면 재조회(M4 결정 4-G).
  // 사용자가 편집 중(dirty)이면 서버 내용으로 조용히 덮지 않는다.
  useEffect(() => {
    function onDocsChanged(e: Event) {
      const changedId = (e as CustomEvent<{ documentId: string }>).detail?.documentId;
      if (changedId !== docId) return;
      if (dirtyRef.current) return; // 편집 중 — 덮지 않음
      api.getDocument(docId).then((d) => {
        setDetail(d);
        setContent(d.content);
        setDirty(false);
        dirtyRef.current = false;
      }).catch(() => {});
    }
    window.addEventListener("rf:documentsChanged", onDocsChanged);
    return () => window.removeEventListener("rf:documentsChanged", onDocsChanged);
  }, [docId]);

  async function saveVersion() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const updated = await api.saveDocument(docId, content, "본문 편집");
      setDetail(updated);
      setDirty(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!detail) {
    return <div className={styles.loading}>문서를 여는 중…</div>;
  }

  return (
    <div className={styles.docEditor}>
      <div className={styles.docHead}>
        <b>{detail.name}</b>
        {justSaved && <span className={styles.saved}>✓ 저장됨</span>}
        <button
          className={styles.saveBtn}
          onClick={() => void saveVersion()}
          disabled={!dirty || saving}
        >
          {saving ? "저장 중…" : "버전 저장"}
        </button>
      </div>
      <div className={styles.docBody}>
        <textarea
          className={styles.docTextarea}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setDirty(true);
          }}
          placeholder="# 제목&#10;&#10;마크다운으로 JD·증거를 작성하세요…"
        />
        <div className={styles.docVersions}>
          <div className={styles.versionsHead}>버전 히스토리</div>
          <div className={styles.ver}>
            <b>v{detail.currentVersion} · 사람</b>
            {new Date(detail.createdAt).toLocaleString("ko-KR")}
            <br />
            현재 본문
          </div>
          <div className={styles.verNote}>
            버전 저장 시 새 버전이 기록됩니다. 전체 버전 목록·LLM 편집
            이력은 M2에서 노출됩니다.
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 블록 정의 편집기 (M4 결정 1·2)
// ──────────────────────────────────────────────────────────

type DefEditMode = "form" | "json";

function BlockDefEditor({ defId, nodeId }: { defId: string; nodeId?: string }) {
  const [def, setDef] = useState<BlockDef | null>(null);
  const [mode, setMode] = useState<DefEditMode>("form");
  const [config, setConfig] = useState<NodeConfig | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/block-defs/${defId}`)
      .then((r) => r.json())
      .then((d: BlockDef) => {
        if (cancelled) return;
        setDef(d);
        setConfig(d.config);
        setJsonText(JSON.stringify(d.config, null, 2));
        setDirty(false);
        setError(null);
        setJsonError(null);
      })
      .catch(() => {
        if (!cancelled) setError("블록 정의를 불러오지 못했습니다.");
      });
    return () => { cancelled = true; };
  }, [defId]);

  function switchMode(next: DefEditMode) {
    if (next === mode) return;
    if (mode === "form" && next === "json") {
      // form → json: config를 직렬화
      setJsonText(JSON.stringify(config, null, 2));
      setJsonError(null);
      setMode("json");
    } else if (mode === "json" && next === "form") {
      // json → form: 파싱 가능해야 전환
      try {
        const parsed = JSON.parse(jsonText) as NodeConfig;
        setConfig(parsed);
        setJsonError(null);
        setMode("form");
      } catch {
        setJsonError("JSON 형식 오류입니다. 수정 후 전환하세요.");
      }
    }
  }

  async function saveDef() {
    if (!dirty || saving || !def) return;
    setError(null);
    let parsed: NodeConfig;
    if (mode === "json") {
      try {
        parsed = JSON.parse(jsonText) as NodeConfig;
      } catch {
        setJsonError("JSON 형식 오류. 저장 전 수정하세요.");
        return;
      }
    } else {
      if (!config) return;
      parsed = config;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/block-defs/${defId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: parsed }),
      });
      if (!res.ok) throw new Error("저장 실패");
      const updated: BlockDef = await res.json();
      setDef(updated);
      setConfig(updated.config);
      setJsonText(JSON.stringify(updated.config, null, 2));
      setDirty(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
      // block_def 변경 브로드캐스트
      window.dispatchEvent(new CustomEvent("rf:blockDefsChanged"));
    } catch {
      setError("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !def) {
    return <div className={styles.loading}>{error}</div>;
  }
  if (!def || config === null) {
    return <div className={styles.loading}>블록 정의를 여는 중…</div>;
  }

  // 폼 모드에서 config 변경 처리
  function handleFormChange(next: NodeConfig) {
    setConfig(next);
    setDirty(true);
  }

  return (
    <div className={styles.docEditor}>
      <div className={styles.docHead}>
        {/* 왼쪽: 이름 + 타입 배지 */}
        <b>{def.name}</b>
        <span className={styles.defType}>{def.type}</span>
        {/* 중간: 폼/JSON 토글 */}
        <div className={styles.modeToggle}>
          <button
            className={`${styles.modeBtn} ${mode === "form" ? styles.modeBtnActive : ""}`}
            onClick={() => switchMode("form")}
          >
            폼
          </button>
          <button
            className={`${styles.modeBtn} ${mode === "json" ? styles.modeBtnActive : ""}`}
            onClick={() => switchMode("json")}
          >
            JSON
          </button>
        </div>
        {/* 오른쪽: 상태 + 저장 */}
        {justSaved && <span className={styles.saved}>✓ 저장됨</span>}
        {error && <span className={styles.defError}>{error}</span>}
        {jsonError && mode === "json" && (
          <span className={styles.defError}>{jsonError}</span>
        )}
        <button
          className={styles.saveBtn}
          onClick={() => void saveDef()}
          disabled={!dirty || saving}
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>
      <div className={styles.docBody}>
        <div className={styles.defSection}>
          {mode === "form" ? (
            // 폼 모드: 타입별 폼 렌더
            <div style={{ padding: "12px 16px", overflowY: "auto", flex: 1 }}>
              {def.type === "agent" && (
                <AgentForm
                  config={config as AgentConfig}
                  onChange={(c) => handleFormChange(c)}
                  overriddenKeys={null}
                  nodeId={nodeId ?? ""}
                />
              )}
              {def.type === "input" && (
                <InputForm
                  config={config as InputConfig}
                  onChange={(c) => handleFormChange(c)}
                  overriddenKeys={null}
                />
              )}
              {def.type === "output" && (
                <OutputForm
                  config={config as OutputConfig}
                  onChange={(c) => handleFormChange(c)}
                  overriddenKeys={null}
                />
              )}
              {def.type === "gate" && (
                <GateForm
                  config={config as GateConfig}
                  onChange={(c) => handleFormChange(c)}
                  nodeId={nodeId ?? ""}
                  overriddenKeys={null}
                />
              )}
              {def.type === "human" && (
                <HumanForm
                  config={config as HumanConfig}
                  onChange={(c) => handleFormChange(c)}
                  overriddenKeys={null}
                />
              )}
              {def.type === "skill" && (
                <SkillForm
                  config={config as SkillConfig}
                  onChange={(c) => handleFormChange(c)}
                  overriddenKeys={null}
                />
              )}
              {def.type === "rule" && (
                <RuleForm
                  config={config as RuleConfig}
                  onChange={(c) => handleFormChange(c)}
                  overriddenKeys={null}
                />
              )}
              {def.type === "tool" && (
                <ToolForm
                  config={config as ToolConfig}
                  onChange={(c) => handleFormChange(c)}
                  overriddenKeys={null}
                />
              )}
            </div>
          ) : (
            // JSON 모드: textarea
            <>
              <textarea
                className={styles.docTextarea}
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  setDirty(true);
                  setJsonError(null);
                }}
                spellCheck={false}
              />
              {jsonError && (
                <div className={styles.defError} style={{ padding: "4px 16px" }}>
                  {jsonError}
                </div>
              )}
            </>
          )}
        </div>
        {/* 오버라이드 섹션 — 노드 클릭으로 진입 시 표시 */}
        {nodeId && (
          <div className={styles.docVersions}>
            <div className={styles.versionsHead}>
              이 노드 오버라이드 ({nodeId.slice(0, 8)}…)
            </div>
            <div className={styles.verNote}>
              캔버스 이 노드에서만 적용되는 config 오버라이드는 노드 편집기 탭에서 편집하세요.
              여기서 편집한 내용은 <b>정의(모든 인스턴스)</b>에 반영됩니다.
              <br />
              <b>노드 이름</b>은 인스턴스 소유입니다 — 정의 이름 변경이 이 노드의 라벨을 바꾸지 않습니다.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// NodeEditor — SidePanel 기능 이관 (M4)
// ──────────────────────────────────────────────────────────

type PanelTab = "prop" | "art";

function NodeTitle({ node }: { node: NodeRow }) {
  return (
    <div className={panelStyles.nodeTitle}>
      <span className={panelStyles.dot} style={{ background: NODE_COLOR[node.type] }} />
      {node.name}
    </div>
  );
}

function NodeProperties({
  node,
  defConfigMap,
}: {
  node: NodeRow;
  defConfigMap: Record<string, NodeConfig>;
}) {
  const renameNode = useCanvasStore((s) => s.renameNode);
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig);
  const run = useCanvasStore((s) => s.run);
  const save = useGraphSave();
  const isRunning = run?.status === "running" || run?.status === "waiting_human";

  // 참조 노드 여부 및 정의 config
  const isRef = node.blockDefId !== null;
  const defConfig = isRef ? (defConfigMap[node.blockDefId!] ?? {}) : null;

  // 실효 config
  const resolvedConfig: NodeRow["config"] = isRef && defConfig
    ? { ...defConfig, ...node.config }
    : node.config;

  const setName = (name: string) => {
    renameNode(node.id, name);
    save();
  };

  const setConfig = (newEffective: NodeRow["config"]) => {
    if (isRef && defConfig) {
      const override: Record<string, unknown> = {};
      const def = defConfig as Record<string, unknown>;
      const eff = newEffective as Record<string, unknown>;
      for (const key of Object.keys(eff)) {
        if (JSON.stringify(eff[key]) !== JSON.stringify(def[key])) {
          override[key] = eff[key];
        }
      }
      updateNodeConfig(node.id, override as NodeRow["config"]);
    } else {
      updateNodeConfig(node.id, newEffective);
    }
    save();
  };

  return (
    <>
      <NodeTitle node={node} />
      {isRef && (
        <div className={panelStyles.refBadge} data-tip="블록 정의에서 상속된 노드입니다. 변경한 필드만 이 인스턴스에 저장됩니다.">
          정의 참조
        </div>
      )}
      <div className={panelStyles.field}>
        <label data-tip="노드 표시 이름">이름</label>
        <input value={node.name} onChange={(e) => setName(e.target.value)} />
      </div>

      {node.type === "agent" && (
        <AgentForm
          config={resolvedConfig as AgentConfig}
          onChange={setConfig}
          overriddenKeys={isRef ? getOverriddenKeys(node.config, defConfig) : null}
          nodeId={node.id}
        />
      )}
      {node.type === "input" && (
        <InputForm
          config={resolvedConfig as InputConfig}
          onChange={setConfig}
          overriddenKeys={isRef ? getOverriddenKeys(node.config, defConfig) : null}
        />
      )}
      {node.type === "output" && (
        <OutputForm
          config={resolvedConfig as OutputConfig}
          onChange={setConfig}
          overriddenKeys={isRef ? getOverriddenKeys(node.config, defConfig) : null}
        />
      )}
      {node.type === "gate" && (
        <GateForm
          config={resolvedConfig as GateConfig}
          onChange={setConfig}
          nodeId={node.id}
          overriddenKeys={isRef ? getOverriddenKeys(node.config, defConfig) : null}
        />
      )}
      {node.type === "human" && (
        <HumanForm
          config={resolvedConfig as HumanConfig}
          onChange={setConfig}
          overriddenKeys={isRef ? getOverriddenKeys(node.config, defConfig) : null}
        />
      )}
      {node.type === "skill" && (
        <SkillForm
          config={resolvedConfig as SkillConfig}
          onChange={setConfig}
          overriddenKeys={isRef ? getOverriddenKeys(node.config, defConfig) : null}
        />
      )}
      {node.type === "rule" && (
        <RuleForm
          config={resolvedConfig as RuleConfig}
          onChange={setConfig}
          overriddenKeys={isRef ? getOverriddenKeys(node.config, defConfig) : null}
        />
      )}
      {node.type === "tool" && (
        <ToolForm
          config={resolvedConfig as ToolConfig}
          onChange={setConfig}
          overriddenKeys={isRef ? getOverriddenKeys(node.config, defConfig) : null}
        />
      )}

      {isRunning && (
        <div className={panelStyles.runningNote}>
          실행 중 — 수정은 다음 run에 반영됩니다
        </div>
      )}
    </>
  );
}

function NodeArtifacts({
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

  const [iterations, setIterations] = useState<NodeRun[]>([]);
  const [selectedIteration, setSelectedIteration] = useState<number | null>(null);

  useEffect(() => {
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

  useEffect(() => {
    if (artifact && isHuman && humanConfig?.allowEdit) {
      setEditContent(artifact.content);
    }
  }, [artifact?.id]);

  async function handleApprove() {
    if (!nodeRunId || !run) return;
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

  const approveActions = (
    <div className={panelStyles.humanActions}>
      {humanConfig?.instruction && (
        <div className={panelStyles.humanInstruction}>{humanConfig.instruction}</div>
      )}
      <button
        className={panelStyles.approveBtn}
        onClick={handleApprove}
        disabled={approving || status !== "waiting_human"}
        data-testid="human-approve"
        data-tip="이 노드의 아티팩트를 승인하고 파이프라인 실행을 재개합니다"
      >
        {approving ? "승인 중…" : "승인"}
      </button>
      {approveMsg && <span className={panelStyles.approveMsg}>{approveMsg}</span>}
    </div>
  );

  if (!run) {
    return (
      <>
        <NodeTitle node={node} />
        <div className={panelStyles.empty}>
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
        <div className={panelStyles.empty}>
          {status
            ? "이 노드의 아티팩트를 기다리는 중…"
            : "이번 run에서 아직 실행되지 않은 노드입니다."}
        </div>
        {isHuman && status === "waiting_human" && approveActions}
      </>
    );
  }

  const isHtml = artifact.format === "html";
  const isJson = artifact.format === "json";

  return (
    <>
      <NodeTitle node={node} />
      {streaming && <div className={panelStyles.streamChip}>스트리밍 중</div>}

      {/* 회차 칩 */}
      {iterations.length > 1 && (
        <div className={panelStyles.rounds}>
          {iterations.map((nr) => (
            <span
              key={nr.id}
              className={nr.iteration === selectedIteration ? panelStyles.roundOn : undefined}
              onClick={() => setSelectedIteration(nr.iteration)}
              data-testid={`iteration-chip-${nr.iteration}`}
              data-tip={`${nr.iteration}회차 아티팩트 보기`}
            >
              {nr.iteration}회차
            </span>
          ))}
        </div>
      )}

      {artifact.format === "markdown" && !isHuman && (
        <div className={panelStyles.toolbar}>
          <button
            className={!raw ? panelStyles.on : undefined}
            onClick={() => setRaw(false)}
          >
            렌더링
          </button>
          <button
            className={raw ? panelStyles.on : undefined}
            onClick={() => setRaw(true)}
          >
            원문
          </button>
        </div>
      )}

      {isHtml && node.type === "output" && (
        <>
          <div className={panelStyles.toolbar}>
            <button
              className={panelStyles.dlBtn}
              onClick={() => onDownload(artifact.id)}
              data-testid="download-html-panel"
            >
              ⬇ HTML 다운로드
            </button>
          </div>
          <div className={panelStyles.preview}>
            <iframe title="이력서 미리보기" srcDoc={artifact.content} />
          </div>
        </>
      )}

      {isHuman && (
        <>
          {artifact.format === "markdown" ? (
            humanConfig?.allowEdit ? (
              <div className={panelStyles.field}>
                <label data-tip="내용을 직접 편집 후 승인할 수 있습니다">편집</label>
                <textarea
                  value={editContent ?? artifact.content}
                  rows={10}
                  onChange={(e) => setEditContent(e.target.value)}
                />
              </div>
            ) : (
              <div className={panelStyles.artifact}>
                <div dangerouslySetInnerHTML={{ __html: renderedMd }} />
              </div>
            )
          ) : (
            <div className={panelStyles.artifact}>
              <pre className={panelStyles.jsonView}>{artifact.content}</pre>
            </div>
          )}
          {approveActions}
        </>
      )}

      {artifact.format === "markdown" && !isHuman &&
        (raw ? (
          <div className={panelStyles.artifact}>
            <pre className={panelStyles.jsonView}>{artifact.content}</pre>
            {streaming && <span className={panelStyles.cursor} />}
          </div>
        ) : (
          <div className={panelStyles.artifact}>
            <div dangerouslySetInnerHTML={{ __html: renderedMd }} />
            {streaming && <span className={panelStyles.cursor} />}
          </div>
        ))}

      {isJson && (
        <ScoreCard
          artifact={artifact}
          iterations={iterations}
          artifactsMap={run?.artifacts ?? {}}
          streaming={streaming}
        />
      )}
    </>
  );
}

/** M4: 노드 편집기 탭 — SidePanel 기능 이관. */
function NodeEditor({
  nodeId,
  onDownload,
}: {
  nodeId: string;
  onDownload: (artifactId: string) => void;
}) {
  const [panelTab, setPanelTab] = useState<PanelTab>("prop");
  const nodes = useCanvasStore((s) => s.nodes);
  const node = nodes.find((n) => n.id === nodeId) ?? null;

  // blockDef config 맵 로드
  const [defConfigMap, setDefConfigMap] = useState<Record<string, NodeConfig>>({});

  const loadBlockDefs = useCallback(() => {
    fetch("/api/block-defs?all=1")
      .then((r) => r.json())
      .then((defs: BlockDef[]) => {
        const cm: Record<string, NodeConfig> = {};
        for (const d of defs) {
          cm[d.id] = d.config;
        }
        setDefConfigMap(cm);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadBlockDefs();
  }, [loadBlockDefs]);

  useEffect(() => {
    window.addEventListener("rf:blockDefsChanged", loadBlockDefs);
    return () => window.removeEventListener("rf:blockDefsChanged", loadBlockDefs);
  }, [loadBlockDefs]);

  if (!node) {
    return (
      <div className={panelStyles.panel}>
        <div className={panelStyles.empty}>
          노드를 찾을 수 없습니다. 캔버스 탭에서 노드를 클릭해 여세요.
        </div>
      </div>
    );
  }

  return (
    <div className={panelStyles.panel}>
      <div className={panelStyles.tabs}>
        <button
          className={panelTab === "prop" ? panelStyles.active : undefined}
          onClick={() => setPanelTab("prop")}
        >
          속성
        </button>
        <button
          className={panelTab === "art" ? panelStyles.active : undefined}
          onClick={() => setPanelTab("art")}
          data-testid="artifact-tab"
        >
          아티팩트
        </button>
      </div>
      <div className={panelStyles.body}>
        {panelTab === "prop" ? (
          <NodeProperties node={node} defConfigMap={defConfigMap} />
        ) : (
          <NodeArtifacts node={node} onDownload={onDownload} />
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// TabEditor 메인
// ──────────────────────────────────────────────────────────

interface Props {
  /** FileExplorer에서 문서 탭 열기 요청 */
  openDocumentRequest?: { docId: string; name: string } | null;
  /** FileExplorer에서 요청 처리 완료 콜백 */
  onOpenDocumentHandled?: () => void;
  /** M4: 블록 정의 탭 열기 요청 (FileExplorer / Canvas 노드 클릭) */
  openBlockDefRequest?: { defId: string; name: string } | null;
  /** M4: 블록 정의 탭 열기 처리 완료 콜백 */
  onOpenBlockDefHandled?: () => void;
  /** M4: 하위 컴포넌트(PipelineView)가 정의 탭 열기를 요청할 때 */
  onOpenBlockDef?: (defId: string, name: string) => void;
  /** M4: FileExplorer 블록 추가 요청 → PipelineView로 전달 */
  addBlockRequest?: { type: import("@/lib/types").NodeType; blockDef?: BlockDef } | null;
  /** M4: 트레이 승인 요청 → PipelineView로 전달 */
  approveTrayRequest?: BlockDef | null;
}

export function TabEditor({
  openDocumentRequest,
  onOpenDocumentHandled,
  openBlockDefRequest,
  onOpenBlockDefHandled,
  onOpenBlockDef,
  addBlockRequest: _addBlockRequest,
  approveTrayRequest: _approveTrayRequest,
}: Props) {
  const pathname = usePathname();
  const [tabs, setTabs] = useState<Tab[]>([{ kind: "canvas" }]);
  const [activeId, setActiveId] = useState<string>("canvas");
  const prevDocRequestRef = useRef<{ docId: string; name: string } | null>(null);
  const prevDefRequestRef = useRef<{ defId: string; name: string } | null>(null);

  // URL에서 pipelineId 추출 (/pipelines/[id])
  const pipelineId = pathname?.startsWith("/pipelines/")
    ? pathname.split("/")[2] ?? null
    : null;

  // 탐색기의 "캔버스" 항목 클릭 → 캔버스 탭 활성(FileExplorer가 발행).
  useEffect(() => {
    function onActivateCanvas() {
      setActiveId("canvas");
    }
    window.addEventListener("rf:activateCanvasTab", onActivateCanvas);
    return () => window.removeEventListener("rf:activateCanvasTab", onActivateCanvas);
  }, []);

  // 문서 삭제 이벤트 → 해당 탭 닫기 (FileExplorer가 발행).
  useEffect(() => {
    function onDocDeleted(e: Event) {
      const { docId } = (e as CustomEvent<{ docId: string }>).detail;
      const tabToClose = `doc:${docId}`;
      setTabs((prev) => prev.filter((t) => {
        if (t.kind === "document") return t.docId !== docId;
        return true;
      }));
      setActiveId((cur) => {
        if (cur !== tabToClose) return cur;
        return "canvas";
      });
    }
    window.addEventListener("rf:documentDeleted", onDocDeleted);
    return () => window.removeEventListener("rf:documentDeleted", onDocDeleted);
  }, []);

  // 문서 탭 열기 요청 처리
  useEffect(() => {
    if (!openDocumentRequest) return;
    const req = openDocumentRequest;
    if (
      prevDocRequestRef.current?.docId === req.docId &&
      prevDocRequestRef.current?.name === req.name
    ) {
      return;
    }
    prevDocRequestRef.current = req;

    const id = `doc:${req.docId}`;
    setTabs((prev) => {
      if (prev.some((t) => tabId(t) === id)) return prev;
      return [...prev, { kind: "document", docId: req.docId, name: req.name }];
    });
    setActiveId(id);
    onOpenDocumentHandled?.();
  }, [openDocumentRequest, onOpenDocumentHandled]);

  // M4: 블록 정의 탭 열기 요청 처리
  useEffect(() => {
    if (!openBlockDefRequest) return;
    const req = openBlockDefRequest;
    if (
      prevDefRequestRef.current?.defId === req.defId &&
      prevDefRequestRef.current?.name === req.name
    ) {
      return;
    }
    prevDefRequestRef.current = req;

    const id = `def:${req.defId}`;
    setTabs((prev) => {
      if (prev.some((t) => tabId(t) === id)) return prev;
      return [...prev, { kind: "blockdef", defId: req.defId, name: req.name }];
    });
    setActiveId(id);
    onOpenBlockDefHandled?.();
  }, [openBlockDefRequest, onOpenBlockDefHandled]);

  // M4: 캔버스 노드 클릭 → 노드 탭 열기 (blockDefId 있으면 blockdef 탭)
  const handleNodeClick = useCallback(
    async (nodeId: string, blockDefId: string | null) => {
      if (blockDefId) {
        // blockDefId 있음 → 정의 파일 탭 열기
        let name = blockDefId;
        try {
          const res = await fetch(`/api/block-defs/${blockDefId}`);
          if (res.ok) {
            const def: { name: string } = await res.json();
            name = def.name;
          }
        } catch {
          // 이름 조회 실패 시 id 사용
        }
        if (onOpenBlockDef) {
          onOpenBlockDef(blockDefId, name);
        } else {
          const id = `def:${blockDefId}`;
          setTabs((prev) => {
            if (prev.some((t) => tabId(t) === id)) return prev;
            return [...prev, { kind: "blockdef", defId: blockDefId, name, nodeId }];
          });
          setActiveId(id);
        }
      } else {
        // 맨손 노드 → 노드 편집기 탭 열기
        // 노드 이름 조회 (스토어에서)
        const storeNodes = useCanvasStore.getState().nodes;
        const node = storeNodes.find((n) => n.id === nodeId);
        const name = node?.name ?? nodeId;

        const id = `node:${nodeId}`;
        setTabs((prev) => {
          // 이미 열려 있으면 이름만 업데이트
          const exists = prev.some((t) => tabId(t) === id);
          if (exists) return prev.map((t) =>
            t.kind === "node" && t.nodeId === nodeId ? { ...t, name } : t
          );
          return [...prev, { kind: "node", nodeId, name }];
        });
        setActiveId(id);
      }
    },
    [onOpenBlockDef],
  );

  // M4: rf:humanNodeClick 이벤트 → 노드 탭 열기 (채팅 독 "사이드 패널에서 열기" 버튼)
  useEffect(() => {
    function onHumanNodeClick(e: Event) {
      const { nodeId } = (e as CustomEvent<{ nodeId: string }>).detail;
      void handleNodeClick(nodeId, null);
    }
    window.addEventListener("rf:humanNodeClick", onHumanNodeClick);
    return () => window.removeEventListener("rf:humanNodeClick", onHumanNodeClick);
  }, [handleNodeClick]);

  const onDownload = useCallback((artifactId: string) => {
    window.open(`/api/artifacts/${artifactId}/download`, "_blank");
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => prev.filter((t) => tabId(t) !== id));
      setActiveId((cur) => {
        if (cur !== id) return cur;
        return "canvas"; // 닫힌 탭이 활성이면 캔버스로 복귀
      });
    },
    [],
  );

  const activeTab = tabs.find((t) => tabId(t) === activeId) ?? tabs[0];

  return (
    <div className={styles.editor}>
      {/* 탭 바 */}
      <div className={styles.tabBar}>
        {tabs.map((tab) => {
          const id = tabId(tab);
          const label =
            tab.kind === "canvas"
              ? "캔버스"
              : tab.kind === "node"
              ? `노드: ${tab.name}`
              : tab.name;
          const isActive = activeId === id;
          return (
            <div
              key={id}
              className={`${styles.tab} ${isActive ? styles.active : ""}`}
            >
              <button
                className={styles.tabLabel}
                onClick={() => setActiveId(id)}
              >
                {label}
              </button>
              {tab.kind !== "canvas" && (
                <button
                  className={styles.tabClose}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(id);
                  }}
                  aria-label="탭 닫기"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 탭 콘텐츠 */}
      <div className={styles.content}>
        {/* 캔버스는 언마운트하지 않고 숨긴다(display:none). 언마운트하면
            ① 다른 탭에서 블록을 추가할 때 캔버스가 사라져 "안 나타남"이 되고
            ② 복귀 시 서버 재로드가 fire-and-forget 저장과 경쟁해 노드가
            유실될 수 있으며 ③ React Flow 뷰포트 상태도 날아간다. */}
        <div
          style={{
            display: activeTab?.kind === "canvas" ? "flex" : "none",
            flex: 1,
            minHeight: 0,
            minWidth: 0,
          }}
        >
          {pipelineId ? (
            <PipelineView pipelineId={pipelineId} onNodeClick={handleNodeClick} />
          ) : (
            <div className={styles.noPipeline}>
              왼쪽 상단에서 파이프라인을 선택하세요.
            </div>
          )}
        </div>
        {activeTab?.kind === "document" && (
          <DocumentEditor docId={activeTab.docId} />
        )}
        {activeTab?.kind === "blockdef" && (
          <BlockDefEditor defId={activeTab.defId} nodeId={activeTab.nodeId} />
        )}
        {activeTab?.kind === "node" && (
          <NodeEditor nodeId={activeTab.nodeId} onDownload={onDownload} />
        )}
      </div>
    </div>
  );
}
