// 채팅 독(M2) — 이벤트 스트림 카드(card_run·card_human).
// 입력창 비활성(M3). Human 노드 클릭 → 해당 카드로 스크롤.
// SSE chat_card 구독 + REST messages 로드.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasStore } from "@/store/canvas";
import type { ChatMessage, SseEvent } from "@/lib/types";
import styles from "./ChatDock.module.css";

interface Props {
  /** Human 노드 클릭 → 해당 카드로 스크롤할 nodeId */
  scrollToNodeId?: string | null;
  onScrollHandled?: () => void;
}

interface RunCardPayload {
  event: "start" | "end" | "gate_failed" | "cancelled";
  nodeCount?: number;
  score?: number;
  reason?: string;
  iteration?: number;
  htmlArtifactId?: string;
}

interface HumanCardPayload {
  instruction?: string;
  excerpt?: string;
  nodeId?: string;
  nodeRunId?: string;
}

export function ChatDock({ scrollToNodeId, onScrollHandled }: Props) {
  const pipelineId = useCanvasStore((s) => s.pipelineId);
  const run = useCanvasStore((s) => s.run);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const streamRef = useRef<EventSource | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // REST 로드
  useEffect(() => {
    if (!pipelineId) return;
    fetch(`/api/pipelines/${pipelineId}/messages`)
      .then((r) => r.json())
      .then((msgs: ChatMessage[]) => setMessages(msgs))
      .catch(() => {});
  }, [pipelineId]);

  // SSE chat_card 구독 — 활성 run이 있을 때
  useEffect(() => {
    const runId = run?.runId;
    if (!runId || !pipelineId) return;

    const es = new EventSource(`/api/runs/${runId}/events`);
    streamRef.current = es;

    es.addEventListener("chat_card", (ev) => {
      const d = JSON.parse((ev as MessageEvent).data) as Extract<
        SseEvent,
        { type: "chat_card" }
      >;
      setMessages((prev) => {
        // 중복 방지
        if (prev.some((m) => m.id === d.message.id)) return prev;
        return [...prev, d.message];
      });
    });

    es.onerror = () => {
      es.close();
      streamRef.current = null;
      // 재조회
      if (pipelineId) {
        fetch(`/api/pipelines/${pipelineId}/messages`)
          .then((r) => r.json())
          .then((msgs: ChatMessage[]) => setMessages(msgs))
          .catch(() => {});
      }
    };

    return () => {
      es.close();
      streamRef.current = null;
    };
  }, [run?.runId, pipelineId]);

  // 새 메시지 → 맨 아래로 스크롤
  useEffect(() => {
    if (!collapsed) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, collapsed]);

  // Human 노드 클릭 → 해당 카드로 스크롤(prop 또는 전역 이벤트)
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

  const height = collapsed ? undefined : 205;

  return (
    <div
      className={`${styles.dock} ${collapsed ? styles.collapsed : ""}`}
      style={collapsed ? undefined : { height }}
    >
      {/* 헤더 */}
      <div className={styles.head}>
        <span>채팅 · {useCanvasStore.getState().pipelineId ? "파이프라인" : "–"}</span>
        <button onClick={() => setCollapsed((v) => !v)}>
          {collapsed ? "펼치기 ▴" : "접기 ▾"}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className={styles.stream}>
            {messages.length === 0 && (
              <div className={styles.empty}>
                run을 시작하면 이벤트 카드가 여기에 표시됩니다.
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
            <div ref={bottomRef} />
          </div>
          {/* 입력창 — M3에서 활성 */}
          <div className={styles.input}>
            <input
              placeholder="블록을 만들어 달라고 하거나, '작성해줘'로 실행 (M3)"
              disabled
            />
            <button disabled style={{ opacity: 0.5 }}>
              전송
            </button>
            <span className={styles.m3note}>M2: 이벤트 스트림만 · M3: 입력 활성화</span>
          </div>
        </>
      )}
    </div>
  );
}

function MessageCard({
  msg,
  cardRef,
}: {
  msg: ChatMessage;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  if (msg.kind === "card_run") {
    return <RunCard msg={msg} cardRef={cardRef} />;
  }
  if (msg.kind === "card_human") {
    return <HumanCard msg={msg} cardRef={cardRef} />;
  }
  return null;
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
  const isEnd = payload.event === "end";
  const isStart = payload.event === "start";

  const cardClass = isGateFail
    ? `${styles.card} ${styles.gatefail}`
    : `${styles.card} ${styles.run}`;

  let title = "";
  let body = "";
  if (isStart) {
    title = "RUN 시작";
    body = `그래프 스냅샷 생성 · ${payload.nodeCount ?? "?"}개 노드`;
  } else if (isEnd) {
    title = "RUN 완료";
    body = "모든 노드 성공";
  } else if (payload.event === "cancelled") {
    title = "RUN 취소";
    body = "중단됨";
  } else if (isGateFail) {
    title = `게이트 실패 · ${payload.iteration ?? "?"}회차`;
    body = `score ${payload.score ?? "?"} — ${payload.reason ?? ""} → 재작성`;
  }

  return (
    <div ref={cardRef} className={cardClass}>
      <div className={styles.kind}>{title}</div>
      <div>{body}</div>
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

function HumanCard({
  msg,
  cardRef,
}: {
  msg: ChatMessage;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const payload = msg.payload as HumanCardPayload;
  const nodeRunId = payload.nodeRunId;
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);

  const approve = useCallback(async () => {
    if (!nodeRunId) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/node-runs/${nodeRunId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) setApproved(true);
    } finally {
      setApproving(false);
    }
  }, [nodeRunId]);

  const openSidePanel = useCallback(() => {
    // Human 노드 선택 → 사이드 패널 열기
    if (payload.nodeId) {
      useCanvasStore.getState().select(payload.nodeId);
    }
  }, [payload.nodeId]);

  return (
    <div ref={cardRef} className={`${styles.card} ${styles.human}`}>
      <div className={styles.kind}>🙋 사람 대기 — Human 노드</div>
      {payload.instruction && <div className={styles.instruction}>{payload.instruction}</div>}
      {payload.excerpt && <div className={styles.excerpt}>{payload.excerpt}</div>}
      {!approved ? (
        <div className={styles.actions}>
          <button onClick={openSidePanel}>사이드 패널에서 열기</button>
          <button
            className={styles.primary}
            onClick={approve}
            disabled={approving}
          >
            {approving ? "승인 중…" : "승인"}
          </button>
        </div>
      ) : (
        <div className={styles.approvedBadge}>승인 완료</div>
      )}
    </div>
  );
}
