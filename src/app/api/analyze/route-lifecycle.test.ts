import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { UIMessageChunk } from "ai";

const mocks = vi.hoisted(() => ({ start: vi.fn(), resume: vi.fn(), cancel: vi.fn(), createRun: vi.fn() }));
vi.mock("@/src/mastra", () => ({ mastra: { getWorkflow: () => ({ createRunAsync: mocks.createRun }) } }));
// Mock only the model/workflow adapter; exercise real request validation and AI SDK SSE serialization.
vi.mock("@mastra/ai-sdk", () => ({ toAISdkFormat: (stream: ReadableStream<UIMessageChunk>) => stream }));
const { POST } = await import("./route");
const outline = { title: "Demo", narrativeGoal: "Teach", sections: ["Introduction"], designGuidance: [],
  slides: [{ pageNumber: 1, title: "Demo", purpose: "Teach", keyPoints: ["One"], designSuggestion: "Grid" }] };
const bodies = {
  start: { presentationBrief: { topic: "Systems", pageCount: 6 } },
  resume: { workflowRunId: "run-test", approvedOutline: outline },
  revise: { revisionRequest: { presentationBrief: { topic: "Systems", pageCount: 6 }, approvedOutline: outline,
    revision: { kind: "structure", instruction: "Add a case study", requiresOutlineReview: true },
    artifact: { operationId: "lifecycle-op", deckId: "lifecycle-deck", baseVersion: 0, targetVersion: 1 } } },
};
const run = { runId: "run-test", stream: mocks.start, resumeStream: mocks.resume, cancel: mocks.cancel };
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
const closed = () => ({ fullStream: new ReadableStream<UIMessageChunk>({ start(c) { c.close(); } }) });
function request(body: unknown, signal = new AbortController().signal) {
  return new NextRequest("http://localhost/api/analyze", { method: "POST", signal,
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("VERCEL", "0");
  mocks.start.mockImplementation(closed); mocks.resume.mockImplementation(closed);
  mocks.cancel.mockResolvedValue(undefined); mocks.createRun.mockResolvedValue(run);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("analyze response lifecycle", () => {
  for (const action of ["start", "resume", "revise"] as const) {
    it(`${action}: never starts execution for an already-aborted request`, async () => {
      const abort = new AbortController(); abort.abort();
      const response = await POST(request(bodies[action], abort.signal));
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("cancelled"); await tick();
      expect(mocks.start).not.toHaveBeenCalled(); expect(mocks.resume).not.toHaveBeenCalled();
      expect(mocks.cancel).toHaveBeenCalledTimes(1);
    });
    it(`${action}: EOF does not leave a listener that cancels a completed or suspended run`, async () => {
      const abort = new AbortController(); const response = await POST(request(bodies[action], abort.signal));
      expect(response.status).toBe(200); await response.text(); abort.abort(); await tick();
      expect(mocks.cancel).not.toHaveBeenCalled();
    });
  }
  it("does not start execution when aborted during asynchronous run allocation", async () => {
    let resolveRun!: (value: typeof run) => void;
    let notifyCreated!: () => void;
    const created = new Promise<void>((resolve) => { notifyCreated = resolve; });
    mocks.createRun.mockImplementationOnce(() => new Promise<typeof run>((resolve) => { resolveRun = resolve; notifyCreated(); }));
    const abort = new AbortController(); const pending = POST(request(bodies.start, abort.signal));
    await created; abort.abort(); resolveRun(run); await (await pending).text(); await tick();
    expect(mocks.start).not.toHaveBeenCalled(); expect(mocks.cancel).toHaveBeenCalledTimes(1);
  });
  it("includes run allocation in the Vercel request budget", async () => {
    vi.stubEnv("VERCEL", "1"); let now = 1000; vi.spyOn(Date, "now").mockImplementation(() => now);
    mocks.createRun.mockImplementationOnce(async () => { now += 300_000; return run; });
    const response = await POST(request(bodies.start));
    expect(await response.text()).toContain("time limit");
    expect(mocks.start).not.toHaveBeenCalled(); expect(mocks.cancel).toHaveBeenCalledTimes(1);
  });
  it("cancels the workflow when the response consumer disconnects", async () => {
    mocks.start.mockReturnValue({ fullStream: new ReadableStream<UIMessageChunk>() });
    const response = await POST(request(bodies.start));
    await response.body!.cancel("consumer disconnected"); await tick();
    expect(mocks.cancel).toHaveBeenCalledTimes(1);
  });
  it("serializes run IDs and progress through the real AI SDK SSE protocol", async () => {
    mocks.start.mockReturnValue({ fullStream: new ReadableStream<UIMessageChunk>({ start(c) {
      c.enqueue({ type: "data-presentationHtml", data: { status: "completed", html: "<html>deck</html>" } }); c.close();
    } }) });
    const response = await POST(request(bodies.start)); const body = await response.text();
    expect(response.headers.get("x-vercel-ai-ui-message-stream")).toBe("v1");
    expect(body).toContain('data: {"type":"data-workflowRunId","data":"run-test"}');
    expect(body).toContain('"type":"data-presentationHtml"'); expect(body).toContain("data: [DONE]");
    expect(body.indexOf("data-workflowRunId")).toBeLessThan(body.indexOf("data-presentationHtml"));
  });
  it("sends a safe terminal SSE error when source setup fails", async () => {
    mocks.start.mockImplementationOnce(() => { throw new Error("provider private credential details"); });
    const response = await POST(request(bodies.start)); const body = await response.text();
    expect(body).toContain('"type":"error"'); expect(body).toContain("data: [DONE]");
    expect(body).not.toContain("private credential details"); expect(mocks.cancel).toHaveBeenCalledTimes(1);
  });
});
