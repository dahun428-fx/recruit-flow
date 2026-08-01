// 채팅 독(M3) — pipeline SSE 구독, 입력창 활성, 5종 메시지 카드.
// U1: 입력창 활성+전송(POST /chat). U2: pipeline SSE 상시 구독.
// U4: card_block 카드+트레이 점프. U5: gap_question 인라인 답변·Human 승인.
// U6: card_run started → store.initRun 연동은 PipelineView에서.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/store/canvas";
import { rememberActiveRun } from "@/hooks/useRunStream";
import type { ChatMessage, RunState } from "@/lib/types";
import { usePipelineStream } from "@/hooks/usePipelineStream";
import styles from "./ChatDock.module.css";

interface Props {
  /** Human 노드 클릭 → 해당 카드로 스크롤할 nodeId */
  scrollToNodeId?: string | null;
  onScrollHandled?: () => void;
}

// ──────────────────────────────────────────────────────────
// payload 타입들
// ──────────────────────────────────────────────────────────

interface RunCardPayload {
  event: "started" | "succeeded" | "failed" | "gate_failed" | "cancelled";
  runId?: string;
  title?: string;
  nodeCount?: number;
  score?: number;
  reason?: string;
  iteration?: number;
  gateName?: string;
  loops?: number;
  finalScore?: string;
  htmlArtifactId?: string;
}

interface HumanCardPayload {
  event?: "gap_question" | "waiting" | "approved";
  instruction?: string;
  excerpt?: string;
  nodeId?: string;
  nodeRunId?: string;
  nodeName?: string;
  question?: string;
  allowEdit?: boolean;
  primaryContent?: string;
}

interface BlockCardPayload {
  blockDefId: string;
  type: string;
  name: string;
  description: string;
}

interface UserPayload {
  text: string;
}

interface AssistantPayload {
  text: string;
}

// ──────────────────────────────────────────────────────────
// ChatDock 메인
// ──────────────────────────────────────────────────────────

export function ChatDock({ scrollToNodeId, onScrollHandled }: Props) {
  const pipelineId = useCanvasStore((s) => s.pipelineId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // messageId → 스트리밍 중 텍스트 (chat_delta 누적)
  const [streamingMap, setStreamingMap] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);

  // 스트리밍 메시지 ID(가장 최근 assistant 스트리밍)
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);

  // pipeline SSE 구독
  usePipelineStream(pipelineId, {
    onMessages: (msgs) => {
      setMessages(msgs);
    },
    onChatDelta: (messageId, chunk) => {
      setStreamingMsgId(messageId);
      setStreamingMap((prev) => ({
        ...prev,
        [messageId]: (prev[messageId] ?? "") + chunk,
      }));
    },
    onChatMessage: (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // 확정되면 스트리밍 버퍼 제거
      if (msg.kind === "assistant") {
        setStreamingMap((prev) => {
          const next = { ...prev };
          // assistant 확정 시 모든 streaming 버퍼 정리
          for (const key of Object.keys(next)) {
            delete next[key];
          }
          return next;
        });
        setStreamingMsgId(null);
      }
    },
    onChatCard: (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // U6: card_run(started) → store initRun + useRunStream 기동
      if (msg.kind === "card_run") {
        const p = msg.payload as RunCardPayload;
        const runId = msg.runId ?? p.runId;
        if (p.event === "started" && runId && pipelineId) {
          rememberActiveRun(pipelineId, runId);
          // RunState를 REST로 조회해 initRun
          void fetch(`/api/runs/${runId}`)
            .then((r) => r.json())
            .then((state: RunState) => {
              const nodeStatus: Record<string, import("@/lib/types").NodeRunStatus> = {};
              const nodeRunId: Record<string, string> = {};
              const artifacts: Record<string, import("@/lib/types").Artifact> = {};
              for (const nr of state.nodeRuns ?? []) {
                nodeStatus[nr.nodeId] = nr.status;
                nodeRunId[nr.nodeId] = nr.id;
              }
              for (const a of state.artifacts ?? []) {
                artifacts[a.nodeRunId] = a;
              }
              const total = (state.nodeRuns ?? []).length;
              const done = (state.nodeRuns ?? []).filter(
                (n) => n.status === "succeeded" || n.status === "skipped",
              ).length;
              useCanvasStore.getState().initRun({
                runId: state.run.id,
                status: state.run.status,
                progress: { done, total },
                nodeStatus,
                nodeRunId,
                artifacts,
              });
            })
            .catch(() => {});
        }
      }
    },
  });

  // 새 메시지 → 맨 아래로 스크롤
  useEffect(() => {
    if (!collapsed) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingMap, collapsed]);

  // Human 노드 클릭 → 해당 카드로 스크롤
  const scrollToNode = useCallback(
    (nodeId: string) => {
      const targetMsg = [...messages].reverse().find((m) => {
        if (m.kind !== "card_human") return false;
        const p = m.payload as HumanCardPayload;
        return p.nodeId === nodeId;
      });
      if (targetMsg) {
        const el = cardRefs.current.get(targetMsg.id);
        if (el) {
          setCollapsed(false);
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add(styles.highlight);
          setTimeout(() => el.classList.remove(styles.highlight), 1500);
        }
      }
    },
    [messages],
  );

  useEffect(() => {
    if (!scrollToNodeId) return;
    scrollToNode(scrollToNodeId);
    onScrollHandled?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollToNodeId]);

  // 전역 이벤트 수신
  useEffect(() => {
    function onHumanClick(e: Event) {
      const { nodeId } = (e as CustomEvent<{ nodeId: string }>).detail;
      scrollToNode(nodeId);
    }
    window.addEventListener("rf:humanNodeClick", onHumanClick);
    return () => window.removeEventListener("rf:humanNodeClick", onHumanClick);
  }, [scrollToNode]);

  // U1: 전송
  const sendMessage = useCallback(async () => {
    if (!pipelineId || !inputText.trim() || sending) return;
    const text = inputText.trim();
    setInputText("");
    setSending(true);
    try {
      await fetch(`/api/pipelines/${pipelineId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
    } catch {
      // 무시(fire-and-forget — 응답은 SSE로 수신)
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [pipelineId, inputText, sending]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void sendMessage();
      }
    },
    [sendMessage],
  );

  // 모든 렌더할 메시지(확정) + 스트리밍 중 assistant
  const renderedMessages = messages;
  // 스트리밍 중 assistant 가상 메시지
  const streamingText = streamingMsgId ? (streamingMap[streamingMsgId] ?? "") : null;

  return (
    <div
      className={`${styles.dock} ${collapsed ? styles.collapsed : ""}`}
    >
      {/* 헤더 */}
      <div className={styles.head}>
        <span>채팅 · {pipelineId ? "파이프라인" : "–"}</span>
        <button onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? "펼치기 ▴" : "접기 ▾"}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className={styles.stream}>
            {renderedMessages.length === 0 && !streamingText && (
              <div className={styles.empty}>
                블록을 만들어 달라고 하거나, &apos;작성해줘&apos;로 실행을 시작해 보세요.
              </div>
            )}
            {renderedMessages.map((msg) => (
              <MessageCard
                key={msg.id}
                msg={msg}
                cardRef={(el) => {
                  if (el) cardRefs.current.set(msg.id, el);
                  else cardRefs.current.delete(msg.id);
                }}
              />
            ))}
            {/* 스트리밍 중 assistant 버블 */}
            {streamingText !== null && (
              <div className={`${styles.card} ${styles.assistant}`}>
                <div className={styles.kind}>챗봇</div>
                <div className={styles.text}>
                  {streamingText}
                  <span className={styles.cursor} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          {/* U1: 입력창 활성 */}
          <div className={styles.input}>
            <input
              ref={inputRef}
              placeholder="블록을 만들어 달라고 하거나, '작성해줘'로 실행"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={sending || !pipelineId}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={sending || !inputText.trim() || !pipelineId}
            >
              {sending ? "전송 중…" : "전송"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 메시지 라우터
// ──────────────────────────────────────────────────────────

function MessageCard({
  msg,
  cardRef,
}: {
  msg: ChatMessage;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  switch (msg.kind) {
    case "user":
      return <UserCard msg={msg} cardRef={cardRef} />;
    case "assistant":
      return <AssistantCard msg={msg} cardRef={cardRef} />;
    case "card_run":
      return <RunCard msg={msg} cardRef={cardRef} />;
    case "card_human":
      return <HumanCard msg={msg} cardRef={cardRef} />;
    case "card_block":
      return <BlockCard msg={msg} cardRef={cardRef} />;
    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────
// 사용자 텍스트 카드
// ──────────────────────────────────────────────────────────

function UserCard({
  msg,
  cardRef,
}: {
  msg: ChatMessage;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const p = msg.payload as UserPayload;
  return (
    <div ref={cardRef} className={`${styles.card} ${styles.user}`}>
      <div className={styles.text}>{p.text}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 챗봇 응답 카드 (확정)
// ──────────────────────────────────────────────────────────

function AssistantCard({
  msg,
  cardRef,
}: {
  msg: ChatMessage;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const p = msg.payload as AssistantPayload;
  return (
    <div ref={cardRef} className={`${styles.card} ${styles.assistant}`}>
      <div className={styles.kind}>챗봇</div>
      <div className={styles.text}>{p.text}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// run 보고 카드
// ──────────────────────────────────────────────────────────

function RunCard({
  msg,
  cardRef,
}: {
  msg: ChatMessage;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const payload = msg.payload as RunCardPayload;
  const isGateFail = payload.event === "gate_failed";
  const isEnd = payload.event === "succeeded";
  const isStart = payload.event === "started";
  const isFailed = payload.event === "failed";

  const cardClass = isGateFail || isFailed
    ? `${styles.card} ${styles.gatefail}`
    : `${styles.card} ${styles.run}`;

  const title = payload.title ?? (
    isStart ? "RUN 시작" :
    isEnd ? "RUN 완료" :
    payload.event === "cancelled" ? "RUN 취소" :
    isFailed ? "RUN 실패" :
    isGateFail ? "게이트 실패" : payload.event
  );

  let body = "";
  if (isStart) {
    body = `그래프 스냅샷 생성 · ${payload.nodeCount ?? "?"}개 노드`;
  } else if (isEnd) {
    body = "모든 노드 성공";
  } else if (payload.event === "cancelled") {
    body = "중단됨";
  } else if (isGateFail) {
    const scoreText = payload.finalScore ?? (payload.score != null ? String(payload.score) : "?");
    body = `${payload.gateName ?? "Gate"} · ${payload.loops ?? "?"}회차 · score ${scoreText}`;
  } else if (isFailed) {
    body = payload.reason ?? "노드 실패";
  }

  return (
    <div ref={cardRef} className={cardClass}>
      <div className={styles.kind}>{title}</div>
      {body && <div>{body}</div>}
      {isEnd && payload.htmlArtifactId && (
        <div className={styles.actions}>
          <button
            className={styles.primary}
            onClick={() =>
              window.open(`/api/artifacts/${payload.htmlArtifactId}/download`, "_blank")
            }
          >
            ⬇ HTML 다운로드
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Human 대기 카드 (U5: gap_question 인라인 답변 + waiting 승인)
// ──────────────────────────────────────────────────────────

function HumanCard({
  msg,
  cardRef,
}: {
  msg: ChatMessage;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const payload = msg.payload as HumanCardPayload;
  // nodeRunId는 ChatMessage.nodeRunId(DB에서 직접)가 우선, 없으면 payload 폴백
  const nodeRunId = msg.nodeRunId ?? payload.nodeRunId;
  const event = payload.event;

  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [answering, setAnswering] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [editContent, setEditContent] = useState(payload.primaryContent ?? "");
  const [editing, setEditing] = useState(false);

  // gap_question → POST answer
  const submitAnswer = useCallback(async () => {
    if (!nodeRunId || !answerText.trim()) return;
    setAnswering(true);
    try {
      const res = await fetch(`/api/node-runs/${nodeRunId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: answerText.trim() }),
      });
      if (res.ok) setAnswered(true);
    } finally {
      setAnswering(false);
    }
  }, [nodeRunId, answerText]);

  // waiting → POST approve
  const approve = useCallback(async (editedContent?: string) => {
    if (!nodeRunId) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/node-runs/${nodeRunId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedContent ? { editedContent } : {}),
      });
      if (res.ok) setApproved(true);
    } finally {
      setApproving(false);
    }
  }, [nodeRunId]);

  const openSidePanel = useCallback(() => {
    if (payload.nodeId) {
      useCanvasStore.getState().select(payload.nodeId);
    }
  }, [payload.nodeId]);

  // approved 이벤트 — 이미 승인됨 표시
  if (event === "approved") {
    return (
      <div ref={cardRef} className={`${styles.card} ${styles.human}`}>
        <div className={styles.kind}>사람 대기 — {payload.nodeName ?? "Human 노드"}</div>
        <div className={styles.approvedBadge}>승인 완료</div>
      </div>
    );
  }

  // gap_question — 인라인 답변 입력창
  if (event === "gap_question") {
    return (
      <div ref={cardRef} className={`${styles.card} ${styles.human}`}>
        <div className={styles.kind}>갭 인터뷰 — {payload.nodeName ?? "Agent"}</div>
        {payload.question && (
          <div className={styles.instruction}>{payload.question}</div>
        )}
        {answered ? (
          <div className={styles.approvedBadge}>답변 전송됨</div>
        ) : (
          <div className={styles.gapArea}>
            <textarea
              className={styles.gapInput}
              placeholder="답변을 입력하세요…"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              rows={3}
              disabled={answering}
            />
            <div className={styles.actions}>
              <button
                className={styles.primary}
                onClick={() => void submitAnswer()}
                disabled={answering || !answerText.trim()}
              >
                {answering ? "전송 중…" : "답변"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // waiting (기본) — 승인·편집
  const allowEdit = payload.allowEdit ?? false;
  return (
    <div ref={cardRef} className={`${styles.card} ${styles.human}`}>
      <div className={styles.kind}>사람 대기 — {payload.nodeName ?? "Human 노드"}</div>
      {payload.instruction && (
        <div className={styles.instruction}>{payload.instruction}</div>
      )}
      {payload.excerpt && (
        <div className={styles.excerpt}>{payload.excerpt}</div>
      )}
      {approved ? (
        <div className={styles.approvedBadge}>승인 완료</div>
      ) : (
        <>
          {allowEdit && editing && (
            <textarea
              className={styles.gapInput}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
              style={{ marginTop: 6 }}
            />
          )}
          <div className={styles.actions}>
            <button onClick={openSidePanel}>사이드 패널에서 열기</button>
            {allowEdit && (
              <button onClick={() => setEditing((v) => !v)}>
                {editing ? "편집 취소" : "편집"}
              </button>
            )}
            <button
              className={styles.primary}
              onClick={() => void approve(editing ? editContent : undefined)}
              disabled={approving}
            >
              {approving ? "승인 중…" : "승인"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 블록 생성 카드 (U4)
// ──────────────────────────────────────────────────────────

function BlockCard({
  msg,
  cardRef,
}: {
  msg: ChatMessage;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const payload = msg.payload as BlockCardPayload;

  // 트레이 항목 하이라이트(U4: 커스텀 이벤트 — Palette에서 구독)
  const jumpToTray = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("rf:trayHighlight", {
        detail: { blockDefId: payload.blockDefId },
      }),
    );
  }, [payload.blockDefId]);

  return (
    <div ref={cardRef} className={`${styles.card} ${styles.block}`}>
      <div className={styles.kind}>블록 생성 — 새 블록 트레이에 담김</div>
      <div className={styles.blockName}>
        <span className={styles.blockType}>{payload.type?.toUpperCase()}</span>
        {payload.name}
      </div>
      {payload.description && (
        <div className={styles.excerpt}>{payload.description}</div>
      )}
      <div className={styles.actions}>
        <button onClick={jumpToTray}>트레이에서 보기</button>
      </div>
    </div>
  );
}
