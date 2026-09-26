import { describe, expect, it, vi } from "vitest";
import { consumeAgentStream } from "./consume-agent-stream";
import type { AgentChatStreamCallbacks } from "./agent-chat-ui-stream";
import type { AgentChatUIChunk } from "@/src/types/agent-chat";
function callbacks(signal = new AbortController().signal): AgentChatStreamCallbacks {
  return { signal, onProgress: vi.fn(), onAssistantDelta: vi.fn(), onReasoningDelta: vi.fn(), onAssistantSnapshot: vi.fn(), onDecision: vi.fn() };
}
const payload = { reply: "Done", readyToGenerate: false, brief: null };

describe("agent stream resource lifecycle", () => {
  it("returns the completed decision and releases the reader", async () => {
    const stream = new ReadableStream<AgentChatUIChunk>({ start(c) {
      c.enqueue({ type: "data-agentDecision", data: { operationId: "one", payload } }); c.close();
    } });
    await expect(consumeAgentStream(stream, callbacks())).resolves.toEqual(payload);
    expect(stream.locked).toBe(false);
  });
  it("fails and cancels immediately on an error chunk, even if the source stays open", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream<AgentChatUIChunk>({ start(c) { c.enqueue({ type: "error", errorText: "provider failed" }); }, cancel });
    await expect(consumeAgentStream(stream, callbacks())).rejects.toThrow("provider failed");
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
  });
  it("cancels an idle reader when the user stops", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const stream = new ReadableStream<AgentChatUIChunk>({ cancel });
    const task = consumeAgentStream(stream, callbacks(controller.signal));
    controller.abort();
    await expect(task).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledOnce();
    expect(stream.locked).toBe(false);
  });
  it("rejects an incomplete response without leaking the reader", async () => {
    const stream = new ReadableStream<AgentChatUIChunk>({ start(c) { c.close(); } });
    await expect(consumeAgentStream(stream, callbacks())).rejects.toThrow("without a result");
    expect(stream.locked).toBe(false);
  });
});

it("does not wait forever for an uncooperative source cancel handler", async () => {
  const stream = new ReadableStream<AgentChatUIChunk>({
    start(c) { c.enqueue({ type: "error", errorText: "failed" }); },
    cancel() { return new Promise(() => undefined); },
  });
  const task = consumeAgentStream(stream, callbacks());
  const state = await Promise.race([
    task.then(() => "resolved", (error: Error) => error.message),
    new Promise((resolve) => setTimeout(() => resolve("hung"), 50)),
  ]);
  expect(state).toBe("failed");
  expect(stream.locked).toBe(false);
});
