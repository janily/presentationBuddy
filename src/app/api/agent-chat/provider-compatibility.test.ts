import { afterEach, describe, expect, it, vi } from "vitest";
import { Agent } from "@mastra/core";
import type { LanguageModel } from "ai";
import { POST } from "./route";

type LanguageModelV2 = Extract<LanguageModel, { specificationVersion: "v2" }>;

const { getAgent } = vi.hoisted(() => ({ getAgent: vi.fn() }));
vi.mock("@/src/mastra", () => ({ mastra: { getAgent } }));

const decision = {
  reply: "你想做什么主题的演示？",
  readyToGenerate: false,
  nextAction: "chat",
  revision: null,
  styleId: null,
  brief: null,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("compatible provider conversation", () => {
  it("delivers the reply before the model finishes the structured decision", async () => {
    vi.stubEnv("PRESENTATION_BRIEF_PROVIDER", "grsaiapi");
    let upstream!: ReadableStreamDefaultController;
    const doStream = vi.fn<LanguageModelV2["doStream"]>().mockResolvedValue({
      stream: new ReadableStream({ start(controller) { upstream = controller; } }),
    });
    const doGenerate = vi.fn<LanguageModelV2["doGenerate"]>();
    const model: LanguageModelV2 = { specificationVersion: "v2", provider: "test", modelId: "test-model", supportedUrls: {}, doStream, doGenerate };
    getAgent.mockReturnValue(new Agent({ name: "test-conversation", instructions: "Help plan presentations.", model }));

    const response = await POST(new Request("http://localhost/api/agent-chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "你好" }] }),
    }));
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const replyPrefix = JSON.stringify({ reply: decision.reply }).slice(0, -1);
    let received = "";
    const readUntil = async (text: string) => {
      while (!received.includes(text)) {
        const { value, done } = await reader.read();
        if (done) throw new Error(`Stream ended before ${text}`);
        received += decoder.decode(value, { stream: true });
      }
    };

    try {
      await readUntil("data-agentStatus");
      await vi.waitFor(() => expect(doStream).toHaveBeenCalledOnce());
      upstream.enqueue({ type: "text-start", id: "text-1" });
      upstream.enqueue({ type: "text-delta", id: "text-1", delta: replyPrefix });
      await readUntil("text-delta");
      expect(received).toContain(decision.reply);
      expect(received).not.toContain("data-agentDecision");
      expect(received).not.toContain("正在连接模型");
      expect(response.headers.get("X-Accel-Buffering")).toBe("no");
    } finally {
      upstream.enqueue({ type: "text-delta", id: "text-1", delta: JSON.stringify(decision).slice(replyPrefix.length) });
      upstream.enqueue({ type: "text-end", id: "text-1" });
      upstream.enqueue({ type: "finish", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 30, totalTokens: 31 } });
      upstream.close();
      while (!(await reader.read()).done) { /* Drain and release the request timers. */ }
      reader.releaseLock();
    }
    expect(doGenerate).not.toHaveBeenCalled();
  });

  it.each([
    { label: "empty", streamText: "", validFallback: true },
    { label: "non-JSON", streamText: "Hello!", validFallback: true },
    { label: "invalid fallback", streamText: "", validFallback: false },
  ])("handles $label output with a validated non-streaming retry", async ({ streamText, validFallback }) => {
    vi.stubEnv("MODEL_PROVIDER", "grsaiapi");
    vi.stubEnv("PRESENTATION_BRIEF_PROVIDER", "grsaiapi");
    const doStream = vi.fn<LanguageModelV2["doStream"]>().mockResolvedValue({
      stream: new ReadableStream({
        start(controller) {
          if (streamText) {
            controller.enqueue({ type: "text-start", id: "text-1" });
            controller.enqueue({ type: "text-delta", id: "text-1", delta: streamText });
            controller.enqueue({ type: "text-end", id: "text-1" });
          }
          controller.enqueue({ type: "finish", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 0, totalTokens: 1 } });
          controller.close();
        },
      }),
    });
    const doGenerate = vi.fn<LanguageModelV2["doGenerate"]>().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(validFallback ? decision : { readyToGenerate: true }) }],
      finishReason: "stop",
      usage: { inputTokens: 1, outputTokens: 20, totalTokens: 21 },
      warnings: [],
    });
    const model: LanguageModelV2 = { specificationVersion: "v2", provider: "test", modelId: "test-model", supportedUrls: {}, doStream, doGenerate };
    getAgent.mockReturnValue(new Agent({ name: "test-conversation", instructions: "Help plan presentations.", model }));

    const response = await POST(new Request("http://localhost/api/agent-chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "你好" }] }),
    }));
    const body = await response.text();

    if (validFallback) {
      expect(body).toContain(decision.reply);
      expect(body).toContain('"nextAction":"chat"');
      expect(body).not.toContain('"type":"error"');
    } else {
      expect(body).toContain('"type":"error"');
      expect(body).not.toContain('"type":"data-agentDecision"');
    }
    expect(doGenerate).toHaveBeenCalledTimes(1);
    expect(doStream.mock.calls[0][0].responseFormat).toBeUndefined();
    expect(doGenerate.mock.calls[0][0].responseFormat).toBeUndefined();
    expect(doGenerate.mock.calls[0][0].prompt.some((message) => message.role === "system" && message.content.includes("readyToGenerate"))).toBe(true);
  });
});
