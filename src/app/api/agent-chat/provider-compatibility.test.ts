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
