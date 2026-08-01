// waiting_human 처리(A3) — Human 노드 대기 + Agent 내부 ask_human 갭 인터뷰 대기.
// 진실은 DB(node_run·run status = waiting_human), 인메모리 레지스트리는 재개 신호용.
//
// 두 종류의 대기:
//  1) Human 노드: node_run을 waiting_human으로 멈추고 approve(승인/편집본)로 재개.
//  2) ask_human(Agent 내부): SDK tool 호출이 answer(답변 텍스트)로 재개.
//
// 프로세스 재시작 시:
//  - Human 대기는 DB에 살아있어 approve에서 재하이드레이션(runner가 처리, §8-E).
//  - ask_human 대기는 SDK 세션이 죽으므로 answer는 실패 마감(§8-E 타협).

/** approve 대기 — Human 노드가 승인/편집본을 받을 때까지 멈춘다. */
export interface HumanApproval {
  /** 편집본(allowEdit·편집 시). 없으면 승인만(입력 그대로 통과). */
  editedContent?: string;
}

interface PendingHuman {
  kind: "human";
  resolve: (approval: HumanApproval) => void;
  reject: (err: Error) => void;
}

interface PendingAsk {
  kind: "ask";
  resolve: (answer: string) => void;
  reject: (err: Error) => void;
}

type Pending = PendingHuman | PendingAsk;

/**
 * nodeRunId → 대기 resolver. Human 노드·ask_human 공통.
 * 인메모리 싱글턴(러너와 같은 프로세스). approve/answer 라우트가 조회·해소한다.
 */
class HumanWaitRegistry {
  private pending = new Map<string, Pending>();

  /** Human 노드 대기 등록 → approve 호출 시 해소되는 Promise. */
  waitForApproval(nodeRunId: string): Promise<HumanApproval> {
    return new Promise<HumanApproval>((resolve, reject) => {
      this.pending.set(nodeRunId, { kind: "human", resolve, reject });
    });
  }

  /** ask_human 대기 등록 → answer 호출 시 해소되는 Promise. */
  waitForAnswer(nodeRunId: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.pending.set(nodeRunId, { kind: "ask", resolve, reject });
    });
  }

  /** approve 라우트: Human 대기 해소. 대기가 없으면 false(재하이드레이션 필요). */
  resolveApproval(nodeRunId: string, approval: HumanApproval): boolean {
    const p = this.pending.get(nodeRunId);
    if (!p || p.kind !== "human") return false;
    this.pending.delete(nodeRunId);
    p.resolve(approval);
    return true;
  }

  /** answer 라우트: ask_human 대기 해소. 대기가 없으면 false(세션 죽음). */
  resolveAnswer(nodeRunId: string, answer: string): boolean {
    const p = this.pending.get(nodeRunId);
    if (!p || p.kind !== "ask") return false;
    this.pending.delete(nodeRunId);
    p.resolve(answer);
    return true;
  }

  /** 취소·마감 시 대기 정리(reject). */
  reject(nodeRunId: string, err: Error): void {
    const p = this.pending.get(nodeRunId);
    if (!p) return;
    this.pending.delete(nodeRunId);
    p.reject(err);
  }

  has(nodeRunId: string): boolean {
    return this.pending.has(nodeRunId);
  }

  kindOf(nodeRunId: string): "human" | "ask" | null {
    return this.pending.get(nodeRunId)?.kind ?? null;
  }
}

const globalForHuman = globalThis as unknown as {
  __recruitFlowHumanWait?: HumanWaitRegistry;
};

export const humanWait: HumanWaitRegistry =
  globalForHuman.__recruitFlowHumanWait ?? new HumanWaitRegistry();

if (process.env.NODE_ENV !== "production") {
  globalForHuman.__recruitFlowHumanWait = humanWait;
}
