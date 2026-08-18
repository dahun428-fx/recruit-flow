// ConfigForms.tsx — 노드 타입별 설정 폼 컴포넌트 모음.
// BlockDefEditor(폼 모드)와 NodeProperties 양쪽에서 공용으로 사용된다.
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useCanvasStore } from "@/store/canvas";
import type {
  AgentConfig,
  Document,
  GateConfig,
  HumanConfig,
  InputConfig,
  NodeConfig,
  NodeRow,
  OutputConfig,
  RuleConfig,
  SkillConfig,
  ToolConfig,
} from "@/lib/types";
import panelStyles from "./NodeEditor.module.css";

// ──────────────────────────────────────────────────────────
// 오버라이드 키 계산
// ──────────────────────────────────────────────────────────

export function getOverriddenKeys(
  instanceConfig: NodeRow["config"],
  defConfig: NodeConfig | null,
): Set<string> | null {
  if (!defConfig) return null;
  const inst = instanceConfig as Record<string, unknown>;
  const def = defConfig as Record<string, unknown>;
  const keys = new Set<string>();
  for (const key of Object.keys(inst)) {
    if (JSON.stringify(inst[key]) !== JSON.stringify(def[key])) {
      keys.add(key);
    }
  }
  return keys;
}

// ──────────────────────────────────────────────────────────
// 공통 필드 레이블
// ──────────────────────────────────────────────────────────

export function FieldLabel({
  fieldKey,
  children,
  overriddenKeys,
  tip,
}: {
  fieldKey: string;
  children: React.ReactNode;
  overriddenKeys: Set<string> | null;
  tip?: string;
}) {
  const isOverridden = overriddenKeys?.has(fieldKey) ?? false;
  return (
    <label data-tip={tip}>
      {children}
      {overriddenKeys !== null && (
        <span className={isOverridden ? panelStyles.overriddenMark : panelStyles.inheritedMark}>
          {isOverridden ? " (수정됨)" : " (상속)"}
        </span>
      )}
    </label>
  );
}

// ──────────────────────────────────────────────────────────
// 타입별 폼 컴포넌트
// ──────────────────────────────────────────────────────────

export function AgentForm({
  config,
  onChange,
  overriddenKeys,
  nodeId,
}: {
  config: AgentConfig;
  onChange: (c: AgentConfig) => void;
  overriddenKeys: Set<string> | null;
  nodeId: string;
}) {
  const edges = useCanvasStore((s) => s.edges);
  const nodes = useCanvasStore((s) => s.nodes);
  const mountedNodes = edges
    .filter((e) => e.kind === "mount" && e.targetNodeId === nodeId)
    .map((e) => nodes.find((n) => n.id === e.sourceNodeId))
    .filter(Boolean) as NodeRow[];

  return (
    <>
      <div className={panelStyles.field}>
        <FieldLabel
          fieldKey="role"
          overriddenKeys={overriddenKeys}
          tip="이 에이전트의 역할을 정의하는 시스템 프롬프트. doc: 접두사로 문서를 포인터로 삽입"
        >
          역할
        </FieldLabel>
        <textarea
          value={config.role}
          placeholder="예: JD에 비추어 이력서 초안을 작성한다…"
          onChange={(e) => onChange({ ...config, role: e.target.value })}
        />
      </div>
      <div className={panelStyles.field}>
        <FieldLabel
          fieldKey="outputFormat"
          overriddenKeys={overriddenKeys}
          tip="아티팩트 형태. 산문은 마크다운, 채점은 JSON"
        >
          출력 형식
        </FieldLabel>
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
        <div className={panelStyles.field}>
          <label data-tip="캔버스에서 점선으로 장착된 블록들. 배선 변경은 캔버스에서">
            장착됨
          </label>
          <div className={panelStyles.mountedList}>
            {mountedNodes.map((n) => (
              <span key={n.id} className={panelStyles.mountedChip}>
                {n.type.toUpperCase()} {n.name}
              </span>
            ))}
          </div>
        </div>
      )}
      <details className={panelStyles.adv}>
        <summary data-tip="자주 바꾸지 않는 설정. 기본값으로 두면 됩니다">
          고급 설정
        </summary>
        <div className={panelStyles.field}>
          <FieldLabel
            fieldKey="model"
            overriddenKeys={overriddenKeys}
            tip="미지정 시 엔진 기본 모델"
          >
            모델
          </FieldLabel>
          <input
            value={config.model ?? ""}
            placeholder="(기본 모델)"
            onChange={(e) =>
              onChange({ ...config, model: e.target.value || undefined })
            }
          />
        </div>
        {config.outputFormat === "json" && (
          <div className={panelStyles.field}>
            <FieldLabel
              fieldKey="jsonSchema"
              overriddenKeys={overriddenKeys}
              tip="JSON 출력의 구조를 강제하는 스키마(텍스트)"
            >
              JSON 스키마
            </FieldLabel>
            <textarea
              className={panelStyles.code}
              value={config.jsonSchema ?? ""}
              placeholder='{ "score": "number", "issues": "string[]" }'
              onChange={(e) =>
                onChange({ ...config, jsonSchema: e.target.value || undefined })
              }
            />
          </div>
        )}
        <div className={panelStyles.field}>
          <FieldLabel
            fieldKey="gapMode"
            overriddenKeys={overriddenKeys}
            tip="증거가 부족한 갭을 발견했을 때의 행동. ask=멈추고 묻기, annotate=[확인 필요] 표시 후 계속"
          >
            갭 인터뷰 모드
          </FieldLabel>
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

export function InputForm({
  config,
  onChange,
  overriddenKeys,
}: {
  config: InputConfig;
  onChange: (c: InputConfig) => void;
  overriddenKeys: Set<string> | null;
}) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [docsLoaded, setDocsLoaded] = useState(false);
  // JD 붙여넣기 — documentId 모드용 상태
  const [pasteText, setPasteText] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    api
      .listDocuments()
      .then((d) => {
        setDocs(d);
        setDocsLoaded(true);
      })
      .catch(() => setDocsLoaded(true));
  }, []);

  // 선택된 문서 정보 조회
  const selectedDoc = docs.find((d) => d.id === config.documentId);

  /** documentId 모드: 참조 문서에 author=human 새 버전 저장 */
  async function handleSaveVersion() {
    if (!config.documentId || !pasteText.trim()) return;
    setSaveStatus("saving");
    try {
      await api.saveDocument(config.documentId, pasteText.trim());
      setSaveStatus("saved");
      setPasteText("");
      // 버전 번호 갱신을 위해 문서 목록 재조회
      api.listDocuments().then(setDocs).catch(() => {});
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  return (
    <>
      <div className={panelStyles.field}>
        <FieldLabel
          fieldKey="documentId"
          overriddenKeys={overriddenKeys}
          tip="문서 라이브러리에서 이 Input이 공급할 문서를 선택"
        >
          문서 선택
        </FieldLabel>
        <select
          value={config.documentId ?? ""}
          onChange={(e) => {
            setPasteText("");
            setSaveStatus("idle");
            onChange({
              ...config,
              documentId: e.target.value || undefined,
              inlineText: e.target.value ? undefined : config.inlineText,
            });
          }}
        >
          <option value="">(문서 선택)</option>
          {docs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* 참조 documentId가 있으나 문서 목록에 없음 = 삭제/교체된 문서를 가리킴.
          붙여넣기 저장 박스는 대상이 없어 무조건 실패하므로, 대신 재선택을 안내한다. */}
      {config.documentId && docsLoaded && !selectedDoc && (
        <div
          className={panelStyles.field}
          style={{ color: "#e53e3e", fontSize: 12, lineHeight: 1.6 }}
        >
          참조 문서를 찾을 수 없습니다(삭제되었거나 교체됨). 위의 <b>문서 선택</b>에서
          문서를 다시 지정하세요 — 그래야 새 버전 저장·실행이 됩니다.
        </div>
      )}

      {/* documentId 모드: JD 붙여넣기 — 새 버전 저장 (M5 워크스트림 A-3).
          참조 문서가 실제로 존재할 때만 노출(없으면 저장 대상이 없어 실패). */}
      {config.documentId && selectedDoc && (
        <div className={panelStyles.field}>
          <label
            data-tip="참조 문서에 새 내용을 붙여넣으면 다음 run이 이 버전을 사용합니다. documentId 재배선 없이 JD를 교체할 수 있습니다(nodes.md §3 JD 교체 반복 루프 규약)"
          >
            내용 붙여넣기 → 새 버전 저장
            {selectedDoc && (
              <span style={{ marginLeft: 6, color: "#aab0bc", fontWeight: 400 }}>
                ({selectedDoc.name} · v{selectedDoc.currentVersion})
              </span>
            )}
          </label>
          <textarea
            value={pasteText}
            placeholder="새 JD 전문을 붙여넣으세요…"
            rows={6}
            onChange={(e) => {
              setPasteText(e.target.value);
              if (saveStatus !== "idle") setSaveStatus("idle");
            }}
          />
          <button
            onClick={() => void handleSaveVersion()}
            disabled={!pasteText.trim() || saveStatus === "saving"}
            style={{
              marginTop: 6,
              padding: "5px 14px",
              borderRadius: 7,
              border: "1px solid var(--border)",
              background: pasteText.trim() ? "var(--c-input, #2b7fff)" : "#e5e8ec",
              color: pasteText.trim() ? "#fff" : "#aab0bc",
              cursor: pasteText.trim() ? "pointer" : "default",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {saveStatus === "saving" ? "저장 중…" : "새 버전 저장"}
          </button>
          {saveStatus === "saved" && (
            <div className={panelStyles.runningNote} style={{ color: "#2b7fff", marginTop: 6 }}>
              저장 완료 — 다음 run에 반영됩니다
            </div>
          )}
          {saveStatus === "error" && (
            <div className={panelStyles.runningNote} style={{ color: "#e53e3e", marginTop: 6 }}>
              저장 실패 — 다시 시도해 주세요
            </div>
          )}
        </div>
      )}

      {/* inlineText 모드: 인라인 텍스트를 직접 편집 (고급 설정) */}
      <details className={panelStyles.adv}>
        <summary data-tip="문서 대신 직접 입력한 텍스트를 공급. documentId 미선택 시 이 텍스트가 Input 아티팩트가 됩니다">
          고급 설정
        </summary>
        <div className={panelStyles.field}>
          <FieldLabel
            fieldKey="inlineText"
            overriddenKeys={overriddenKeys}
            tip="documentId 대신 인라인 텍스트 모드. 내용을 바꾸면 저장 후 다음 run에 반영됩니다"
          >
            인라인 텍스트
          </FieldLabel>
          <textarea
            className={panelStyles.code}
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

export function OutputForm({
  config,
  onChange,
  overriddenKeys,
}: {
  config: OutputConfig;
  onChange: (c: OutputConfig) => void;
  overriddenKeys: Set<string> | null;
}) {
  return (
    <>
      <div className={panelStyles.field}>
        <FieldLabel
          fieldKey="templateId"
          overriddenKeys={overriddenKeys}
          tip="최종 마크다운을 렌더링할 HTML 템플릿"
        >
          템플릿
        </FieldLabel>
        <select
          value={config.templateId}
          onChange={(e) => onChange({ ...config, templateId: e.target.value })}
        >
          <option value="default">기본 (미니멀 이력서)</option>
        </select>
      </div>
      <details className={panelStyles.adv}>
        <summary data-tip="자주 바꾸지 않는 설정">고급 설정</summary>
        <div className={panelStyles.field}>
          <FieldLabel
            fieldKey="filenameRule"
            overriddenKeys={overriddenKeys}
            tip="다운로드 파일명 규칙"
          >
            파일명 규칙
          </FieldLabel>
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

export function GateForm({
  config,
  onChange,
  nodeId,
  overriddenKeys,
}: {
  config: GateConfig;
  onChange: (c: GateConfig) => void;
  nodeId: string;
  overriddenKeys: Set<string> | null;
}) {
  const nodes = useCanvasStore((s) => s.nodes);
  const execNodes = nodes.filter(
    (n) => n.id !== nodeId && !["skill", "rule", "tool"].includes(n.type),
  );

  return (
    <>
      <div className={panelStyles.field}>
        <FieldLabel
          fieldKey="expr"
          overriddenKeys={overriddenKeys}
          tip="LLM 없이 코드로 평가되는 조건식. 예: score >= 8 또는 recruiter-screen.total >= 80 && tech-screen.total >= 80"
        >
          조건식
        </FieldLabel>
        <input
          value={config.expr}
          placeholder="예: score >= 80"
          onChange={(e) => onChange({ ...config, expr: e.target.value })}
        />
      </div>
      <details className={panelStyles.adv}>
        <summary data-tip="Gate 루프·실패 동작 설정">고급 설정</summary>
        <div className={panelStyles.field}>
          <FieldLabel
            fieldKey="maxLoops"
            overriddenKeys={overriddenKeys}
            tip="최대 루프 횟수. 초과 시 run이 gate_failed로 종료됩니다"
          >
            최대 루프
          </FieldLabel>
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
        <div className={panelStyles.field}>
          <FieldLabel
            fieldKey="failTargetNodeId"
            overriddenKeys={overriddenKeys}
            tip="fail 시 재실행 시작 노드. 미지정 시 상류 마크다운 생성 노드"
          >
            실패 시 재실행 노드
          </FieldLabel>
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

export function HumanForm({
  config,
  onChange,
  overriddenKeys,
}: {
  config: HumanConfig;
  onChange: (c: HumanConfig) => void;
  overriddenKeys: Set<string> | null;
}) {
  return (
    <>
      <div className={panelStyles.field}>
        <FieldLabel
          fieldKey="instruction"
          overriddenKeys={overriddenKeys}
          tip="실행이 멈춘 후 사람에게 보여줄 안내 메시지"
        >
          지시문
        </FieldLabel>
        <textarea
          value={config.instruction}
          placeholder="예: 초안을 검토하고 필요 시 수정 후 승인해 주세요."
          onChange={(e) => onChange({ ...config, instruction: e.target.value })}
        />
      </div>
      <details className={panelStyles.adv}>
        <summary data-tip="Human 노드 동작 설정">고급 설정</summary>
        <div className={panelStyles.field}>
          <label data-tip="체크 시 사람이 아티팩트를 직접 편집 후 승인할 수 있습니다">
            <input
              type="checkbox"
              checked={config.allowEdit}
              onChange={(e) =>
                onChange({ ...config, allowEdit: e.target.checked })
              }
            />
            {" "}편집 허용
            {overriddenKeys !== null && (
              <span className={overriddenKeys.has("allowEdit") ? panelStyles.overriddenMark : panelStyles.inheritedMark}>
                {overriddenKeys.has("allowEdit") ? " (수정됨)" : " (상속)"}
              </span>
            )}
          </label>
        </div>
      </details>
    </>
  );
}

export function SkillForm({
  config,
  onChange,
  overriddenKeys,
}: {
  config: SkillConfig;
  onChange: (c: SkillConfig) => void;
  overriddenKeys: Set<string> | null;
}) {
  return (
    <div className={panelStyles.field}>
      <FieldLabel
        fieldKey="content"
        overriddenKeys={overriddenKeys}
        tip="Agent 시스템 프롬프트에 주입될 기술 마크다운"
      >
        내용
      </FieldLabel>
      <textarea
        className={panelStyles.code}
        value={config.content}
        placeholder="예: ## 채점 가이드라인&#10;- 성과는 숫자로 표현…"
        rows={8}
        onChange={(e) => onChange({ ...config, content: e.target.value })}
      />
    </div>
  );
}

export function RuleForm({
  config,
  onChange,
  overriddenKeys,
}: {
  config: RuleConfig;
  onChange: (c: RuleConfig) => void;
  overriddenKeys: Set<string> | null;
}) {
  return (
    <div className={panelStyles.field}>
      <FieldLabel
        fieldKey="content"
        overriddenKeys={overriddenKeys}
        tip="Agent 시스템 프롬프트 뒤에 append될 규칙 마크다운"
      >
        내용
      </FieldLabel>
      <textarea
        className={panelStyles.code}
        value={config.content}
        placeholder="예: ## 제약 규칙&#10;- 성과는 반드시 숫자로…"
        rows={8}
        onChange={(e) => onChange({ ...config, content: e.target.value })}
      />
    </div>
  );
}

export function ToolForm({
  config,
  onChange,
  overriddenKeys,
}: {
  config: ToolConfig;
  onChange: (c: ToolConfig) => void;
  overriddenKeys: Set<string> | null;
}) {
  return (
    <div className={panelStyles.field}>
      <FieldLabel
        fieldKey="toolName"
        overriddenKeys={overriddenKeys}
        tip="Agent에 장착할 내장 도구. get_document=문서 ID로 조회, search_documents=키워드 검색"
      >
        도구
      </FieldLabel>
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
