import type { AgentMessage } from "./agent-message-model";

type TextMessage = Extract<AgentMessage, { role: "assistant" | "user" }>;

export function applyReasoningEvent(
  message: TextMessage,
  delta: string,
  state: "start" | "delta" | "end",
): TextMessage {
  const reasoningSummary = state === "start"
    ? ""
    : `${message.reasoningSummary ?? ""}${delta}`;

  return {
    ...message,
    reasoningSummary,
    streamState: state === "end"
      ? (message.content ? "answering" : "finalizing")
      : "reasoning",
    isStreaming: true,
  };
}

export function stopStreamingAssistantMessage(message: TextMessage): TextMessage {
  if (message.role !== "assistant" || !message.isStreaming) return message;

  return {
    ...message,
    content: message.content || "已停止本次请求。",
    streamState: "cancelled",
    isStreaming: false,
  };
}
