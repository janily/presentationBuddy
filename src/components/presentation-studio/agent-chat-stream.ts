type AgentBriefData = {
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
  frontendSlidesSessionId?: string;
  frontendSlidesRunId?: string;
  done?: boolean;
  html?: string;
  htmlUrl?: string;
  generator?: "frontend-slides" | "backup";
  fallbackReason?: string;
};

export type AgentChatStreamEvent =
  | { type: "progress"; message: string }
  | { type: "assistant-delta"; delta: string }
  | { type: "assistant-snapshot"; text: string }
  | { type: "decision"; payload: AgentChatResponse }
  | { type: "result"; payload: AgentChatResponse }
  | { type: "error"; error: string };

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

export function parseAgentChatStreamLine(line: string): AgentChatStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as AgentChatStreamEvent;
  } catch {
    return null;
  }
}

export function dispatchAgentChatStreamEvent(
  event: AgentChatStreamEvent,
  callbacks: AgentChatStreamCallbacks,
): AgentChatDispatchResult {
  switch (event.type) {
    case "progress":
      callbacks.onProgress(event.message);
      return {};
    case "assistant-delta":
      callbacks.onAssistantDelta(event.delta);
      return {};
    case "assistant-snapshot":
      callbacks.onAssistantSnapshot(event.text);
      return {};
    case "decision":
      callbacks.onDecision(event.payload);
      return { result: event.payload };
    case "result":
      return { result: event.payload };
    case "error":
      return { error: event.error };
    default:
      return {};
  }
}

export function applyAssistantTextEvent(content: string, event: AgentChatStreamEvent) {
  if (event.type === "assistant-delta") return `${content}${event.delta}`;
  if (event.type === "assistant-snapshot") return event.text;
  if (event.type === "decision") return event.payload.reply ?? content;
  return content;
}
