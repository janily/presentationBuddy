import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MyUIMessage } from "../types/presentation-workflow";
const state = vi.hoisted(() => ({ messages: [] as unknown[] }));
vi.mock("@ai-sdk/react", () => ({ useChat: () => ({
  messages: state.messages, sendMessage: vi.fn(), setMessages: vi.fn(), status: "ready", error: undefined,
  clearError: vi.fn(), stop: vi.fn(),
}) }));
const { usePresentationWorkflow } = await import("./use-presentation-workflow");
function Probe() {
  return createElement("script", { type: "application/json" }, JSON.stringify(usePresentationWorkflow()));
}
function render(messages: unknown[]) {
  state.messages = messages as MyUIMessage[];
  const markup = renderToStaticMarkup(createElement(Probe));
  return JSON.parse(markup.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "")) as ReturnType<typeof usePresentationWorkflow>;
}
beforeEach(() => { state.messages = []; });

describe("workflow event selection", () => {
  it("uses a newer run announcement instead of a previous run payload", () => {
    const value = render([
      { id: "old", role: "assistant", parts: [
        { type: "data-workflow", data: { runId: "old-run" } },
        { type: "data-presentationHtml", data: { status: "completed", html: "old deck" } },
      ] },
      { id: "new", role: "assistant", parts: [{ type: "data-workflowRunId", data: "new-run" }] },
    ]);
    expect(value.activeRunId).toBe("new-run");
    expect(value.htmlGenerationStep).toBeUndefined();
  });

  it("finds the suspended outline independently of step insertion order", () => {
    const outline = { title: "Approved", slides: [] };
    const value = render([{ id: "one", role: "assistant", parts: [{ type: "data-workflow", data: {
      runId: "current", steps: {
        "presentation-outline-suggestion-step": { suspendPayload: { suggestedOutline: outline, reason: "Review" } },
        "presentation-html-generation-step": { status: "pending" },
      },
    } }] }]);
    expect(value.suspenseData?.outline).toEqual(outline);
  });

  it("retains the latest current-run outline and HTML data", () => {
    const value = render([{ id: "one", role: "assistant", parts: [
      { type: "data-workflowRunId", data: "run-1" },
      { type: "data-presentationOutline", data: { status: "completed", outline: { title: "Current" } } },
      { type: "data-presentationHtml", data: { status: "in-progress", progress: 50 } },
      { type: "data-workflow", data: { data: { runId: "run-1" } } },
    ] }]);
    expect(value.activeRunId).toBe("run-1");
    expect(value.outlineStep?.data.outline?.title).toBe("Current");
    expect(value.htmlGenerationStep?.data.progress).toBe(50);
  });

  it("does not treat user-supplied workflow parts as server state", () => {
    const value = render([{ id: "user", role: "user", parts: [{ type: "data-workflowRunId", data: "fake" }] }]);
    expect(value.activeRunId).toBeNull();
  });
});
