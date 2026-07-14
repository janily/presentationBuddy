import { describe, expect, it } from "vitest";
import { getWorkflowFailureInfo } from "./workflow-failure";

describe("workflow failure detection", () => {
  it("detects a failed Mastra workflow and its failed step", () => {
    expect(getWorkflowFailureInfo({
      name: "presentation-outline-revision-workflow",
      status: "failed",
      steps: {
        "presentation-outline-suggestion-step": { status: "failed" },
      },
    })).toEqual({
      workflowName: "presentation-outline-revision-workflow",
      stepId: "presentation-outline-suggestion-step",
    });
  });

  it("supports the nested payload shape and ignores running workflows", () => {
    expect(getWorkflowFailureInfo({
      data: {
        name: "presentation-revision-workflow",
        status: "failed",
        steps: { "presentation-html-generation-step": { status: "failed" } },
      },
    })?.stepId).toBe("presentation-html-generation-step");
    expect(getWorkflowFailureInfo({ status: "running", steps: {} })).toBeNull();
  });
});
