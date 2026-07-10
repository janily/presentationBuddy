import { describe, expect, it } from "vitest";
import type { AgentChatResponse, AgentChatUIChunk } from "@/src/types/agent-chat";
import { dispatchAgentChatUIChunk, type AgentChatStreamCallbacks } from "./agent-chat-ui-stream";

function createCallbacks() {
  const state = {
    progress: [] as string[],
    text: "",
    decision: null as AgentChatResponse | null,
  };
  const callbacks: AgentChatStreamCallbacks = {
    signal: new AbortController().signal,
    onProgress: (message) => state.progress.push(message),
    onAssistantDelta: (delta) => { state.text += delta; },
    onAssistantSnapshot: (text) => { state.text = text; },
    onDecision: (payload) => { state.decision = payload; },
  };

  return { callbacks, state };
}

describe("agent chat UI stream", () => {
  it("dispatches standard text and typed data chunks", () => {
    const { callbacks, state } = createCallbacks();
    const decision = { reply: "完成", readyToGenerate: false, brief: null };
    const chunks: AgentChatUIChunk[] = [
      { type: "data-agentStatus", data: { operationId: "op-1", message: "正在理解" } },
      { type: "text-start", id: "text-1" },
      { type: "text-delta", id: "text-1", delta: "正在" },
      { type: "data-assistantSnapshot", data: { operationId: "op-1", text: "完成" } },
      { type: "data-agentDecision", data: { operationId: "op-1", payload: decision } },
      { type: "text-end", id: "text-1" },
    ];

    let result: AgentChatResponse | undefined;
    for (const chunk of chunks) {
      result = dispatchAgentChatUIChunk(chunk, callbacks).result ?? result;
    }

    expect(state.progress).toEqual(["正在理解"]);
    expect(state.text).toBe("完成");
    expect(state.decision).toEqual(decision);
    expect(result).toEqual(decision);
  });

  it("surfaces UI stream errors", () => {
    const { callbacks } = createCallbacks();

    expect(dispatchAgentChatUIChunk({ type: "error", errorText: "provider failed" }, callbacks)).toEqual({
      error: "provider failed",
    });
  });
});
