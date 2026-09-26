import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { getFrontendSlideStyle } from "@/src/services/frontend-slides/style-catalog";

const { startRun, createRun } = vi.hoisted(() => ({ startRun: vi.fn(), createRun: vi.fn() }));
vi.mock("@/src/mastra", () => ({ mastra: { getWorkflow: () => ({ createRunAsync: createRun }) } }));
vi.mock("@mastra/ai-sdk", () => ({ toAISdkFormat: (stream: ReadableStream) => stream }));

beforeEach(() => {
  vi.clearAllMocks();
  createRun.mockResolvedValue({ runId: "test-run", stream: startRun, cancel: vi.fn() });
  startRun.mockImplementation(() => ({ fullStream: new ReadableStream({ start(controller) { controller.close(); } }) }));
});

describe("start presentation workflow", () => {
  it.each(["presentationBrief", "agentRequest"])("preserves confirmed design choices from %s through the HTTP boundary", async (kind) => {
    const brief = {
      topic: "Quarterly review", audience: "Product team", pageCount: 3,
      style: "Notebook Tabs", purpose: "internal-presentation", density: "reading-first",
      contentReadiness: "ready", styleSpec: getFrontendSlideStyle("notebook-tabs"),
      artifact: { operationId: "op-1", deckId: "deck-1", baseVersion: 0, targetVersion: 1 },
    };
    const body = kind === "presentationBrief"
      ? { presentationBrief: brief }
      : { agentRequest: { message: "Prepare the confirmed outline", context: brief } };
    const response = await POST(new NextRequest("http://localhost/api/analyze", {
      method: "POST", body: JSON.stringify(body),
    }));
    await response.text();

    expect(response.status).toBe(200);
    expect(startRun).toHaveBeenCalledWith({ inputData: expect.objectContaining(brief) });
  });
});
