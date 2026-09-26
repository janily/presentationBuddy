import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { getFrontendSlideStyle } from "@/src/services/frontend-slides/style-catalog";

const { startRun, createRun, getWorkflow } = vi.hoisted(() => ({ startRun: vi.fn(), createRun: vi.fn(), getWorkflow: vi.fn() }));
vi.mock("@/src/mastra", () => ({ mastra: { getWorkflow } }));
vi.mock("@mastra/ai-sdk", () => ({ toAISdkFormat: (stream: ReadableStream) => stream }));

beforeEach(() => {
  vi.clearAllMocks();
  getWorkflow.mockReturnValue({ createRunAsync: createRun });
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

describe('source ownership at the generation boundary', () => {
  it('discards caller-provided source context', async () => {
    const response = await POST(new NextRequest('http://localhost/api/analyze', {
      method: 'POST', body: JSON.stringify({ presentationBrief: { topic: 'Test', pageCount: 3, sourceContext: 'unverified source text' } }),
    }));
    await response.text();
    expect(startRun.mock.calls[0][0].inputData.sourceContext).toBeUndefined();
  });
  it('rejects unknown material references before starting a workflow', async () => {
    const response = await POST(new NextRequest('http://localhost/api/analyze', {
      method: 'POST', body: JSON.stringify({ presentationBrief: { topic: 'Test', pageCount: 3, sourceIds: [crypto.randomUUID()] } }),
    }));
    expect(response.status).toBe(400);
    expect(startRun).not.toHaveBeenCalled();
  });
});


it("requires a new outline review when a revision adds source materials", async () => {
  const { mkdtemp, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createMaterial, updateMaterial } = await import("@/src/services/materials/store");
  const { materialOwner } = await import("@/src/services/materials/http");
  const dir = await mkdtemp(join(tmpdir(), "material-revision-"));
  const previous = process.env.MATERIALS_DIR;
  process.env.MATERIALS_DIR = dir;
  try {
    const cookie = `pb-material-session=${"a".repeat(64)}`;
    const owner = materialOwner(new Request("http://localhost", { headers: { cookie } }));
    const material = await createMaterial(owner, crypto.randomUUID(), "facts.md", Buffer.from("Income 120"));
    await updateMaterial(material.id, { analysis: { summary: "Income 120", facts: ["Income 120"], sections: [], tables: [], uncertainties: [], imageDescription: "" } });
    const response = await POST(new NextRequest("http://localhost/api/analyze", {
      method: "POST", headers: { cookie }, body: JSON.stringify({ revisionRequest: {
        presentationBrief: { topic: "Review", pageCount: 3, sourceIds: [material.id] },
        approvedOutline: { title: "Review", narrativeGoal: "Review", sections: [], designGuidance: [], slides: Array.from({ length: 3 }, (_, i) => ({ pageNumber: i + 1, title: "Title", purpose: "Purpose", keyPoints: ["Old facts"], designSuggestion: "Simple" })) },
        revision: { kind: "content", instruction: "Use uploaded income data", requiresOutlineReview: false },
        artifact: { deckId: crypto.randomUUID(), operationId: "revision", baseVersion: 0, targetVersion: 1 },
      } }),
    }));
    await response.text();
    expect(response.status).toBe(200);
    expect(getWorkflow).toHaveBeenCalledWith("presentationGenerationWorkflow");
    expect(startRun.mock.calls[0][0].inputData).toMatchObject({ autoApproveOutline: false, sourceIds: [material.id] });
    expect(startRun.mock.calls[0][0].inputData.sourceContext).toContain("Income 120");
  } finally {
    if (previous === undefined) delete process.env.MATERIALS_DIR; else process.env.MATERIALS_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
