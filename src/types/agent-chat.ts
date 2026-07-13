import type { InferUIMessageChunk, UIMessage } from "ai";

export type AgentBriefData = {
  topic: string;
  audience: string;
  pageCount: number;
  style: string;
  requirements?: string;
  purpose?: "pitch-deck" | "teaching-tutorial" | "conference-talk" | "internal-presentation";
  density?: "speaker-led" | "reading-first";
  contentReadiness?: "ready" | "rough-notes" | "topic-only";
};

export type AgentChatAction =
  | "chat"
  | "revise-content"
  | "revise-structure"
  | "change-palette"
  | "discover-styles"
  | "more-styles"
  | "select-style"
  | "execute-proposal"
  | "generate";

export type AgentRevisionData = {
  instruction: string;
  targetSlides?: number[];
  requiresOutlineReview: boolean;
};

export type AgentActionProposal = {
  proposalId: string;
  deckId: string;
  baseVersion: number;
  action: "revise-content" | "revise-structure" | "change-palette" | "change-style" | "mixed";
  instruction: string;
  targetSlides?: number[];
  requiresOutlineReview: boolean;
  userFacingSummary: string;
  status: "pending" | "executing" | "consumed" | "cancelled" | "superseded";
  createdAt: string;
  executionStartedAt?: string;
};

export type AgentChatResponse = {
  reply?: string;
  readyToGenerate?: boolean;
  brief?: AgentBriefData | null;
  nextAction?: AgentChatAction;
  revision?: AgentRevisionData | null;
  styleId?: string | null;
  proposal?: AgentActionProposal | null;
  executeProposalId?: string | null;
  error?: string;
};

export type AgentChatStatusState = "connecting" | "slow-active" | "retrying";

export type AgentChatDataParts = {
  agentStatus: {
    operationId: string;
    state: AgentChatStatusState;
    message: string;
  };
  assistantSnapshot: {
    operationId: string;
    text: string;
  };
  agentReasoning: {
    operationId: string;
    delta: string;
    state: "start" | "delta" | "end";
  };
  agentDecision: {
    operationId: string;
    payload: AgentChatResponse;
  };
};

export type AgentChatUIMessage = UIMessage<unknown, AgentChatDataParts>;
export type AgentChatUIChunk = InferUIMessageChunk<AgentChatUIMessage>;
