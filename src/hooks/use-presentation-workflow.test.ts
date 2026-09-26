import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePresentationWorkflow } from "./use-presentation-workflow";

const { chat } = vi.hoisted(() => ({ chat: {
  messages: [] as unknown[], status: "ready", error: undefined as Error | undefined,
  sendMessage: vi.fn(), setMessages: vi.fn(), clearError: vi.fn(), stop: vi.fn(),
} }));
vi.mock("@ai-sdk/react", () => ({ useChat: () => chat }));

const outline = {
  title: "Review", narrativeGoal: "Share progress", sections: [], designGuidance: [],
  slides: [{ pageNumber: 1, title: "Progress", purpose: "Summarize", keyPoints: ["Shipped"], designSuggestion: "Timeline" }],
};

function inspectWorkflow() {
  let result: ReturnType<typeof usePresentationWorkflow> | undefined;
  function Probe() { result = usePresentationWorkflow(); return null; }
  renderToString(createElement(Probe));
  if (!result) throw new Error("Hook did not render");
  return result;
}

function setWorkflow(suggestedOutline: unknown, workflowStatus = "suspended") {
  chat.messages = [{ id: "m1", role: "assistant", parts: [{ type: "data-workflow", data: {
    runId: "run-1", status: workflowStatus, steps: {
      "presentation-outline-suggestion-step": { status: workflowStatus, suspendPayload: { suggestedOutline } },
      "presentation-html-generation-step": { status: "pending" },
    },
  } }] }];
}

beforeEach(() => { chat.messages = []; chat.status = "ready"; chat.error = undefined; vi.clearAllMocks(); });

describe("outline approval readiness", () => {
  it("does not allow approval just because a run id has arrived", () => {
    chat.messages = [{ role: "assistant", parts: [{ type: "data-workflowRunId", data: "run-1" }] }];
    expect(inspectWorkflow().canApproveOutline).toBe(false);
  });

  it("finds the suspended outline by step id instead of object property order", () => {
    setWorkflow(outline);
    const state = inspectWorkflow();
    expect(state.suspenseData?.outline).toEqual(outline);
    expect(state.canApproveOutline).toBe(true);
  });

  it("rejects partial suspended outlines", () => {
    setWorkflow({ ...outline, slides: [{ title: "Still streaming" }] });
    expect(inspectWorkflow().canApproveOutline).toBe(false);
  });

  it("does not reuse an old suspension during a new request", () => {
    setWorkflow(outline);
    chat.status = "streaming";
    expect(inspectWorkflow().canApproveOutline).toBe(false);
  });

  it("blocks approval after workflow failure", () => {
    setWorkflow(outline, "failed");
    expect(inspectWorkflow().canApproveOutline).toBe(false);
  });
});
