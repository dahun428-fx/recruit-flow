// recruit-flow 공유 타입 — API·SSE 경계 계약 (M2)
// 출처: specs/m2-plan.md §3.1, specs/{nodes,schema,engine}.md.
// engine-builder·ui-builder·api-db-builder가 공유하는 경계 파일.
// 런타임 의존 없음(순수 타입) — validation.ts에서도 재사용 가능.

// ---------------------------------------------------------------------------
// 열거형
// ---------------------------------------------------------------------------

/** v1 노드 8종(실행 계층 5 + 장착 계층 3). M1은 agent/input/output만 활성. */
export type NodeType =
  | "agent"
  | "input"
  | "output"
  | "gate"
  | "human"
  | "skill"
  | "rule"
  | "tool";

/** 실행 계층(실선 데이터 흐름) / 장착 계층(점선 장착). */
export const EXEC_NODE_TYPES: NodeType[] = [
  "agent",
  "input",
  "output",
  "gate",
  "human",
];
export const MOUNT_NODE_TYPES: NodeType[] = ["skill", "rule", "tool"];

export type ArtifactFormat = "markdown" | "json" | "html";

/** run 상태. gate_failed=최대 루프 초과, waiting_human=Human/갭 대기. */
export type RunStatus =
  | "running"
  | "waiting_human"
  | "succeeded"
  | "failed"
  | "gate_failed"
  | "cancelled";

export type NodeRunStatus =
  | "queued"
  | "running"
  | "waiting_human"
  | "succeeded"
  | "failed"
  | "skipped";

// ---------------------------------------------------------------------------
// 노드 config (타입별) — nodes.config JSON 형태
// ---------------------------------------------------------------------------

/**
 * 장착 참조(M4 결정 3·4-B). skill/rule/tool은 더 이상 캔버스 독립 노드가
 * 아니라 Agent에 종속된 칩이다. 팔레트 정의(block_def)를 참조로 장착한다.
 * 공유 장착(Rule 1개→여러 Agent)은 여러 Agent가 같은 blockDefId를 가리켜 성립.
 */
export interface MountRef {
  /** 장착된 skill/rule/tool 정의(block_defs) */
  blockDefId: string;
  /**
   * resolve 시 정의에서 박제되는 표시·번역용 메타(영속 필드 아님 — 저장되는
   * MountRef는 {blockDefId, override?}만 담는다). resolveNodeConfig가 채운다.
   * - run 스냅샷: resolve 시점의 type/name을 고정 → 실행 중 정의 rename에 불변
   *   (engine.md §1). deriveMounts가 DB 재조회 없이 시스템 프롬프트 헤더를 만든다.
   * - 라이브 캔버스: 매 재resolve로 정의 rename을 반영(결정 1).
   */
  type?: "skill" | "rule" | "tool";
  name?: string;
  /** 이 Agent에서만 적용하는 필드별 오버라이드(정의 config 위에 덮어씀) */
  override?: Partial<SkillConfig & RuleConfig & ToolConfig>;
}

export interface AgentConfig {
  /** 시스템 프롬프트가 되는 역할(doc: 포인터 삽입 지원) */
  role: string;
  outputFormat: "markdown" | "json";
  /** 미지정 시 엔진 기본 모델 */
  model?: string;
  /** outputFormat==='json'일 때 출력 강제 스키마(JSON Schema 텍스트/객체) */
  jsonSchema?: string;
  /** 갭 인터뷰 모드: 멈추고 묻기(ask) / [확인 필요] 표시하고 계속(annotate) */
  gapMode?: "ask" | "annotate";
  /** M4 결정 3: 장착된 기술/규칙/도구 칩(정의 참조). mount 엣지·노드를 대체. */
  mounts?: MountRef[];
}

export interface InputConfig {
  /** 문서 라이브러리 참조 */
  documentId?: string;
  /** 고급: 인라인 텍스트 모드(documentId 대신) */
  inlineText?: string;
}

export interface OutputConfig {
  /** M1은 'default', M2는 DESIGN.md 토큰 템플릿 추가 가능 */
  templateId: string;
  /** 고급: 파일명 규칙 */
  filenameRule?: string;
}

export interface GateConfig {
  /** sandboxed 조건식(예: "recruiter-screen.total >= 80 && tech-screen.total >= 80") */
  expr: string;
  /** 최대 루프 횟수(기본 3). 초과 시 run gate_failed */
  maxLoops: number;
  /** fail 시 재실행 시작 노드(미지정 시 상류 마크다운 생성 노드) */
  failTargetNodeId?: string;
}

export interface HumanConfig {
  /** 사람에게 보여줄 안내 */
  instruction: string;
  /** 편집 후 승인 허용 여부 */
  allowEdit: boolean;
  /** 마크다운 주 입력이 여럿일 때 편집 대상 지정 */
  primaryInputNodeId?: string;
}

export interface SkillConfig {
  /** 방법론 마크다운 — Agent 시스템 프롬프트에 주입 */
  content: string;
}

export interface RuleConfig {
  /** 제약 마크다운 — Agent 시스템 프롬프트 뒤에 append */
  content: string;
}

export interface ToolConfig {
  /** 내장 tool 카탈로그(nodes.md §7) */
  toolName: "get_document" | "search_documents";
}

/** 노드 type에 따른 config 유니온. */
export type NodeConfig =
  | AgentConfig
  | InputConfig
  | OutputConfig
  | GateConfig
  | HumanConfig
  | SkillConfig
  | RuleConfig
  | ToolConfig;

// ---------------------------------------------------------------------------
// 그래프 행 (API 경계 형태 — camelCase)
// ---------------------------------------------------------------------------

/** flow=실선 데이터 흐름, mount=점선 장착(장착 노드→Agent 상단). */
export type EdgeKind = "flow" | "mount";

/** Gate만 pass/fail 두 출력 핸들. 나머지 flow 엣지는 null. */
export type SourceHandle = null | "pass" | "fail";

export interface NodeRow {
  id: string;
  pipelineId: string;
  type: NodeType;
  /** M4 결정 1: name은 항상 인스턴스 소유. 정의 이름 변경이 이 값을 끌고
   *  가지 않는다(Gate 조건식이 노드 이름을 참조하므로 안정성 보장). */
  name: string;
  positionX: number;
  positionY: number;
  /**
   * M4 결정 1·4-A: 참조+오버라이드 시맨틱.
   * - blockDefId===null(맨손 노드): config가 완결 config.
   * - blockDefId!==null(정의 참조): config는 **오버라이드된 필드만** 담고,
   *   실효 config = block_def.config ⊕ config(필드별 덮어쓰기).
   * 실행 스냅샷은 이 참조를 해소(resolve)한 완결 config를 저장(engine.md §1).
   */
  blockDefId: string | null;
  config: Partial<NodeConfig>;
}

export interface EdgeRow {
  id: string;
  pipelineId: string;
  sourceNodeId: string;
  targetNodeId: string;
  kind: EdgeKind;
  sourceHandle: SourceHandle;
  inputOrder: number;
}

export interface Graph {
  nodes: NodeRow[];
  edges: EdgeRow[];
}

// ---------------------------------------------------------------------------
// 파이프라인
// ---------------------------------------------------------------------------

export interface Pipeline {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt: number | null;
}

/** 목록용 요약(현재는 Pipeline과 동형이지만 경계로 분리). */
export type PipelineSummary = Pipeline;

// ---------------------------------------------------------------------------
// 저장된 블록 정의 (block_defs) — 팔레트 하위 항목·임포터 산출
// ---------------------------------------------------------------------------

export interface BlockDef {
  id: string;
  type: NodeType;
  name: string;
  description: string;
  config: NodeConfig;
  /** @deprecated M4 결정 5: enabled 토글 폐지. 컬럼은 유지하되 UI·러너·팔레트
   *  필터에서 사용하지 않는다(마이그레이션 회피, v2 청소 대상). */
  enabled: boolean;
  origin: "human" | "chatbot" | "import";
  /** 새 블록 트레이 대기(챗봇 add·M3). 캔버스 드래그 승인 시 false */
  tray: boolean;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// 아티팩트
// ---------------------------------------------------------------------------

export interface ArtifactMeta {
  /** Input: 읽은 문서 버전 번호 */
  version?: number;
  /** Human: 편집 주체 */
  editedBy?: string;
}

export interface Artifact {
  id: string;
  nodeRunId: string;
  format: ArtifactFormat;
  content: string;
  meta?: ArtifactMeta | null;
}

// ---------------------------------------------------------------------------
// run 실행 기록
// ---------------------------------------------------------------------------

export interface Run {
  id: string;
  pipelineId: string;
  status: RunStatus;
  /** 부분 재실행 시 상류 아티팩트 복사 출처(직전 완료 run) */
  upstreamRunId: string | null;
  startedAt: number;
  endedAt: number | null;
}

export interface NodeRun {
  id: string;
  runId: string;
  nodeId: string;
  /** Gate 루프 회차(1부터). 같은 nodeId에 여러 행 가능 */
  iteration: number;
  status: NodeRunStatus;
  /** Gate 전용 라우팅 결정. Gate 외 노드는 null(schema.md) */
  gateDecision: "pass" | "fail" | null;
  error: string | null;
  startedAt: number | null;
  endedAt: number | null;
}

// ---------------------------------------------------------------------------
// 검증
// ---------------------------------------------------------------------------

export interface ValidationError {
  code:
    | "orphan"
    | "cycle"
    | "output_markdown_count"
    | "gate_json_upstream"
    | "mount_wiring"
    | "gate_missing_fail";
  /** 관련 노드(있으면) */
  nodeId?: string;
  message: string;
}

// ---------------------------------------------------------------------------
// run 시작 · 복원
// ---------------------------------------------------------------------------

export type RunStartResult =
  | { runId: string }
  | { errors: ValidationError[] };

/** GET /api/runs/[id] — 새로고침 복원용. SSE=통지, 진실=이 DB 스냅샷. */
export interface RunState {
  run: Run;
  nodeRuns: NodeRun[];
  artifacts: Artifact[];
}

// ---------------------------------------------------------------------------
// 문서
// ---------------------------------------------------------------------------

export interface Document {
  id: string;
  name: string;
  currentVersion: number;
  createdAt: number;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  content: string;
  author: "human" | "llm";
  note: string | null;
  createdAt: number;
}

/** GET /api/documents/[id] — 문서 + 현재 본문. */
export interface DocumentDetail extends Document {
  content: string;
}

// ---------------------------------------------------------------------------
// 채팅 (chat_messages) — M2는 이벤트 카드만(입력창·챗봇은 M3)
// ---------------------------------------------------------------------------

export type ChatMessageKind =
  | "user"
  | "assistant"
  | "card_block"
  | "card_human"
  | "card_run";

export interface ChatMessage {
  id: string;
  pipelineId: string;
  kind: ChatMessageKind;
  /** 텍스트 또는 카드 데이터(JSON) */
  payload: unknown;
  runId?: string | null;
  nodeRunId?: string | null;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// SSE 이벤트 — event 이름 = 아래 `type`
// 원칙: SSE=통지, 진실=DB. 접속 시 REST 로드 후 구독, 끊기면 REST 재조회.
// ---------------------------------------------------------------------------

export interface RunStatusEvent {
  type: "run_status";
  runId: string;
  status: RunStatus;
  progress: { done: number; total: number };
}

export interface NodeStatusEvent {
  type: "node_status";
  nodeId: string;
  nodeRunId: string;
  /** Gate 루프 실회차 */
  iteration: number;
  status: NodeRunStatus;
}

export interface ArtifactDeltaEvent {
  type: "artifact_delta";
  nodeRunId: string;
  /** 아티팩트 누적 content에서 이 chunk가 시작하는 UTF-16 offset. */
  offset: number;
  chunk: string;
}

/** M2: run 보고·Human 대기 카드 통지. run 스코프 + M3 pipeline 채널 미러. */
export interface ChatCardEvent {
  type: "chat_card";
  message: ChatMessage;
}

/** M3: 챗봇 응답 스트리밍 델타(통지 전용 — DB엔 완료 시 assistant 1건만). */
export interface ChatDeltaEvent {
  type: "chat_delta";
  messageId: string;
  chunk: string;
}

/** M3: 확정된 chat_message(user/assistant/card_block) 통지. */
export interface ChatMessageEvent {
  type: "chat_message";
  message: ChatMessage;
}

/**
 * card_block payload 형태(런타임 타입 아님, 문서용):
 *   { blockDefId: string; type: NodeType; name: string; description: string }
 * gap 카드(card_human) payload: { event: 'gap_question'; nodeName; question }
 *   / { event: 'waiting'; instruction; excerpt } / { event: 'approved' }
 */

/**
 * 트레이(block_defs) 변경 통지. block_defs에는 pipeline_id가 없는 **전역**
 * 테이블이므로 열려 있는 모든 pipeline 채널에 브로드캐스트한다(engine.md §3).
 */
export interface BlockDefEvent {
  type: "block_def";
  action: "updated" | "deleted";
  blockDefId: string;
  blockDef?: BlockDef;
}

/**
 * M4 결정 6·4-G: 문서 변경 통지. documents도 pipeline_id 없는 **전역**
 * 테이블이므로 열려 있는 모든 pipeline 채널에 브로드캐스트(block_def 선례).
 * 챗봇 edit_document·register_document, 사람 편집 모두 이 이벤트를 낸다.
 * 클라이언트는 탐색기·열린 문서 탭·자료(input) 노드 참조를 재조회한다.
 */
export interface DocumentChangedEvent {
  type: "document_changed";
  action: "created" | "updated" | "deleted";
  documentId: string;
  /** 새 현재 버전 번호(created/updated 시). */
  version?: number;
}

export type SseEvent =
  | RunStatusEvent
  | NodeStatusEvent
  | ArtifactDeltaEvent
  | ChatCardEvent
  | ChatDeltaEvent
  | ChatMessageEvent
  | BlockDefEvent
  | DocumentChangedEvent;

/**
 * 한 SSE 채널 안에서 단조 증가하는 이벤트 번호.
 * REST 스냅샷의 `X-Stream-Cursor`와 비교해 스냅샷 이후 이벤트만 재적용한다.
 */
export type SequencedSseEvent = SseEvent & { sequence: number };
