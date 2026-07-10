import type { InferUIMessageChunk, UIMessage } from "ai";

export type AgentBriefData = {
  topic: string;
  audience: string;
  pageCount: number;
  style: string;
  requirements?: string;
};

export type AgentChatResponse = {
  reply?: string;
  readyToGenerate?: boolean;
  brief?: AgentBriefData | null;
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
  agentDecision: {
    operationId: string;
    payload: AgentChatResponse;
  };
};

export type AgentChatUIMessage = UIMessage<unknown, AgentChatDataParts>;
export type AgentChatUIChunk = InferUIMessageChunk<AgentChatUIMessage>;
