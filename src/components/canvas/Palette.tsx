// 팔레트(Q7·Q10-B) — 2계층 트리 + 새 블록 트레이(M3).
// 하위 항목: 드래그 = 캔버스 추가/Agent 장착(주 동선) · 더블클릭 = 자동 배치 · 클릭 = 설명 팝오버.
// M4: enabled 토글 제거. skill/rule/tool은 Agent에만 드래그 장착(캔버스 단독 배치 불가).
// U3: 새 블록 트레이 구획 — tray===true 항목, 드래그/더블클릭 승인(tray:false) + X 거절(DELETE).
// U4: rf:trayHighlight 이벤트 수신 시 해당 항목 하이라이트.
// U5: 항목 우클릭 = Notion 식 컨텍스트 메뉴 (스펙 §5).
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
  agent: "에이전트",
  input: "자료",
  output: "완성본",
  gate: "관문",
  human: "내 검토",
  skill: "기술",
  rule: "규칙",
  tool: "도구",
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
  /** M4: skill/rule/tool은 팔레트에서 드래그 장착만 가능(캔버스 단독 배치 불가) */
  mountOnly: boolean;
}

/** 컨텍스트 메뉴 섹션 구분. */
type ContextSection = "empty" | "library" | "tray";

/** 컨텍스트 메뉴 state. */
interface ContextMenu {
  section: ContextSection;
  x: number;
  y: number;
  item?: PaletteItem;   // empty/library 항목
  trayDef?: BlockDef;   // tray 항목
}

/** 확인 팝업 state. */
interface Confirm {
  message: string;
  onConfirm: () => void;
  x: number;
  y: number;
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
  // U4: 트레이 항목 하이라이트
  const [highlightTrayId, setHighlightTrayId] = useState<string | null>(null);
  // U5: 컨텍스트 메뉴
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  // U5: 확인 팝업
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  // U5: 인라인 이름 변경 state (blockDef id → 편집 중 이름)
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const paletteRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // block_defs 로드(all=1 — tray 포함)
  const loadBlockDefs = useCallback(() => {
    fetch("/api/block-defs?all=1")
      .then((r) => r.json())
      .then((defs: BlockDef[]) => {
        setBlockDefs(defs);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadBlockDefs();
  }, [loadBlockDefs]);

  // 트레이 변경 브로드캐스트(block_def SSE, engine.md §3) → 재조회.
  // 다른 탭에서 승인·거절해도 새로고침 없이 반영된다.
  useEffect(() => {
    window.addEventListener("rf:blockDefsChanged", loadBlockDefs);
    return () => window.removeEventListener("rf:blockDefsChanged", loadBlockDefs);
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

  // 바깥 클릭 — 팝오버·컨텍스트 메뉴 닫기
  useEffect(() => {
    function onDown(e: MouseEvent) {
      // 컨텍스트 메뉴 닫기
      if (
        contextMenu &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
        setConfirm(null);
        return;
      }
      // 팔레트 팝오버 닫기
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        setPopover(null);
        setSelected(null);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [contextMenu]);

  // Esc — 컨텍스트 메뉴·확인 팝업·이름 변경 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setContextMenu(null);
        setConfirm(null);
        if (renamingId) {
          setRenamingId(null);
          setRenameValue("");
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [renamingId]);

  // 이름 변경 input에 포커스
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

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

  // 타입별 팔레트 항목 구성(tray 제외)
  function getItems(type: NodeType): PaletteItem[] {
    const isMountType = (["skill", "rule", "tool"] as NodeType[]).includes(type);
    const items: PaletteItem[] = [];
    items.push({
      key: `empty-${type}`,
      type,
      label: `빈 ${TYPE_LABEL[type]}`,
      tip: isMountType
        ? `${TYPE_TIP[type]} Agent 위로 드래그해 장착하세요.`
        : TYPE_TIP[type],
      mountOnly: isMountType,
    });
    const defs = blockDefs.filter((d) => d.type === type && !d.tray);
    for (const d of defs) {
      items.push({
        key: `def-${d.id}`,
        type,
        label: d.name,
        tip: d.description || TYPE_TIP[type],
        blockDef: d,
        mountOnly: isMountType,
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

  // U3: 트레이 항목 거절(DELETE) — 확인 팝업 포함
  const rejectTrayItemConfirmed = useCallback(
    (def: BlockDef) => {
      setBlockDefs((prev) => prev.filter((d) => d.id !== def.id));
      fetch(`/api/block-defs/${def.id}`, { method: "DELETE" }).catch(() => {});
    },
    [],
  );

  // 기존 트레이 X 버튼 (확인 팝업 경유)
  const onTrayXClick = useCallback(
    (def: BlockDef, e: React.MouseEvent) => {
      e.stopPropagation();
      const target = e.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      setConfirm({
        message: `"${def.name}" 블록을 거절(폐기)할까요?`,
        onConfirm: () => {
          rejectTrayItemConfirmed(def);
          setConfirm(null);
        },
        x: Math.min(rect.right + 8, window.innerWidth - 220),
        y: Math.min(rect.top, window.innerHeight - 100),
      });
    },
    [rejectTrayItemConfirmed],
  );

  // ─── U5: 컨텍스트 메뉴 열기 ───────────────────────────────────────

  /** 뷰포트 경계를 고려해 메뉴 좌상단 좌표 보정. */
  function clampMenuPos(rawX: number, rawY: number, w = 200, h = 160) {
    return {
      x: Math.min(rawX, window.innerWidth - w - 8),
      y: Math.min(rawY, window.innerHeight - h - 8),
    };
  }

  function openContextMenu(
    e: React.MouseEvent,
    section: ContextSection,
    item?: PaletteItem,
    trayDef?: BlockDef,
  ) {
    e.preventDefault();
    e.stopPropagation();
    // 열려 있던 상세 팝오버 닫기
    setPopover(null);
    setSelected(null);
    setConfirm(null);

    const { x, y } = clampMenuPos(e.clientX, e.clientY);

    setContextMenu({ section, x, y, item, trayDef });
  }

  // ─── U5: 메뉴 액션 ────────────────────────────────────────────────

  /** 캔버스에 추가 (빈 블록·라이브러리 공통). skill/rule/tool은 드래그 장착 전용 → 무시. */
  function menuAddToCanvas(item: PaletteItem) {
    if (item.mountOnly) return; // M4: mount 타입은 단독 배치 불가
    onAddBlock(item.type, item.blockDef);
    setContextMenu(null);
  }

  /** 이름 변경 시작 */
  function menuStartRename(id: string, currentName: string) {
    setRenamingId(id);
    setRenameValue(currentName);
    setContextMenu(null);
  }

  /** 이름 변경 저장 */
  function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed) {
      // 낙관적 갱신
      setBlockDefs((prev) =>
        prev.map((d) => (d.id === id ? { ...d, name: trimmed } : d)),
      );
      fetch(`/api/block-defs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      }).catch(() => {});
    }
    setRenamingId(null);
    setRenameValue("");
  }

  /** 삭제(라이브러리) — 확인 팝업 표시 */
  function menuDeleteLibrary(item: PaletteItem) {
    if (!item.blockDef) return;
    const def = item.blockDef;
    const { x, y } = contextMenu ?? { x: 200, y: 200 };
    setContextMenu(null);
    setConfirm({
      message: `"${def.name}" 블록을 삭제할까요?`,
      onConfirm: () => {
        // 낙관적 갱신
        setBlockDefs((prev) => prev.filter((d) => d.id !== def.id));
        fetch(`/api/block-defs/${def.id}`, { method: "DELETE" }).catch(() => {});
        setConfirm(null);
      },
      x: Math.min(x, window.innerWidth - 220),
      y: Math.min(y, window.innerHeight - 100),
    });
  }

  /** 승인하고 추가(트레이) — 드래그/더블클릭 승인과 동일 경로(노드 추가 1회). */
  function menuApproveTray(def: BlockDef) {
    approveTrayItem(def);
    setContextMenu(null);
  }

  /** 거절(트레이) — 확인 팝업 표시 */
  function menuRejectTray(def: BlockDef) {
    const { x, y } = contextMenu ?? { x: 200, y: 200 };
    setContextMenu(null);
    setConfirm({
      message: `"${def.name}" 블록을 거절(폐기)할까요?`,
      onConfirm: () => {
        rejectTrayItemConfirmed(def);
        setConfirm(null);
      },
      x: Math.min(x, window.innerWidth - 220),
      y: Math.min(y, window.innerHeight - 100),
    });
  }

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
                  const isLibrary = !!item.blockDef;
                  const section: ContextSection = isLibrary ? "library" : "empty";
                  const isRenaming = isLibrary && renamingId === item.blockDef?.id;
                  // mount 타입 항목은 Agent 위 드래그 장착만 가능
                  const isMountItem = item.mountOnly;

                  return (
                    <div
                      key={item.key}
                      className={`${styles.item} ${
                        selected === item.key ? styles.selected : ""
                      } ${isMountItem ? styles.mountOnly : ""}`}
                      data-testid={`palette-item-${item.key}`}
                      draggable={!isRenaming}
                      onDragStart={
                        !isRenaming
                          ? (e) => {
                              e.dataTransfer.setData(DRAG_MIME, `${type}:${item.key}`);
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
                      onClick={(e) => {
                        if (isRenaming) return;
                        onItemClick(e, item);
                      }}
                      onDoubleClick={(e) => {
                        if (isRenaming) return;
                        e.stopPropagation();
                        // M4: mount 타입은 더블클릭 캔버스 추가 불가
                        if (isMountItem) return;
                        onAddBlock(type, item.blockDef);
                        setPopover(null);
                        setSelected(null);
                      }}
                      onContextMenu={(e) =>
                        openContextMenu(e, section, item)
                      }
                      data-tip={item.tip}
                    >
                      <span
                        className={styles.dot}
                        style={{
                          background: color,
                          borderRadius: isMountType ? 99 : 3,
                        }}
                      />
                      {isRenaming ? (
                        <input
                          ref={renameInputRef}
                          className={styles.renameInput}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(item.blockDef!.id);
                            if (e.key === "Escape") {
                              setRenamingId(null);
                              setRenameValue("");
                            }
                            e.stopPropagation();
                          }}
                          onBlur={() => commitRename(item.blockDef!.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className={styles.name}>{item.label}</span>
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
            const isTrayRenaming = renamingId === def.id;

            return (
              <div
                key={def.id}
                className={`${styles.item} ${styles.trayItem} ${
                  isHighlighted ? styles.trayHighlight : ""
                }`}
                data-testid={`tray-item-${def.id}`}
                draggable={!isTrayRenaming}
                onDragStart={
                  !isTrayRenaming
                    ? (e) => {
                        e.dataTransfer.setData(TRAY_DRAG_MIME, def.id);
                        e.dataTransfer.effectAllowed = "copy";
                      }
                    : undefined
                }
                onDoubleClick={(e) => {
                  if (isTrayRenaming) return;
                  e.stopPropagation();
                  approveTrayItem(def);
                }}
                onContextMenu={(e) =>
                  openContextMenu(e, "tray", undefined, def)
                }
                data-tip={`${def.description || def.name} · 드래그하거나 더블클릭하면 승인 후 캔버스에 추가됩니다. ✕는 거절(폐기)`}
              >
                <span
                  className={styles.dot}
                  style={{
                    background: color,
                    borderRadius: isMountType ? 99 : 3,
                  }}
                />
                {isTrayRenaming ? (
                  <input
                    ref={renameInputRef}
                    className={styles.renameInput}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(def.id);
                      if (e.key === "Escape") {
                        setRenamingId(null);
                        setRenameValue("");
                      }
                      e.stopPropagation();
                    }}
                    onBlur={() => commitRename(def.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={styles.name}>{def.name}</span>
                )}
                {!isTrayRenaming && (
                  <span
                    className={styles.trayReject}
                    onClick={(e) => onTrayXClick(def, e)}
                    data-testid={`tray-reject-${def.id}`}
                    title="거절(폐기)"
                  >
                    ✕
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 상세 팝오버(클릭 시) */}
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
            {popover.item.mountOnly
              ? <><b>드래그</b>해서 Agent 카드 위에 올리면 장착됩니다</>
              : <><b>더블클릭</b> 또는 <b>드래그</b>로 캔버스에 추가</>
            }
          </div>
        </div>
      )}

      {/* U5: 컨텍스트 메뉴 */}
      {contextMenu && !confirm && (
        <div
          ref={contextMenuRef}
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* ── 빈 블록 메뉴 ── */}
          {contextMenu.section === "empty" && contextMenu.item && (
            <>
              <button
                className={styles.menuItem}
                onClick={() => menuAddToCanvas(contextMenu.item!)}
              >
                캔버스에 추가
              </button>
            </>
          )}

          {/* ── 라이브러리 메뉴 ── */}
          {contextMenu.section === "library" && contextMenu.item && (
            <>
              {/* mount 타입은 캔버스 단독 배치 불가 — 항목 숨김 */}
              {!contextMenu.item.mountOnly && (
                <button
                  className={styles.menuItem}
                  onClick={() => menuAddToCanvas(contextMenu.item!)}
                >
                  캔버스에 추가
                </button>
              )}
              {contextMenu.item.mountOnly && (
                <div className={styles.menuNote}>Agent 위로 드래그해 장착</div>
              )}
              <div className={styles.menuDivider} />
              <button
                className={styles.menuItem}
                onClick={() =>
                  menuStartRename(
                    contextMenu.item!.blockDef!.id,
                    contextMenu.item!.label,
                  )
                }
              >
                이름 변경
              </button>
              <div className={styles.menuDivider} />
              <button
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                onClick={() => menuDeleteLibrary(contextMenu.item!)}
              >
                삭제
              </button>
            </>
          )}

          {/* ── 트레이 메뉴 ── */}
          {contextMenu.section === "tray" && contextMenu.trayDef && (
            <>
              <button
                className={styles.menuItem}
                onClick={() => menuApproveTray(contextMenu.trayDef!)}
                data-testid="tray-approve"
              >
                승인하고 추가
              </button>
              <div className={styles.menuDivider} />
              <button
                className={styles.menuItem}
                onClick={() =>
                  menuStartRename(
                    contextMenu.trayDef!.id,
                    contextMenu.trayDef!.name,
                  )
                }
              >
                이름 변경
              </button>
              <div className={styles.menuDivider} />
              <button
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                onClick={() => menuRejectTray(contextMenu.trayDef!)}
              >
                거절(폐기)
              </button>
            </>
          )}
        </div>
      )}

      {/* U5: 확인 팝업 */}
      {confirm && (
        <div
          className={styles.confirmPopup}
          style={{ left: confirm.x, top: confirm.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <p className={styles.confirmMsg}>{confirm.message}</p>
          <div className={styles.confirmActions}>
            <button
              className={`${styles.confirmBtn} ${styles.confirmBtnDanger}`}
              onClick={confirm.onConfirm}
            >
              확인
            </button>
            <button
              className={styles.confirmBtn}
              onClick={() => setConfirm(null)}
            >
              취소
            </button>
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
