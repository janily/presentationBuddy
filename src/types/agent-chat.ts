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
  | "generate";

export type AgentRevisionData = {
  instruction: string;
  targetSlides?: number[];
  requiresOutlineReview: boolean;
};

export type AgentChatResponse = {
  reply?: string;
  readyToGenerate?: boolean;
  brief?: AgentBriefData | null;
  nextAction?: AgentChatAction;
  revision?: AgentRevisionData | null;
  styleId?: string | null;
  error?: string;
};

export type AgentChatDataParts = {
  agentStatus: {
    operationId: string;
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
