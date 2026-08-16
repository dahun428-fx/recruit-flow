// 우측 상주 채팅 패널 — 기존 ChatDock(하단)을 우측 세로 패널로 이전.
// SSE 훅·메시지 카드 로직은 ChatDock에서 그대로 가져옴.
// 접기 버튼(접으면 아이콘/얇은 바) + 미확인 배지(card_human 도착 시).
// 자동 팝업 없음. 캔버스 Human 노드 클릭 → 펼치며 해당 카드 스크롤.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import { useCanvasStore } from "@/store/canvas";
import { rememberActiveRun } from "@/hooks/useRunStream";
import type { ChatMessage, RunState } from "@/lib/types";
import { usePipelineStream } from "@/hooks/usePipelineStream";
import { Resizer } from "@/components/shell/Resizer";
import styles from "./ChatPanel.module.css";

// TabEditor와 동일한 marked 설정 적용
marked.setOptions({ gfm: true, breaks: false, async: false });

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
// ChatPanel 메인
// ──────────────────────────────────────────────────────────

interface Props {
  /** 패널 너비 px */
  size: number;
  /** Resizer의 onMouseDown 핸들러 */
  onResizerMouseDown: (e: React.MouseEvent) => void;
}

export function ChatPanel({ size, onResizerMouseDown }: Props) {
  const pipelineId = useCanvasStore((s) => s.pipelineId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingMap, setStreamingMap] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [unreadHuman, setUnreadHuman] = useState(0);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);

  // pipeline SSE 구독
  usePipelineStream(pipelineId, {
    onMessages: (msgs) => {
      setMessages(msgs);
    },
    onBlockDefChanged: () => {
      window.dispatchEvent(new CustomEvent("rf:blockDefsChanged"));
    },
    // 문서 변경 통지 → 탐색기·열린 탭이 재조회(M4 결정 4-G).
    onDocumentChanged: (documentId) => {
      window.dispatchEvent(new CustomEvent("rf:documentsChanged", { detail: { documentId } }));
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
      if (msg.kind === "assistant") {
        setStreamingMap((prev) => {
          const next = { ...prev };
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
      // 접혀 있고 card_human이면 미확인 배지 증가
      if (msg.kind === "card_human" && collapsed) {
        setUnreadHuman((v) => v + 1);
      }
      // U6: card_run(started) → store initRun + useRunStream 기동
      if (msg.kind === "card_run") {
        const p = msg.payload as RunCardPayload;
        const runId = msg.runId ?? p.runId;
        if (p.event === "started" && runId && pipelineId) {
          rememberActiveRun(pipelineId, runId);
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
          setUnreadHuman(0);
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add(styles.highlight);
          setTimeout(() => el.classList.remove(styles.highlight), 1500);
        }
      }
    },
    [messages],
  );

  // 전역 이벤트 수신 (Human 노드 클릭)
  useEffect(() => {
    function onHumanClick(e: Event) {
      const { nodeId } = (e as CustomEvent<{ nodeId: string }>).detail;
      scrollToNode(nodeId);
    }
    window.addEventListener("rf:humanNodeClick", onHumanClick);
    return () => window.removeEventListener("rf:humanNodeClick", onHumanClick);
  }, [scrollToNode]);

  // 패널 펼칠 때 미확인 초기화
  const expand = useCallback(() => {
    setCollapsed(false);
    setUnreadHuman(0);
  }, []);

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
      // 무시(fire-and-forget)
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

  const streamingText = streamingMsgId ? (streamingMap[streamingMsgId] ?? "") : null;

  // 접힌 상태: 얇은 바(리사이저 없음)
  if (collapsed) {
    return (
      <div className={styles.collapsedBar}>
        <button
          className={styles.expandBtn}
          onClick={expand}
          title="채팅 패널 펼치기"
        >
          ◀
        </button>
        <div className={styles.collapsedLabel}>채팅</div>
        {unreadHuman > 0 && (
          <div className={styles.unreadBadge}>{unreadHuman}</div>
        )}
      </div>
    );
  }

  return (
    <>
      <Resizer vertical onMouseDown={onResizerMouseDown} />
      <div className={styles.panel} style={{ width: size }}>
        {/* 헤더 */}
        <div className={styles.head}>
          <span className={styles.headTitle}>채팅</span>
          <button
            className={styles.collapseBtn}
            onClick={() => setCollapsed(true)}
            title="채팅 패널 접기"
          >
            접기 ▶
          </button>
        </div>

        {/* 메시지 스트림 */}
        <div className={styles.stream}>
          {messages.length === 0 && !streamingText && (
            <div className={styles.empty}>
              블록을 만들어 달라고 하거나, &apos;작성해줘&apos;로 실행을 시작해 보세요.
            </div>
          )}
          {messages.map((msg) => (
            <MessageCard
              key={msg.id}
              msg={msg}
              cardRef={(el) => {
                if (el) cardRefs.current.set(msg.id, el);
                else cardRefs.current.delete(msg.id);
              }}
            />
          ))}
          {streamingText !== null && (
            <StreamingAssistantCard text={streamingText} />
          )}
          <div ref={bottomRef} />
        </div>

        {/* 퀵액션 칩 */}
        <QuickChips onSelect={setInputText} inputRef={inputRef} />

        {/* 입력창 */}
        <div className={styles.input}>
          <input
            ref={inputRef}
            placeholder="블록을 만들어 달라고 하거나, '작성해줘'로 실행"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={sending || !pipelineId}
            data-testid="chat-input"
          />
          <button
            onClick={() => void sendMessage()}
            disabled={sending || !inputText.trim() || !pipelineId}
            data-testid="chat-send"
          >
            {sending ? "전송 중…" : "전송"}
          </button>
        </div>
      </div>
    </>
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

function UserCard({
  msg,
  cardRef,
}: {
  msg: ChatMessage;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const p = msg.payload as UserPayload;
  return (
    <div
      ref={cardRef}
      className={`${styles.card} ${styles.user}`}
      data-testid={`chat-msg-${msg.id}`}
      data-kind="user"
    >
      <div className={styles.text}>{p.text}</div>
    </div>
  );
}

function AssistantCard({
  msg,
  cardRef,
}: {
  msg: ChatMessage;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const p = msg.payload as AssistantPayload;
  // TabEditor의 marked.parse → dangerouslySetInnerHTML 패턴 동일하게 재사용
  const html = useMemo(() => marked.parse(p.text) as string, [p.text]);
  return (
    <div
      ref={cardRef}
      className={`${styles.card} ${styles.assistant}`}
      data-testid={`chat-msg-${msg.id}`}
      data-kind="assistant"
    >
      <div className={styles.kind}>챗봇</div>
      <div
        className={styles.mdBody}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

/** 스트리밍 중인 assistant 메시지 — 마크다운 실시간 렌더 + 커서 */
function StreamingAssistantCard({ text }: { text: string }) {
  const html = useMemo(() => marked.parse(text) as string, [text]);
  return (
    <div className={`${styles.card} ${styles.assistant}`}>
      <div className={styles.kind}>챗봇</div>
      <div
        className={styles.mdBody}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <span className={styles.cursor} />
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// 퀵액션 칩 상수 및 컴포넌트
// ──────────────────────────────────────────────────────────

const QUICK_CHIPS: { label: string; prefill: string }[] = [
  { label: "새 에이전트", prefill: "새 에이전트 블록 만들어줘 — 역할: " },
  { label: "자료", prefill: "새 자료(Input) 블록 만들어줘 — 설명: " },
  { label: "도구", prefill: "새 도구(Tool) 블록 만들어줘 — 이름: " },
  { label: "관문", prefill: "새 관문(Gate) 블록 만들어줘 — 평가 기준: " },
  { label: "내 검토", prefill: "새 Human 검토 블록 만들어줘 — 안내문: " },
  { label: "작성해줘", prefill: "지금 파이프라인을 실행해서 이력서를 작성해줘" },
];

function QuickChips({
  onSelect,
  inputRef,
}: {
  onSelect: (text: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className={styles.chips}>
      {QUICK_CHIPS.map((chip) => (
        <button
          key={chip.label}
          className={styles.chip}
          onClick={() => {
            onSelect(chip.prefill);
            setTimeout(() => {
              inputRef.current?.focus();
              // 커서를 맨 끝으로 이동
              const el = inputRef.current;
              if (el) {
                const len = chip.prefill.length;
                el.setSelectionRange(len, len);
              }
            }, 0);
          }}
          type="button"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

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

  const cardClass =
    isGateFail || isFailed
      ? `${styles.card} ${styles.gatefail}`
      : `${styles.card} ${styles.run}`;

  const title =
    payload.title ??
    (isStart
      ? "RUN 시작"
      : isEnd
      ? "RUN 완료"
      : payload.event === "cancelled"
      ? "RUN 취소"
      : isFailed
      ? "RUN 실패"
      : isGateFail
      ? "게이트 실패"
      : payload.event);

  let body = "";
  if (isStart) {
    body = `그래프 스냅샷 생성 · ${payload.nodeCount ?? "?"}개 노드`;
  } else if (isEnd) {
    body = "모든 노드 성공";
  } else if (payload.event === "cancelled") {
    body = "중단됨";
  } else if (isGateFail) {
    const scoreText =
      payload.finalScore ??
      (payload.score != null ? String(payload.score) : "?");
    body = `${payload.gateName ?? "Gate"} · ${payload.loops ?? "?"}회차 · score ${scoreText}`;
  } else if (isFailed) {
    body = payload.reason ?? "노드 실패";
  }

  return (
    <div
      ref={cardRef}
      className={cardClass}
      data-testid={`chat-msg-${msg.id}`}
      data-kind="card_run"
    >
      <div className={styles.kind}>{title}</div>
      {body && <div>{body}</div>}
      {isEnd && payload.htmlArtifactId && (
        <div className={styles.actions}>
          <button
            className={styles.primary}
            onClick={() =>
              window.open(
                `/api/artifacts/${payload.htmlArtifactId}/download`,
                "_blank",
              )
            }
          >
            ⬇ HTML 다운로드
          </button>
        </div>
      )}
    </div>
  );
}

function HumanCard({
  msg,
  cardRef,
}: {
  msg: ChatMessage;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const payload = msg.payload as HumanCardPayload;
  const nodeRunId = msg.nodeRunId ?? payload.nodeRunId;
  const event = payload.event;

  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [answering, setAnswering] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [editContent, setEditContent] = useState(payload.primaryContent ?? "");
  const [editing, setEditing] = useState(false);

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

  const approve = useCallback(
    async (editedContent?: string) => {
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
    },
    [nodeRunId],
  );

  const openSidePanel = useCallback(() => {
    if (payload.nodeId) {
      useCanvasStore.getState().select(payload.nodeId);
      // M4: 노드 탭 열기 — TabEditor가 수신해 노드 편집기 탭을 연다.
      window.dispatchEvent(new CustomEvent("rf:humanNodeClick", { detail: { nodeId: payload.nodeId } }));
    }
  }, [payload.nodeId]);

  if (event === "approved") {
    return (
      <div
        ref={cardRef}
        className={`${styles.card} ${styles.human}`}
        data-testid={`chat-msg-${msg.id}`}
        data-kind="card_human"
      >
        <div className={styles.kind}>
          사람 대기 — {payload.nodeName ?? "Human 노드"}
        </div>
        <div className={styles.approvedBadge}>승인 완료</div>
      </div>
    );
  }

  if (event === "gap_question") {
    return (
      <div
        ref={cardRef}
        className={`${styles.card} ${styles.human}`}
        data-testid={`chat-msg-${msg.id}`}
        data-kind="card_human"
      >
        <div className={styles.kind}>
          갭 인터뷰 — {payload.nodeName ?? "Agent"}
        </div>
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
              data-testid="gap-answer-input"
            />
            <div className={styles.actions}>
              <button
                className={styles.primary}
                onClick={() => void submitAnswer()}
                disabled={answering || !answerText.trim()}
                data-testid="gap-answer-submit"
              >
                {answering ? "전송 중…" : "답변"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const allowEdit = payload.allowEdit ?? false;
  return (
    <div
      ref={cardRef}
      className={`${styles.card} ${styles.human}`}
      data-testid={`chat-msg-${msg.id}`}
      data-kind="card_human"
    >
      <div className={styles.kind}>
        사람 대기 — {payload.nodeName ?? "Human 노드"}
      </div>
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
              data-testid="human-card-approve"
            >
              {approving ? "승인 중…" : "승인"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function BlockCard({
  msg,
  cardRef,
}: {
  msg: ChatMessage;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const payload = msg.payload as BlockCardPayload;

  const jumpToTray = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("rf:trayHighlight", {
        detail: { blockDefId: payload.blockDefId },
      }),
    );
  }, [payload.blockDefId]);

  return (
    <div
      ref={cardRef}
      className={`${styles.card} ${styles.block}`}
      data-testid={`chat-msg-${msg.id}`}
      data-kind="card_block"
    >
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
