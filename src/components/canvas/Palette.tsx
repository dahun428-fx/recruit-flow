// 팔레트(Q7·Q10-B) — 2계층 트리 + 새 블록 트레이(M3).
// 하위 항목: 드래그 = 캔버스 추가(주 동선) · 더블클릭 = 자동 배치 · 클릭 = 설명 팝오버.
// 항목별 활성/비활성 토글(hover 시 노출, 비활성 시 상시).
// U3: 새 블록 트레이 구획 — tray===true 항목, 드래그/더블클릭 승인(tray:false) + X 거절(DELETE).
// U4: rf:trayHighlight 이벤트 수신 시 해당 항목 하이라이트.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { BlockDef } from "@/lib/types";
import type { NodeType } from "@/lib/types";
import { defaultName, defaultConfig } from "./blocks";
import styles from "./Palette.module.css";

// DRAG_MIME: "type:blockKey" 형식
export const DRAG_MIME = "application/x-rf-block";
// 트레이 드래그 MIME: "tray:blockDefId" 형식
export const TRAY_DRAG_MIME = "application/x-rf-tray";

const ALL_TYPES: NodeType[] = [
  "agent",
  "input",
  "output",
  "gate",
  "human",
  "skill",
  "rule",
  "tool",
];

const TYPE_LABEL: Record<NodeType, string> = {
  agent: "Agent",
  input: "Input",
  output: "Output",
  gate: "Gate",
  human: "Human",
  skill: "Skill",
  rule: "Rule",
  tool: "Tool",
};

const TYPE_COLOR: Record<NodeType, string> = {
  agent: "var(--c-agent)",
  input: "var(--c-input)",
  output: "var(--c-output)",
  gate: "var(--c-gate)",
  human: "var(--c-human)",
  skill: "var(--c-mount)",
  rule: "var(--c-mount)",
  tool: "var(--c-mount)",
};

const TYPE_TIP: Record<NodeType, string> = {
  agent: "LLM 에이전트. 역할 프롬프트와 도구를 지정해 마크다운·JSON 아티팩트를 냅니다",
  input: "파이프라인의 시작점. 문서 라이브러리의 JD·증거 문서를 데이터 흐름에 공급합니다",
  output: "최종 마크다운을 HTML 템플릿으로 결정론적 렌더링. 자기완결형 HTML 1파일로 다운로드합니다",
  gate: "조건 분기. LLM 없이 코드로 조건식을 평가해 pass/fail 경로를 가릅니다",
  human: "사람 개입 지점. 실행이 멈추고 승인·편집을 기다립니다. 채팅 독에 대기 카드가 뜹니다",
  skill: "Agent에 장착하는 기술. 점선으로 Agent 상단에 연결합니다",
  rule: "Agent에 장착하는 규칙. 하나의 Rule을 여러 Agent에 공유 장착할 수 있습니다",
  tool: "Agent에 장착하는 도구. get_document(id)로 문서 라이브러리에 접근합니다",
};

/** 팔레트용 항목(빈 블록 + 저장된 정의). */
interface PaletteItem {
  key: string;
  type: NodeType;
  label: string;
  tip: string;
  blockDef?: BlockDef; // 저장된 정의이면 있음
  enabled: boolean;
}

interface Props {
  /** 더블클릭 추가 — 노드 타입으로 캔버스 빈자리에 배치. */
  onAddBlock: (type: NodeType, blockDef?: BlockDef) => void;
  /** 트레이 항목 드래그/더블클릭 승인 시 호출 — blockDef 복사 + tray:false 처리. */
  onApproveTray?: (blockDef: BlockDef) => void;
}

export function Palette({ onAddBlock, onApproveTray }: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    agent: true,
    input: true,
    output: true,
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [popover, setPopover] = useState<{
    item: PaletteItem;
    x: number;
    y: number;
  } | null>(null);
  const [blockDefs, setBlockDefs] = useState<BlockDef[]>([]);
  // 로컬 enabled 오버라이드(API에서 온 값 + 토글 변경)
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});
  // U4: 트레이 항목 하이라이트
  const [highlightTrayId, setHighlightTrayId] = useState<string | null>(null);
  const paletteRef = useRef<HTMLDivElement>(null);

  // block_defs 로드(all=1 — tray 포함)
  const loadBlockDefs = useCallback(() => {
    fetch("/api/block-defs?all=1")
      .then((r) => r.json())
      .then((defs: BlockDef[]) => {
        setBlockDefs(defs);
        const map: Record<string, boolean> = {};
        for (const d of defs) map[d.id] = d.enabled;
        setEnabledMap(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadBlockDefs();
  }, [loadBlockDefs]);

  // U4: rf:trayHighlight 이벤트 수신 → 팔레트 트레이 해당 항목 하이라이트
  useEffect(() => {
    function onTrayHighlight(e: Event) {
      const { blockDefId } = (e as CustomEvent<{ blockDefId: string }>).detail;
      setHighlightTrayId(blockDefId);
      setTimeout(() => setHighlightTrayId(null), 2000);
      // 트레이가 보이도록 스크롤
      paletteRef.current?.scrollTo({ top: 9999, behavior: "smooth" });
    }
    window.addEventListener("rf:trayHighlight", onTrayHighlight);
    return () => window.removeEventListener("rf:trayHighlight", onTrayHighlight);
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setPopover(null);
        setSelected(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function toggle(cat: string) {
    setOpen((o) => ({ ...o, [cat]: !o[cat] }));
    setPopover(null);
    setSelected(null);
  }

  function onItemClick(e: React.MouseEvent, item: PaletteItem) {
    e.stopPropagation();
    if (selected === item.key) {
      setSelected(null);
      setPopover(null);
      return;
    }
    setSelected(item.key);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({
      item,
      x: r.right + 10,
      y: Math.min(r.top, window.innerHeight - 200),
    });
  }

  function toggleEnabled(item: PaletteItem, e: React.MouseEvent) {
    e.stopPropagation();
    if (!item.blockDef) return;
    const newVal = !(enabledMap[item.blockDef.id] ?? item.blockDef.enabled);
    setEnabledMap((m) => ({ ...m, [item.blockDef!.id]: newVal }));
    fetch(`/api/block-defs/${item.blockDef.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: newVal }),
    }).catch(() => {});
  }

  // 타입별 팔레트 항목 구성(tray 제외)
  function getItems(type: NodeType): PaletteItem[] {
    const items: PaletteItem[] = [];
    items.push({
      key: `empty-${type}`,
      type,
      label: `빈 ${TYPE_LABEL[type]}`,
      tip: TYPE_TIP[type],
      enabled: true,
    });
    const defs = blockDefs.filter((d) => d.type === type && !d.tray);
    for (const d of defs) {
      items.push({
        key: `def-${d.id}`,
        type,
        label: d.name,
        tip: d.description || TYPE_TIP[type],
        blockDef: d,
        enabled: enabledMap[d.id] ?? d.enabled,
      });
    }
    return items;
  }

  // 트레이 항목(tray===true)
  const trayItems = blockDefs.filter((d) => d.tray);

  // U3: 트레이 항목 승인(드래그/더블클릭)
  const approveTrayItem = useCallback(
    (def: BlockDef) => {
      // 낙관적 갱신: tray:false
      setBlockDefs((prev) =>
        prev.map((d) => (d.id === def.id ? { ...d, tray: false } : d)),
      );
      fetch(`/api/block-defs/${def.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tray: false }),
      }).catch(() => {});
      onApproveTray?.(def);
    },
    [onApproveTray],
  );

  // U3: 트레이 항목 거절(DELETE)
  const rejectTrayItem = useCallback(
    (def: BlockDef, e: React.MouseEvent) => {
      e.stopPropagation();
      setBlockDefs((prev) => prev.filter((d) => d.id !== def.id));
      fetch(`/api/block-defs/${def.id}`, { method: "DELETE" }).catch(() => {});
    },
    [],
  );

  return (
    <div className={styles.palette} ref={paletteRef}>
      <h3>기본 블록</h3>
      <div className={styles.note}>
        타입 클릭 = 하위 항목 열림 · 항목을 캔버스로 드래그하거나 더블클릭해 추가
      </div>

      {ALL_TYPES.map((type) => {
        const items = getItems(type);
        const isOpen = open[type];
        const color = TYPE_COLOR[type];
        const isMountType = ["skill", "rule", "tool"].includes(type);
        return (
          <div key={type}>
            <div
              className={`${styles.cat} ${isOpen ? styles.open : ""}`}
              onClick={() => toggle(type)}
              data-tip={TYPE_TIP[type]}
            >
              <span
                className={styles.dot}
                style={{
                  background: color,
                  borderRadius: isMountType ? 99 : 3,
                }}
              />
              {TYPE_LABEL[type]}
              <span className={styles.cnt}>{items.length}</span>
              <span className={styles.caret}>▸</span>
            </div>
            {isOpen && (
              <div className={styles.children}>
                {items.map((item) => {
                  const isEnabled = item.enabled;
                  return (
                    <div
                      key={item.key}
                      className={`${styles.item} ${
                        selected === item.key ? styles.selected : ""
                      } ${!isEnabled ? styles.off : ""}`}
                      draggable={isEnabled}
                      onDragStart={
                        isEnabled
                          ? (e) => {
                              e.dataTransfer.setData(DRAG_MIME, `${type}:${item.key}`);
                              // blockDef 정보도 함께 전달
                              if (item.blockDef) {
                                e.dataTransfer.setData(
                                  "application/x-rf-blockdef-id",
                                  item.blockDef.id,
                                );
                              }
                              e.dataTransfer.effectAllowed = "copy";
                            }
                          : undefined
                      }
                      onClick={(e) => onItemClick(e, item)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (!isEnabled) return;
                        onAddBlock(type, item.blockDef);
                        setPopover(null);
                        setSelected(null);
                      }}
                      data-tip={item.tip}
                    >
                      <span
                        className={styles.dot}
                        style={{
                          background: color,
                          borderRadius: isMountType ? 99 : 3,
                        }}
                      />
                      <span className={styles.name}>{item.label}</span>
                      {item.blockDef && (
                        <label
                          className={styles.miniSwitch}
                          onClick={toggleEnabled.bind(null, item)}
                          title={isEnabled ? "비활성화" : "활성화"}
                        >
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => {}}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className={styles.tr} />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* U3: 새 블록 트레이 구획 */}
      <h3 className={styles.trayHeading}>
        새 블록 트레이
        {trayItems.length > 0 && (
          <span className={styles.trayBadge}>{trayItems.length}</span>
        )}
      </h3>
      {trayItems.length === 0 ? (
        <div className={styles.note}>챗봇이 블록을 만들면 여기에 표시됩니다.</div>
      ) : (
        <div className={styles.trayList}>
          {trayItems.map((def) => {
            const isMountType = ["skill", "rule", "tool"].includes(def.type);
            const color = TYPE_COLOR[def.type] ?? "var(--c-agent)";
            const isHighlighted = highlightTrayId === def.id;
            return (
              <div
                key={def.id}
                className={`${styles.item} ${styles.trayItem} ${
                  isHighlighted ? styles.trayHighlight : ""
                }`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(TRAY_DRAG_MIME, def.id);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  approveTrayItem(def);
                }}
                data-tip={`${def.description || def.name} · 드래그하거나 더블클릭하면 승인 후 캔버스에 추가됩니다. ✕는 거절(폐기)`}
              >
                <span
                  className={styles.dot}
                  style={{
                    background: color,
                    borderRadius: isMountType ? 99 : 3,
                  }}
                />
                <span className={styles.name}>{def.name}</span>
                <span
                  className={styles.trayReject}
                  onClick={(e) => rejectTrayItem(def, e)}
                  title="거절(폐기)"
                >
                  ✕
                </span>
              </div>
            );
          })}
        </div>
      )}

      {popover && (
        <div
          className={styles.popover}
          style={{ left: popover.x, top: popover.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <h4>
            <span
              className={styles.dot}
              style={{
                background: TYPE_COLOR[popover.item.type],
                borderRadius: ["skill", "rule", "tool"].includes(popover.item.type) ? 99 : 3,
              }}
            />
            {popover.item.label}
          </h4>
          <p>{popover.item.tip}</p>
          <div className={styles.hint}>
            <b>더블클릭</b> 또는 <b>드래그</b>로 캔버스에 추가
            {popover.item.blockDef && " · 행의 토글로 활성/비활성"}
          </div>
        </div>
      )}
    </div>
  );
}

/** 팔레트 항목에서 드래그로 떨어뜨릴 때 타입 추출. */
export function parseDropType(key: string): NodeType | null {
  const [type] = key.split(":");
  const validTypes: NodeType[] = ["agent", "input", "output", "gate", "human", "skill", "rule", "tool"];
  if (validTypes.includes(type as NodeType)) return type as NodeType;
  return null;
}

// 재사용용 re-export
export { defaultName, defaultConfig };
