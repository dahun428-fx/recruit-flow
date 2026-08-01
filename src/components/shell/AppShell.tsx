// 공유 셸 — 상단 바 + 탭 컨텐츠 + 채팅 독.
// M2b: 채팅 독 표시(Human 노드 ↔ 카드 스크롤 연동은 전역 이벤트).
"use client";

import { TopBar } from "./TopBar";
import { ChatDock } from "@/components/chat/ChatDock";
import styles from "./AppShell.module.css";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <TopBar />
      <div className={styles.content}>
        <div className={styles.canvasArea}>
          {children}
        </div>
        <ChatDock />
      </div>
    </div>
  );
}
