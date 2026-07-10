import type { AgentChatResponse, AgentChatUIChunk } from "@/src/types/agent-chat";

export type AgentChatStreamCallbacks = {
  signal: AbortSignal;
  onProgress: (message: string) => void;
  onAssistantDelta: (delta: string) => void;
  onAssistantSnapshot: (text: string) => void;
  onDecision: (payload: AgentChatResponse) => void;
};

export type AgentChatDispatchResult = {
  result?: AgentChatResponse;
  error?: string;
};

export function dispatchAgentChatUIChunk(
  chunk: AgentChatUIChunk,
  callbacks: AgentChatStreamCallbacks,
): AgentChatDispatchResult {
  switch (chunk.type) {
    case "text-delta":
      callbacks.onAssistantDelta(chunk.delta);
      return {};
    case "data-agentStatus":
      callbacks.onProgress(chunk.data.message);
      return {};
    case "data-assistantSnapshot":
      callbacks.onAssistantSnapshot(chunk.data.text);
      return {};
    case "data-agentDecision":
      callbacks.onDecision(chunk.data.payload);
      return { result: chunk.data.payload };
    case "error":
      return { error: chunk.errorText };
    default:
      return {};
  }
}
