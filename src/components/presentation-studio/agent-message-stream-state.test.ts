import { describe, expect, it } from "vitest";
import type { AgentMessage } from "./agent-message-model";
import { applyReasoningEvent, stopStreamingAssistantMessage } from "./agent-message-stream-state";

const streamingMessage: Extract<AgentMessage, { role: "assistant" | "user" }> = {
  id: "assistant-1",
  role: "assistant",
  kind: "text",
  content: "已经收到一部分回答",
  streamState: "connecting",
  isStreaming: true,
};

describe("assistant message stream state", () => {
  it("shows a reasoning state immediately on reasoning-start without fabricating summary text", () => {
    expect(applyReasoningEvent(streamingMessage, "", "start")).toMatchObject({
      reasoningSummary: "",
      streamState: "reasoning",
      isStreaming: true,
    });
  });

  it("appends provider reasoning deltas and moves to finalizing at reasoning-end", () => {
    const reasoning = applyReasoningEvent(streamingMessage, "核对当前大纲", "delta");
    expect(applyReasoningEvent(reasoning, "", "end")).toMatchObject({
      reasoningSummary: "核对当前大纲",
      streamState: "answering",
    });
  });

  it("preserves partial text and marks the message stopped", () => {
    expect(stopStreamingAssistantMessage(streamingMessage)).toMatchObject({
      content: "已经收到一部分回答",
      streamState: "cancelled",
      isStreaming: false,
    });
  });

  it("uses a clear stopped message when no partial answer exists", () => {
    expect(stopStreamingAssistantMessage({ ...streamingMessage, content: "" })).toMatchObject({
      content: "已停止本次请求。",
      streamState: "cancelled",
      isStreaming: false,
    });
  });
});
