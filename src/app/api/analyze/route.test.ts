import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  start: vi.fn(), resume: vi.fn(), cancel: vi.fn(), createRun: vi.fn(),
}));
vi.mock("@/src/mastra", () => ({ mastra: { getWorkflow: () => ({ createRunAsync: mocks.createRun }) } }));
vi.mock("@mastra/ai-sdk", () => ({ toAISdkFormat: () => new ReadableStream({ start(c) { c.close(); } }) }));
const { POST } = await import("./route");

function request(body: unknown) {
  return new NextRequest("http://localhost/api/analyze", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}
const styleSpec = {
  id: "custom-a", name: "Custom A", source: "frontend-slides-custom", vibe: "calm", layout: "grid",
  typography: { display: "Arial", body: "Arial" },
  palette: { background: "#ffffff", surface: "#eeeeee", text: "#111111", accent: "#ff0000", secondary: "#0000ff" },
  signatureElements: ["grid"],
};
const outline = {
  title: "Demo", narrativeGoal: "Teach", sections: ["Introduction"], designGuidance: [],
  slides: [{ pageNumber: 1, title: "Demo", purpose: "Teach", keyPoints: ["One"], designSuggestion: "Grid" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.start.mockReturnValue({ fullStream: new ReadableStream({ start(c) { c.close(); } }) });
  mocks.resume.mockReturnValue({ fullStream: new ReadableStream({ start(c) { c.close(); } }) });
  mocks.cancel.mockResolvedValue(undefined);
  mocks.createRun.mockResolvedValue({ runId: "run-test", stream: mocks.start, resumeStream: mocks.resume, cancel: mocks.cancel });
});

describe("analyze API boundary", () => {
  it("passes every validated presentation option to the workflow", async () => {
    const presentationBrief = {
      topic: "Systems", audience: "Engineers", pageCount: 6, style: "Custom A", requirements: "Chinese",
      purpose: "teaching-tutorial", density: "reading-first", contentReadiness: "ready", styleSpec,
      autoApproveOutline: true,
      artifact: { operationId: "op-1", deckId: "deck-1", baseVersion: 0, targetVersion: 1 },
    };
    const response = await POST(request({ presentationBrief }));
    await response.text();
    expect(response.status).toBe(200);
    expect(mocks.start.mock.calls[0][0].inputData).toEqual(presentationBrief);
  });

  it("keeps style options when starting from the agent chat context", async () => {
    const response = await POST(request({ agentRequest: {
      message: "Generate this", context: { topic: "Systems", density: "speaker-led", styleSpec },
    } }));
    await response.text();
    expect(mocks.start.mock.calls[0][0].inputData).toMatchObject({ topic: "Systems", density: "speaker-led", styleSpec });
  });

  it("returns 400 instead of 500 for malformed JSON without starting a model", async () => {
    const response = await POST(new NextRequest("http://localhost/api/analyze", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "invalid_json" });
    expect(mocks.createRun).not.toHaveBeenCalled();
  });

  it("still resumes the approved outline rather than starting a new run", async () => {
    const response = await POST(request({ workflowRunId: "old-run", approvedOutline: outline }));
    await response.text();
    expect(mocks.createRun).toHaveBeenCalledWith({ runId: "old-run" });
    expect(mocks.resume).toHaveBeenCalledWith({ step: "presentation-outline-suggestion-step", resumeData: { approvedOutline: outline } });
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
