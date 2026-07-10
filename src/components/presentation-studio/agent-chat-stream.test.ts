import { describe, expect, it } from "vitest";
import {
  applyAssistantTextEvent,
  dispatchAgentChatStreamEvent,
  parseAgentChatStreamLine,
  type AgentChatResponse,
  type AgentChatStreamCallbacks,
} from "./agent-chat-stream";

function createCallbacks() {
  const state = {
    progress: [] as string[],
    text: "",
    decision: null as AgentChatResponse | null,
  };

  const callbacks: AgentChatStreamCallbacks = {
    signal: new AbortController().signal,
    onProgress: (message) => state.progress.push(message),
    onAssistantDelta: (delta) => {
      state.text += delta;
    },
    onAssistantSnapshot: (text) => {
      state.text = text;
    },
    onDecision: (payload) => {
      state.decision = payload;
    },
  };

  return { callbacks, state };
}

describe("agent chat stream helpers", () => {
  it("parses supported NDJSON events and ignores invalid lines", () => {
    expect(parseAgentChatStreamLine("")).toBeNull();
    expect(parseAgentChatStreamLine("not json")).toBeNull();
    expect(parseAgentChatStreamLine('{"type":"assistant-delta","delta":"Hello"}')).toEqual({
      type: "assistant-delta",
      delta: "Hello",
    });
  });

  it("dispatches progress, assistant deltas, snapshots, and decisions", () => {
    const { callbacks, state } = createCallbacks();
    const decision: AgentChatResponse = {
      reply: "Final answer",
      readyToGenerate: false,
      brief: null,
    };

    dispatchAgentChatStreamEvent({ type: "progress", message: "Thinking" }, callbacks);
    dispatchAgentChatStreamEvent({ type: "assistant-delta", delta: "Hel" }, callbacks);
    dispatchAgentChatStreamEvent({ type: "assistant-delta", delta: "lo" }, callbacks);
    dispatchAgentChatStreamEvent({ type: "assistant-snapshot", text: "Corrected" }, callbacks);
    const result = dispatchAgentChatStreamEvent({ type: "decision", payload: decision }, callbacks);

    expect(state.progress).toEqual(["Thinking"]);
    expect(state.text).toBe("Corrected");
    expect(state.decision).toEqual(decision);
    expect(result.result).toEqual(decision);
  });

  it("applies assistant text events with final decision taking precedence", () => {
    let content = "";
    content = applyAssistantTextEvent(content, { type: "assistant-delta", delta: "Starting" });
    content = applyAssistantTextEvent(content, { type: "assistant-snapshot", text: "" });
    content = applyAssistantTextEvent(content, { type: "decision", payload: { reply: "Please confirm first", readyToGenerate: false, brief: null } });

    expect(content).toBe("Please confirm first");
  });
});
