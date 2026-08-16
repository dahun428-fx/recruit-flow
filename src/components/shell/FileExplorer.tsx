// 파일 탐색기 — 좌측 영역.
// M4 후속: 프로젝트(파이프라인) 최상위 트리 추가. Windows 파일 탐색기 시각.
// 블록·문서·실행기록은 프로젝트 구획 아래로 재배치.
// 저장된 블록 정의 클릭 동작: 더블클릭=정의 탭 열기, 단일클릭=no-op.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useCanvasStore } from "@/store/canvas";
import type { BlockDef, Document, NodeType, PipelineSummary, Run } from "@/lib/types";
import { DRAG_MIME, TRAY_DRAG_MIME } from "@/lib/drag";
import { defaultConfig } from "@/components/canvas/blocks";
import styles from "./FileExplorer.module.css";

const TYPE_LABELS: Record<string, string> = {
  agent: "에이전트",
  input: "자료",
  output: "완성본",
  gate: "관문",
  human: "내 검토",
  skill: "기술",
  rule: "규칙",
  tool: "도구",
};

const TYPE_COLOR: Record<string, string> = {
  agent: "var(--c-agent)",
  input: "var(--c-input)",
  output: "var(--c-output)",
  gate: "var(--c-gate)",
  human: "var(--c-human)",
  skill: "var(--c-mount)",
  rule: "var(--c-mount)",
  tool: "var(--c-mount)",
};

const TYPE_ORDER = [
  "agent",
  "input",
  "output",
  "gate",
  "human",
  "skill",
  "rule",
  "tool",
] as const;

const MOUNT_TYPES = ["skill", "rule", "tool"];

/** 아직 서버에 생성하지 않은 "대기 중" 문서 행의 가짜 ID */
const NEW_DOC_SENTINEL = "__new_doc__";

/**
 * 드래그 시 브라우저 기본 고스트 대신 깔끔한 pill 칩을 보여주는 헬퍼.
 * 화면 밖 임시 DOM 요소를 만들어 setDragImage 지정 후 다음 틱에 제거한다.
 */
function setDragChip(
  e: React.DragEvent,
  label: string,
  dotColor: string,
  dotRadius: number,
): void {
  const chip = document.createElement("div");
  chip.style.cssText =
    "position:absolute;top:-9999px;left:-9999px;" +
    "display:flex;align-items:center;gap:5px;" +
    "padding:4px 10px 4px 8px;" +
    "background:#fff;border:1px solid #d0d5dd;border-radius:99px;" +
    "box-shadow:0 2px 8px rgba(0,0,0,0.12);" +
    "font:12px/1.4 inherit;color:#38404d;white-space:nowrap;pointer-events:none;";

  const dot = document.createElement("span");
  dot.style.cssText =
    `width:7px;height:7px;flex:none;border-radius:${dotRadius}px;background:${dotColor};`;

  const text = document.createElement("span");
  text.textContent = label;

  chip.appendChild(dot);
  chip.appendChild(text);
  document.body.appendChild(chip);

  e.dataTransfer.setDragImage(chip, chip.offsetWidth / 2, chip.offsetHeight / 2);
  setTimeout(() => chip.remove(), 0);
}

/** 확인 팝업 state. */
interface ConfirmState {
  message: string;
  onConfirm: () => void;
  x: number;
  y: number;
}

/** 컨텍스트 메뉴 state. */
type ContextSection = "empty" | "library" | "tray" | "typeFolder" | "blockRoot" | "docFolder" | "docItem" | "projectFolder";
interface ContextMenuState {
  section: ContextSection;
  x: number;
  y: number;
  defId?: string;
  defName?: string;
  type?: NodeType;
  blockDef?: BlockDef;
  trayDef?: BlockDef;
  doc?: Document;
  /** blockRoot 서브메뉴 열림 여부 */
  createSubmenuOpen?: boolean;
}

interface Props {
  pipelineId: string | null;
  onOpenDocument: (docId: string, docName: string) => void;
  /** M4: 블록 정의 탭 열기 */
  onOpenBlockDef?: (defId: string, defName: string) => void;
  /** M4: 더블클릭/컨텍스트메뉴로 블록 캔버스 추가 */
  onAddBlock?: (type: NodeType, blockDef?: BlockDef) => void;
  /** M4: 트레이 항목 승인(더블클릭) — tray:false + 캔버스 추가 */
  onApproveTray?: (blockDef: BlockDef) => void;
}

// ── 최상위 구획 펼침 상태 키
type TopSection = "projects" | "blocks" | "documents";

export function FileExplorer({
  pipelineId,
  onOpenDocument,
  onOpenBlockDef,
  onAddBlock,
  onApproveTray,
}: Props) {
  const router = useRouter();

  // ── 파이프라인 목록
  const [pipelines, setPipelines] = useState<PipelineSummary[]>([]);
  // 프로젝트 구획 펼침
  const [projectsOpen, setProjectsOpen] = useState(true);
  // 각 파이프라인의 펼침 여부 (id → boolean)
  const [pipelineOpen, setPipelineOpen] = useState<Record<string, boolean>>({});
  // 각 파이프라인의 "실행 기록" 하위 폴더 펼침
  const [runFolderOpen, setRunFolderOpen] = useState<Record<string, boolean>>({});
  // lazy-loaded runs per pipeline
  const [pipelineRuns, setPipelineRuns] = useState<Record<string, Run[]>>({});
  // label 그룹 접힘 상태: `${pipelineId}::${label}` → boolean
  const [collapsedRunGroups, setCollapsedRunGroups] = useState<Record<string, boolean>>({});

  // ── 블록/문서/실행기록 전역 구획 펼침
  const [topOpen, setTopOpen] = useState<Record<TopSection, boolean>>({
    projects: true,
    blocks: true,
    documents: true,
  });

  const [blockDefs, setBlockDefs] = useState<BlockDef[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [query, setQuery] = useState("");
  // 기본 펼침: agent/input/output 은 열려 있음, skill/rule/tool은 접힘
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(
    new Set(["skill", "rule", "tool"] as const),
  );
  const [draggingOver, setDraggingOver] = useState(false);
  const run = useCanvasStore((s) => s.run);
  const setSnapshotRunId = useCanvasStore((s) => s.setSnapshotRunId);
  const dropRef = useRef<HTMLDivElement>(null);

  // 트레이 항목 하이라이트
  const [highlightTrayId, setHighlightTrayId] = useState<string | null>(null);
  // 컨텍스트 메뉴
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  // 확인 팝업
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  // 인라인 이름 변경 (블록 정의)
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // 인라인 문서 이름 입력 (신규 문서 생성 후 이름 편집)
  const [newDocId, setNewDocId] = useState<string | null>(null);
  const [newDocName, setNewDocName] = useState("");
  const newDocInputRef = useRef<HTMLInputElement>(null);

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);

  // ── 파이프라인 로드
  const loadPipelines = useCallback(async () => {
    try {
      const items = await api.listPipelines();
      setPipelines(items);
    } catch {
      // 무시
    }
  }, []);

  // ── 현재 파이프라인이 바뀌면 자동으로 해당 폴더 펼침
  useEffect(() => {
    if (pipelineId) {
      setPipelineOpen((prev) => ({ ...prev, [pipelineId]: true }));
    }
  }, [pipelineId]);

  // ── runs lazy-load
  const loadRunsFor = useCallback(async (pid: string) => {
    try {
      const runs = await api.listRuns(pid);
      setPipelineRuns((prev) => ({ ...prev, [pid]: runs }));
    } catch {
      // 무시
    }
  }, []);

  // ── 현재 파이프라인의 run 상태 변경 시 목록 갱신
  useEffect(() => {
    if (pipelineId && runFolderOpen[pipelineId]) {
      void loadRunsFor(pipelineId);
    }
  }, [pipelineId, runFolderOpen, run?.status, loadRunsFor]);

  const loadDefs = useCallback(async () => {
    try {
      const res = await fetch("/api/block-defs?all=1");
      if (res.ok) {
        const data: BlockDef[] = await res.json();
        setBlockDefs(data);
      }
    } catch {
      // 무시
    }
  }, []);

  const loadDocs = useCallback(async () => {
    try {
      const items = await api.listDocuments();
      setDocs(items);
    } catch {
      // 무시
    }
  }, []);

  useEffect(() => {
    void loadPipelines();
    void loadDefs();
    void loadDocs();
  }, [loadPipelines, loadDefs, loadDocs]);

  // 블록 정의 변경 이벤트 수신
  useEffect(() => {
    function onChanged() {
      void loadDefs();
    }
    window.addEventListener("rf:blockDefsChanged", onChanged);
    return () => window.removeEventListener("rf:blockDefsChanged", onChanged);
  }, [loadDefs]);

  // 문서 변경 이벤트 수신
  useEffect(() => {
    function onDocsChanged() {
      void loadDocs();
    }
    window.addEventListener("rf:documentsChanged", onDocsChanged);
    return () => window.removeEventListener("rf:documentsChanged", onDocsChanged);
  }, [loadDocs]);

  // U4: rf:trayHighlight 이벤트 수신 → 트레이 항목 하이라이트
  useEffect(() => {
    function onTrayHighlight(e: Event) {
      const { blockDefId } = (e as CustomEvent<{ blockDefId: string }>).detail;
      setHighlightTrayId(blockDefId);
      setTimeout(() => setHighlightTrayId(null), 2000);
      // 트레이가 보이도록 스크롤
      trayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.addEventListener("rf:trayHighlight", onTrayHighlight);
    return () => window.removeEventListener("rf:trayHighlight", onTrayHighlight);
  }, []);

  // 바깥 클릭 — 컨텍스트 메뉴 닫기
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (
        contextMenu &&
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
        setConfirm(null);
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
        if (newDocId) {
          cancelNewDoc();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [renamingId, newDocId]);

  // 이름 변경 input에 포커스
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // 새 문서 이름 input에 포커스 (sentinel이 세팅될 때)
  useEffect(() => {
    if (newDocId === NEW_DOC_SENTINEL && newDocInputRef.current) {
      newDocInputRef.current.focus();
      newDocInputRef.current.select();
    }
  }, [newDocId]);

  const toggleType = (type: string) => {
    setCollapsedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // 블록 타입별 그룹 (트레이 제외, 검색 필터 적용)
  const q = query.toLowerCase();
  const defsByType: Record<string, BlockDef[]> = {};
  for (const def of blockDefs) {
    if (!def.tray) {
      if (!defsByType[def.type]) defsByType[def.type] = [];
      defsByType[def.type].push(def);
    }
  }

  // 트레이 항목 (tray===true)
  const trayItems = blockDefs.filter((d) => d.tray);

  const filteredDocs = q
    ? docs.filter((d) => d.name.toLowerCase().includes(q))
    : docs;

  // OS 드래그 앤 드롭 — .md/.txt 임포트
  const onFileDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(true);
  }, []);
  const onFileDragLeave = useCallback(() => setDraggingOver(false), []);
  const onFileDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDraggingOver(false);
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.name.endsWith(".md") || f.name.endsWith(".txt"),
      );
      for (const file of files) {
        try {
          const text = await file.text();
          await api.createDocument(file.name, text, "파일 임포트");
        } catch {
          // 무시
        }
      }
      if (files.length > 0) await loadDocs();
    },
    [loadDocs],
  );

  function createNewDoc() {
    // 문서 섹션 펼치기
    setTopOpen((prev) => ({ ...prev, documents: true }));
    // 인라인 입력 행 표시 (서버 생성 전)
    setNewDocId(NEW_DOC_SENTINEL);
    setNewDocName("새 문서.md");
  }

  async function commitNewDocName() {
    const trimmed = newDocName.trim();
    setNewDocId(null);
    setNewDocName("");
    // 빈 값 blur/Enter는 취소 — 유령 문서 생성 방지(DocumentsView.commitCreate와 동일 시맨틱).
    if (!trimmed) return;
    try {
      const doc = await api.createDocument(trimmed, "", "새 문서");
      await loadDocs();
      onOpenDocument(doc.id, doc.name);
    } catch {
      // 무시
    }
  }

  function cancelNewDoc() {
    setNewDocId(null);
    setNewDocName("");
  }

  // ── 이름 변경 ──────────────────────────────────────────────────
  function startRename(id: string, currentName: string) {
    setRenamingId(id);
    setRenameValue(currentName);
    setContextMenu(null);
  }

  function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed) {
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

  // 이름 확정 후 정의 탭 열기 (commitRename이 완료된 뒤 호출용)
  const pendingOpenDefRef = useRef<{ id: string; name: string } | null>(null);

  function commitRenameAndOpen(id: string) {
    const trimmed = renameValue.trim();
    const finalName = trimmed || renameValue;
    if (trimmed) {
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
    // 정의 탭 자동 열기
    onOpenBlockDef?.(id, finalName);
  }

  // ── 블록 정의 생성 → 인라인 이름 편집 시작 ──────────────────────
  async function createBlockDefAndEdit(type: NodeType) {
    const typeLabel = TYPE_LABELS[type] ?? type;
    const defaultName = `새 ${typeLabel}`;
    try {
      const def = await api.createBlockDef({
        type,
        name: defaultName,
        description: "",
        config: defaultConfig(type),
        origin: "human",
        tray: false,
      });
      // 낙관적 추가 (rf:blockDefsChanged로도 갱신되지만, 즉시 반영)
      setBlockDefs((prev) => {
        // 중복 방지: 이미 있으면 교체하지 않음
        if (prev.some((d) => d.id === def.id)) return prev;
        return [...prev, def];
      });
      // 해당 타입 폴더 펼치기
      setCollapsedTypes((prev) => {
        const next = new Set(prev);
        next.delete(type);
        return next;
      });
      // 인라인 이름 편집 시작
      pendingOpenDefRef.current = { id: def.id, name: def.name };
      setRenamingId(def.id);
      setRenameValue(def.name);
    } catch {
      // 무시
    }
  }

  // ── 새 프로젝트 생성 ────────────────────────────────────────────
  async function createNewProject() {
    try {
      const p = await api.createPipeline("새 프로젝트");
      await loadPipelines();
      router.push(`/pipelines/${p.id}`);
    } catch {
      // 무시
    }
  }

  // ── 트레이 승인/거절 ────────────────────────────────────────────
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
      })
        .then(() => {
          // 다른 탭/컴포넌트에 블록 정의 변경 브로드캐스트
          window.dispatchEvent(new CustomEvent("rf:blockDefsChanged"));
        })
        .catch(() => {});
      onApproveTray?.(def);
    },
    [onApproveTray],
  );

  const rejectTrayItemConfirmed = useCallback((def: BlockDef) => {
    setBlockDefs((prev) => prev.filter((d) => d.id !== def.id));
    fetch(`/api/block-defs/${def.id}`, { method: "DELETE" })
      .then(() => {
        window.dispatchEvent(new CustomEvent("rf:blockDefsChanged"));
      })
      .catch(() => {});
  }, []);

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

  // ── 컨텍스트 메뉴 ────────────────────────────────────────────────
  function clampMenuPos(rawX: number, rawY: number, w = 200, h = 200) {
    return {
      x: Math.min(rawX, window.innerWidth - w - 8),
      y: Math.min(rawY, window.innerHeight - h - 8),
    };
  }

  function openContextMenu(e: React.MouseEvent, menu: Omit<ContextMenuState, "x" | "y">) {
    e.preventDefault();
    e.stopPropagation();
    setConfirm(null);
    const { x, y } = clampMenuPos(e.clientX, e.clientY);
    setContextMenu({ ...menu, x, y });
  }

  function menuDeleteLibrary(def: BlockDef) {
    const { x, y } = contextMenu ?? { x: 200, y: 200 };
    setContextMenu(null);
    setConfirm({
      message: `"${def.name}" 블록을 삭제할까요?`,
      onConfirm: () => {
        setBlockDefs((prev) => prev.filter((d) => d.id !== def.id));
        fetch(`/api/block-defs/${def.id}`, { method: "DELETE" }).catch(() => {});
        setConfirm(null);
      },
      x: Math.min(x, window.innerWidth - 220),
      y: Math.min(y, window.innerHeight - 100),
    });
  }

  function menuDeleteDoc(doc: Document) {
    const { x, y } = contextMenu ?? { x: 200, y: 200 };
    setContextMenu(null);
    setConfirm({
      message: `"${doc.name}" 문서를 삭제할까요?`,
      onConfirm: () => {
        setDocs((prev) => prev.filter((d) => d.id !== doc.id));
        // 낙관적 제거 — 실패 시 목록 재동기화로 롤백.
        api.deleteDocument(doc.id).catch(() => void loadDocs());
        // 열린 탭 닫기
        window.dispatchEvent(
          new CustomEvent("rf:documentDeleted", { detail: { docId: doc.id } }),
        );
        setConfirm(null);
      },
      x: Math.min(x, window.innerWidth - 220),
      y: Math.min(y, window.innerHeight - 100),
    });
  }

  function menuApproveTray(def: BlockDef) {
    approveTrayItem(def);
    setContextMenu(null);
  }

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

  // ── 프로젝트 폴더 토글
  function togglePipeline(pid: string) {
    setPipelineOpen((prev) => ({ ...prev, [pid]: !prev[pid] }));
  }

  // ── 실행 기록 하위 폴더 토글
  async function toggleRunFolder(pid: string) {
    const willOpen = !runFolderOpen[pid];
    setRunFolderOpen((prev) => ({ ...prev, [pid]: willOpen }));
    if (willOpen) {
      await loadRunsFor(pid);
    }
  }

  // ── 캔버스 탭 활성화 이벤트 발행
  function activateCanvasTab() {
    window.dispatchEvent(new CustomEvent("rf:activateCanvasTab"));
  }

  // ── run 클릭 — 스냅샷 모드 진입
  function handleRunClick(r: Run) {
    setSnapshotRunId(r.id);
    activateCanvasTab();
  }

  // run 상태 레이블
  function runStatusLabel(status: string): string {
    const map: Record<string, string> = {
      succeeded: "성공",
      failed: "실패",
      gate_failed: "관문 실패",
      cancelled: "취소",
      running: "실행 중",
      waiting_human: "사람 대기",
    };
    return map[status] ?? status;
  }

  function formatTime(ms: number): string {
    const d = new Date(ms);
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${mo}/${day} ${h}:${m}`;
  }

  /**
   * run 목록을 label 별로 그룹핑한다.
   * - label이 있는 그룹이 앞에 오고, "(라벨 없음)"이 마지막.
   * - 같은 label 내에서는 인자로 받은 runs가 이미 최신순이므로 순서 유지.
   * - 그룹 순서는 해당 label의 가장 최신 run 시각 기준 내림차순.
   */
  function groupRunsByLabel(runList: Run[]): Array<{ label: string; runs: Run[] }> {
    const FALLBACK = "(라벨 없음)";
    const map = new Map<string, Run[]>();
    for (const r of runList) {
      const key = r.label?.trim() || FALLBACK;
      const bucket = map.get(key) ?? [];
      bucket.push(r);
      map.set(key, bucket);
    }
    // 그룹 정렬: 라벨 있는 그룹 → 없는 그룹, 각 그룹 내에서 첫 run(최신) startedAt 기준 내림차순
    return Array.from(map.entries())
      .sort(([aLabel, aRuns], [bLabel, bRuns]) => {
        const aFallback = aLabel === FALLBACK;
        const bFallback = bLabel === FALLBACK;
        if (aFallback !== bFallback) return aFallback ? 1 : -1;
        // 같은 카테고리 내에선 최신 run 시각 내림차순
        const aTime = aRuns[0]?.startedAt ?? 0;
        const bTime = bRuns[0]?.startedAt ?? 0;
        return bTime - aTime;
      })
      .map(([label, groupRuns]) => ({ label, runs: groupRuns }));
  }

  return (
    <div className={styles.explorer}>
      {/* 검색 */}
      <div className={styles.searchWrap}>
        <input
          className={styles.search}
          placeholder="이름 검색…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.body}>

        {/* ══ 프로젝트 구획 (최상위, 신규) ══════════════════════════════ */}
        {!q && (
          <div className={styles.section}>
            {/* 구획 헤더 */}
            <button
              className={styles.treeFolder}
              onClick={() => setProjectsOpen((v) => !v)}
              onContextMenu={(e) =>
                openContextMenu(e, { section: "projectFolder" })
              }
            >
              <span className={styles.treeCaret}>{projectsOpen ? "▾" : "▸"}</span>
              <span className={styles.treeFolderIcon}>{projectsOpen ? "📂" : "📁"}</span>
              <span className={styles.treeName}>프로젝트</span>
            </button>

            {projectsOpen && (
              <div className={styles.treeChildren}>
                {pipelines.map((p) => {
                  const isCurrent = p.id === pipelineId;
                  const isOpen = !!pipelineOpen[p.id];
                  const runs = pipelineRuns[p.id] ?? [];
                  const isRunFolderExpanded = !!runFolderOpen[p.id];

                  return (
                    <div key={p.id}>
                      {/* 파이프라인 폴더 행 */}
                      <button
                        className={`${styles.treeFolder} ${styles.treeIndent1} ${isCurrent ? styles.treeCurrent : ""}`}
                        onClick={() => {
                          if (isCurrent) {
                            togglePipeline(p.id);
                          } else {
                            // 다른 파이프라인: 전환
                            router.push(`/pipelines/${p.id}`);
                            setPipelineOpen((prev) => ({ ...prev, [p.id]: true }));
                          }
                        }}
                      >
                        <span className={styles.treeCaret}>{isOpen ? "▾" : "▸"}</span>
                        <span className={styles.treeFolderIcon}>{isOpen ? "📂" : "📁"}</span>
                        <span className={`${styles.treeName} ${isCurrent ? styles.treeNameBold : ""}`}>
                          {p.name}
                        </span>
                      </button>

                      {/* 펼친 경우 하위 항목 */}
                      {isOpen && (
                        <div className={styles.treeChildren}>
                          {/* 캔버스 항목 */}
                          <button
                            className={`${styles.treeFile} ${styles.treeIndent2}`}
                            onClick={() => {
                              if (!isCurrent) {
                                router.push(`/pipelines/${p.id}`);
                              }
                              activateCanvasTab();
                            }}
                            title="캔버스 탭을 활성화합니다"
                          >
                            <span className={styles.treeFileIcon}>▦</span>
                            <span className={styles.treeName}>캔버스</span>
                          </button>

                          {/* 실행 기록 하위 폴더 */}
                          <button
                            className={`${styles.treeFolder} ${styles.treeIndent2}`}
                            onClick={() => void toggleRunFolder(p.id)}
                          >
                            <span className={styles.treeCaret}>
                              {isRunFolderExpanded ? "▾" : "▸"}
                            </span>
                            <span className={styles.treeFolderIcon}>
                              {isRunFolderExpanded ? "📂" : "📁"}
                            </span>
                            <span className={styles.treeName}>실행 기록</span>
                          </button>

                          {/* 실행 목록 — label 그룹핑 */}
                          {isRunFolderExpanded && (
                            <div>
                              {/* 현재 파이프라인의 라이브 run */}
                              {isCurrent && run && !runs.find((r) => r.id === run.runId) && (
                                <div
                                  className={`${styles.treeFile} ${styles.treeIndent3} ${styles.treeRunLive}`}
                                >
                                  <span className={styles.treeFileIcon}>🔄</span>
                                  <span className={styles.treeName}>
                                    실행 중 · {run.progress?.done ?? 0}/{run.progress?.total ?? "?"}
                                  </span>
                                </div>
                              )}
                              {runs.length === 0 ? (
                                <div className={`${styles.treeEmpty} ${styles.treeIndent3}`}>
                                  실행 기록 없음
                                </div>
                              ) : (
                                groupRunsByLabel(runs).map(({ label, runs: groupRuns }) => {
                                  const groupKey = `${p.id}::${label}`;
                                  const isGroupCollapsed = !!collapsedRunGroups[groupKey];
                                  return (
                                    <div key={label}>
                                      {/* label 그룹 헤더 */}
                                      <button
                                        className={`${styles.runLabelGroup} ${styles.treeIndent3}`}
                                        title={`JD: ${label} · ${groupRuns.length}개 run`}
                                        onClick={() =>
                                          setCollapsedRunGroups((prev) => ({
                                            ...prev,
                                            [groupKey]: !prev[groupKey],
                                          }))
                                        }
                                      >
                                        <span className={styles.treeCaret}>
                                          {isGroupCollapsed ? "▸" : "▾"}
                                        </span>
                                        <span className={styles.runLabelGroupName}>
                                          {label}
                                        </span>
                                        <span className={styles.runLabelGroupCount}>
                                          {groupRuns.length}
                                        </span>
                                      </button>
                                      {/* label 그룹 내 run 목록 */}
                                      {!isGroupCollapsed && groupRuns.map((r) => (
                                        <button
                                          key={r.id}
                                          className={`${styles.treeFile} ${styles.treeIndent4}`}
                                          onClick={() => {
                                            if (!isCurrent) {
                                              router.push(`/pipelines/${p.id}`);
                                            }
                                            handleRunClick(r);
                                          }}
                                          title={`${label} · ${formatTime(r.startedAt)} · ${runStatusLabel(r.status)}`}
                                        >
                                          <span className={`${styles.treeRunDot} ${styles[`runSt_${r.status}`] ?? ""}`} />
                                          <span className={styles.treeName}>
                                            {formatTime(r.startedAt)} · {runStatusLabel(r.status)}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {pipelines.length === 0 && (
                  <div className={`${styles.treeEmpty} ${styles.treeIndent1}`}>
                    파이프라인 없음
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ 블록 섹션 ══════════════════════════════════════════════ */}
        <div className={styles.section}>
          {/* 블록 구획 헤더 */}
          <button
            className={styles.treeFolder}
            onClick={() => setTopOpen((prev) => ({ ...prev, blocks: !prev.blocks }))}
            onContextMenu={(e) =>
              openContextMenu(e, { section: "blockRoot" })
            }
          >
            <span className={styles.treeCaret}>{topOpen.blocks ? "▾" : "▸"}</span>
            <span className={styles.treeFolderIcon}>{topOpen.blocks ? "📂" : "📁"}</span>
            <span className={styles.treeName}>블록</span>
          </button>

          {topOpen.blocks && (
            <div className={styles.treeChildren}>
              {TYPE_ORDER.map((type) => {
                const items = (defsByType[type] ?? []).filter(
                  (d) => !q || d.name.toLowerCase().includes(q),
                );
                const isMountType = MOUNT_TYPES.includes(type);
                // 검색 중이고 빈 항목도 없으면 타입 행 숨김
                if (q && items.length === 0) return null;
                const collapsed = collapsedTypes.has(type);
                const color = TYPE_COLOR[type] ?? "var(--c-agent)";
                // 타입별 항목 수 = 저장된 정의 + "빈 [타입]" 1개
                const displayCount = items.length + (q ? 0 : 1);

                return (
                  <div key={type}>
                    <button
                      className={`${styles.typeHead} ${styles.treeIndent1}`}
                      data-testid={`type-folder-${type}`}
                      onClick={() => toggleType(type)}
                      onContextMenu={(e) =>
                        openContextMenu(e, { section: "typeFolder", type: type as NodeType })
                      }
                    >
                      <span className={styles.caret}>{collapsed ? "▸" : "▾"}</span>
                      <span
                        className={styles.typeDot}
                        style={{
                          background: color,
                          borderRadius: isMountType ? 99 : 3,
                        }}
                      />
                      {TYPE_LABELS[type] ?? type}
                      <span className={styles.count}>{displayCount}</span>
                    </button>
                    {!collapsed && (
                      <div>
                        {/* 빈 블록 항목 (검색 중이면 숨김) */}
                        {!q && (
                          <div
                            className={`${styles.defItem} ${styles.treeIndent2} ${isMountType ? styles.mountOnlyItem : ""}`}
                            data-testid={`palette-item-empty-${type}`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData(DRAG_MIME, `${type}:empty-${type}`);
                              e.dataTransfer.effectAllowed = "copy";
                              setDragChip(
                                e,
                                `빈 ${TYPE_LABELS[type] ?? type}`,
                                color,
                                isMountType ? 99 : 3,
                              );
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              if (isMountType) return; // mount 타입은 단독 배치 불가
                              onAddBlock?.(type as NodeType, undefined);
                            }}
                            onContextMenu={(e) =>
                              openContextMenu(e, {
                                section: "empty",
                                type: type as NodeType,
                              })
                            }
                            title={isMountType ? `Agent 위로 드래그해 장착하세요` : `빈 ${TYPE_LABELS[type] ?? type} 추가`}
                          >
                            <span className={styles.treeGuide} />
                            <span
                              className={styles.itemDot}
                              style={{
                                background: color,
                                borderRadius: isMountType ? 99 : 3,
                              }}
                            />
                            <span className={styles.itemName}>빈 {TYPE_LABELS[type] ?? type}</span>
                          </div>
                        )}
                        {/* 저장된 정의 항목 — 더블클릭=정의 탭 열기, 단일클릭=no-op */}
                        {items.map((def) => {
                          const isRenaming = renamingId === def.id;
                          const isPendingNew = pendingOpenDefRef.current?.id === def.id;
                          return (
                            <div
                              key={def.id}
                              className={`${styles.defItem} ${styles.treeIndent2} ${isMountType ? styles.mountOnlyItem : ""}`}
                              data-testid={`palette-item-def-${def.id}`}
                              draggable={!isRenaming}
                              onDragStart={
                                !isRenaming
                                  ? (e) => {
                                      e.dataTransfer.setData(DRAG_MIME, `${def.type}:def-${def.id}`);
                                      e.dataTransfer.setData("application/x-rf-blockdef-id", def.id);
                                      e.dataTransfer.effectAllowed = "copy";
                                      setDragChip(
                                        e,
                                        def.name,
                                        color,
                                        isMountType ? 99 : 3,
                                      );
                                    }
                                  : undefined
                              }
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (isRenaming) return;
                                // 더블클릭 = 정의 탭 열기
                                onOpenBlockDef?.(def.id, def.name);
                              }}
                              onContextMenu={(e) =>
                                openContextMenu(e, {
                                  section: "library",
                                  type: def.type as NodeType,
                                  blockDef: def,
                                })
                              }
                              title={def.description || def.name}
                            >
                              <span className={styles.treeGuide} />
                              <span
                                className={styles.itemDot}
                                style={{
                                  background: color,
                                  borderRadius: isMountType ? 99 : 3,
                                }}
                              />
                              {isRenaming ? (
                                <input
                                  ref={renameInputRef}
                                  data-testid="block-def-rename-input"
                                  className={styles.renameInput}
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      if (isPendingNew) {
                                        pendingOpenDefRef.current = null;
                                        commitRenameAndOpen(def.id);
                                      } else {
                                        commitRename(def.id);
                                      }
                                    }
                                    if (e.key === "Escape") {
                                      pendingOpenDefRef.current = null;
                                      setRenamingId(null);
                                      setRenameValue("");
                                    }
                                    e.stopPropagation();
                                  }}
                                  onBlur={() => {
                                    if (isPendingNew) {
                                      pendingOpenDefRef.current = null;
                                      commitRenameAndOpen(def.id);
                                    } else {
                                      commitRename(def.id);
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              ) : (
                                <span className={styles.itemName}>{def.name}</span>
                              )}
                            </div>
                          );
                        })}
                        {items.length === 0 && !q && (
                          <div className={`${styles.empty} ${styles.treeIndent2}`}>정의 없음</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 새 블록 트레이 */}
              {trayItems.length > 0 && (
                <div ref={trayRef}>
                  <button
                    className={`${styles.typeHead} ${styles.treeIndent1}`}
                    onClick={() => {}} // 트레이는 항상 펼침
                  >
                    <span className={styles.caret}>▾</span>
                    <span className={styles.treeFolderIcon} style={{ fontSize: 11 }}>📥</span>
                    새 블록 트레이
                    <span className={styles.trayBadge}>{trayItems.length}</span>
                  </button>
                  {trayItems.map((def) => {
                    const isMountType = MOUNT_TYPES.includes(def.type);
                    const color = TYPE_COLOR[def.type] ?? "var(--c-agent)";
                    const isHighlighted = highlightTrayId === def.id;
                    const isTrayRenaming = renamingId === def.id;

                    return (
                      <div
                        key={def.id}
                        className={`${styles.trayItem} ${styles.treeIndent2} ${isHighlighted ? styles.trayHighlight : ""}`}
                        data-testid={`tray-item-${def.id}`}
                        draggable={!isTrayRenaming}
                        onDragStart={
                          !isTrayRenaming
                            ? (e) => {
                                e.dataTransfer.setData(TRAY_DRAG_MIME, def.id);
                                e.dataTransfer.effectAllowed = "copy";
                                setDragChip(
                                  e,
                                  def.name,
                                  color,
                                  isMountType ? 99 : 3,
                                );
                              }
                            : undefined
                        }
                        onDoubleClick={(e) => {
                          if (isTrayRenaming) return;
                          e.stopPropagation();
                          approveTrayItem(def);
                        }}
                        onContextMenu={(e) =>
                          openContextMenu(e, { section: "tray", trayDef: def })
                        }
                        title={`${def.description || def.name} · 드래그하거나 더블클릭하면 승인 후 캔버스에 추가됩니다`}
                      >
                        <span
                          className={styles.itemDot}
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
                          <span className={styles.itemName}>{def.name}</span>
                        )}
                        {!isTrayRenaming && (
                          <button
                            className={styles.trayReject}
                            onClick={(e) => onTrayXClick(def, e)}
                            data-testid={`tray-reject-${def.id}`}
                            title="거절(폐기)"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══ 문서 섹션 ══════════════════════════════════════════════ */}
        <div
          ref={dropRef}
          className={`${styles.section} ${draggingOver ? styles.dropTarget : ""}`}
          onDragOver={onFileDragOver}
          onDragLeave={onFileDragLeave}
          onDrop={onFileDrop}
        >
          {/* 문서 구획 헤더 */}
          <button
            className={styles.treeFolder}
            onClick={() => setTopOpen((prev) => ({ ...prev, documents: !prev.documents }))}
            onContextMenu={(e) =>
              openContextMenu(e, { section: "docFolder" })
            }
          >
            <span className={styles.treeCaret}>{topOpen.documents ? "▾" : "▸"}</span>
            <span className={styles.treeFolderIcon}>{topOpen.documents ? "📂" : "📁"}</span>
            <span className={styles.treeName}>문서</span>
            <span className={styles.dropHint}>.md .txt 드래그</span>
          </button>

          {topOpen.documents && (
            <div className={styles.treeChildren}>
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className={`${styles.docItem} ${styles.treeIndent1}`}
                  data-testid={`document-list-item-${doc.id}`}
                  onContextMenu={(e) =>
                    openContextMenu(e, { section: "docItem", doc })
                  }
                  onClick={() => onOpenDocument(doc.id, doc.name)}
                >
                  <span className={styles.treeFileIcon} style={{ fontSize: 11 }}>📄</span>
                  <span
                    style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {doc.name}
                  </span>
                </div>
              ))}
              {/* 새 문서 이름 입력 행 (서버 생성 전 인라인 입력) */}
              {newDocId === NEW_DOC_SENTINEL && (
                <div className={`${styles.docItem} ${styles.treeIndent1}`}>
                  <span className={styles.treeFileIcon} style={{ fontSize: 11 }}>📄</span>
                  <input
                    ref={newDocInputRef}
                    className={styles.renameInput}
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { void commitNewDocName(); }
                      if (e.key === "Escape") { cancelNewDoc(); }
                      e.stopPropagation();
                    }}
                    onBlur={() => void commitNewDocName()}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
              {filteredDocs.length === 0 && newDocId !== NEW_DOC_SENTINEL && (
                <div className={`${styles.empty} ${styles.treeIndent1}`}>문서 없음</div>
              )}
              <button className={`${styles.newDoc} ${styles.treeIndent1}`} onClick={() => createNewDoc()}>
                + 새 문서
              </button>
            </div>
          )}
        </div>

      </div>

      {/* 컨텍스트 메뉴 */}
      {contextMenu && !confirm && (
        <div
          ref={contextMenuRef}
          className={styles.contextMenu}
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 빈 블록 메뉴 */}
          {contextMenu.section === "empty" && contextMenu.type && (
            <>
              {!MOUNT_TYPES.includes(contextMenu.type) && (
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    onAddBlock?.(contextMenu.type!, undefined);
                    setContextMenu(null);
                  }}
                >
                  캔버스에 추가
                </button>
              )}
              {MOUNT_TYPES.includes(contextMenu.type) && (
                <div className={styles.menuNote}>Agent 위로 드래그해 장착</div>
              )}
            </>
          )}

          {/* 라이브러리 메뉴 */}
          {contextMenu.section === "library" && contextMenu.blockDef && (
            <>
              {!MOUNT_TYPES.includes(contextMenu.blockDef.type) && (
                <button
                  className={styles.menuItem}
                  onClick={() => {
                    onAddBlock?.(contextMenu.blockDef!.type as NodeType, contextMenu.blockDef);
                    setContextMenu(null);
                  }}
                >
                  캔버스에 추가
                </button>
              )}
              {MOUNT_TYPES.includes(contextMenu.blockDef.type) && (
                <div className={styles.menuNote}>Agent 위로 드래그해 장착</div>
              )}
              <div className={styles.menuDivider} />
              <button
                className={styles.menuItem}
                onClick={() => startRename(contextMenu.blockDef!.id, contextMenu.blockDef!.name)}
              >
                이름 변경
              </button>
              <button
                className={styles.menuItem}
                onClick={() => onOpenBlockDef?.(contextMenu.blockDef!.id, contextMenu.blockDef!.name)}
              >
                정의 열기
              </button>
              <div className={styles.menuDivider} />
              <button
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                onClick={() => menuDeleteLibrary(contextMenu.blockDef!)}
              >
                삭제
              </button>
            </>
          )}

          {/* 트레이 메뉴 */}
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
                onClick={() => startRename(contextMenu.trayDef!.id, contextMenu.trayDef!.name)}
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

          {/* 타입 폴더 우클릭 메뉴 */}
          {contextMenu.section === "typeFolder" && contextMenu.type && (
            <>
              <button
                className={styles.menuItem}
                data-testid={`ctx-new-type-${contextMenu.type}`}
                onClick={() => {
                  const t = contextMenu.type!;
                  setContextMenu(null);
                  void createBlockDefAndEdit(t);
                }}
              >
                새 {TYPE_LABELS[contextMenu.type] ?? contextMenu.type}
              </button>
            </>
          )}

          {/* 블록 루트 우클릭 메뉴 — "만들기 ▸" 서브메뉴 */}
          {contextMenu.section === "blockRoot" && (
            <>
              <div
                className={styles.menuItemSubmenu}
                onMouseEnter={() =>
                  setContextMenu((prev) => prev ? { ...prev, createSubmenuOpen: true } : prev)
                }
                onMouseLeave={() =>
                  setContextMenu((prev) => prev ? { ...prev, createSubmenuOpen: false } : prev)
                }
              >
                <span className={styles.menuItemSubmenuLabel}>만들기</span>
                <span className={styles.menuItemSubmenuArrow}>▸</span>
                {contextMenu.createSubmenuOpen && (
                  <div className={styles.submenu}>
                    {TYPE_ORDER.map((t) => (
                      <button
                        key={t}
                        className={styles.menuItem}
                        data-testid={`ctx-create-${t}`}
                        onClick={() => {
                          setContextMenu(null);
                          void createBlockDefAndEdit(t);
                        }}
                      >
                        <span
                          className={styles.submenuDot}
                          style={{
                            background: TYPE_COLOR[t] ?? "var(--c-agent)",
                            borderRadius: MOUNT_TYPES.includes(t) ? 99 : 3,
                          }}
                        />
                        {TYPE_LABELS[t] ?? t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* 문서 폴더 우클릭 메뉴 */}
          {contextMenu.section === "docFolder" && (
            <>
              <button
                className={styles.menuItem}
                data-testid="ctx-new-doc"
                onClick={() => {
                  setContextMenu(null);
                  void createNewDoc();
                }}
              >
                새 문서
              </button>
            </>
          )}

          {/* 문서 항목 우클릭 메뉴 */}
          {contextMenu.section === "docItem" && contextMenu.doc && (
            <>
              <button
                className={styles.menuItem}
                onClick={() => {
                  onOpenDocument(contextMenu.doc!.id, contextMenu.doc!.name);
                  setContextMenu(null);
                }}
              >
                열기
              </button>
              <div className={styles.menuDivider} />
              <button
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                data-testid={`ctx-delete-doc-${contextMenu.doc.id}`}
                onClick={() => menuDeleteDoc(contextMenu.doc!)}
              >
                삭제
              </button>
            </>
          )}

          {/* 프로젝트 폴더 우클릭 메뉴 */}
          {contextMenu.section === "projectFolder" && (
            <>
              <button
                className={styles.menuItem}
                data-testid="ctx-new-project"
                onClick={() => {
                  setContextMenu(null);
                  void createNewProject();
                }}
              >
                새 프로젝트
              </button>
            </>
          )}
        </div>
      )}

      {/* 확인 팝업 */}
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
