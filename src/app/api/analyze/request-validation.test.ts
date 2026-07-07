import { describe, expect, it } from "vitest";
import { formatValidationErrors, getPresentationBriefSource, isResumeWorkflowRequest, validatePresentationWorkflowRequest } from "./request-validation";

const outline = {
  title: "Deck",
  narrativeGoal: "Tell a story",
  sections: [],
  slides: [
    {
      pageNumber: 1,
      title: "Intro",
      purpose: "Open",
      keyPoints: ["A"],
      designSuggestion: "Clean",
    },
  ],
  designGuidance: [],
};

describe("analyze request validation", () => {
  it("validates a top-level presentation brief without calling workflow or model code", () => {
    const result = validatePresentationWorkflowRequest({ topic: "AI", audience: "PMs", pageCount: 4, style: "visual" });

    expect(result).toMatchObject({ success: true, action: "start" });
    if (result.success && result.action === "start") {
      expect(result.data.topic).toBe("AI");
    }
  });

  it("validates a nested presentation brief", () => {
    expect(getPresentationBriefSource({ presentationBrief: { topic: "Nested", pageCount: 3 } })).toEqual({ topic: "Nested", pageCount: 3 });

    const result = validatePresentationWorkflowRequest({ presentationBrief: { topic: "Nested", pageCount: 3 } });

    expect(result).toMatchObject({ success: true, action: "start" });
  });

  it("returns field-level errors for invalid start requests", () => {
    const result = validatePresentationWorkflowRequest({ topic: "", pageCount: 2 });

    expect(result).toMatchObject({ success: false, action: "start" });
    if (!result.success) {
      expect(formatValidationErrors(result.error)).toEqual([
        { field: "topic", message: "Topic is required" },
        { field: "pageCount", message: "Page count must be at least 3" },
      ]);
    }
  });

  it("detects and validates resume requests", () => {
    expect(isResumeWorkflowRequest({ workflowRunId: "run-1" })).toBe(true);

    const result = validatePresentationWorkflowRequest({ workflowRunId: " run-1 ", approvedOutline: outline });

    expect(result).toMatchObject({ success: true, action: "resume" });
    if (result.success && result.action === "resume") {
      expect(result.data.workflowRunId).toBe("run-1");
      expect(result.data.approvedOutline.slides).toHaveLength(1);
    }
  });

  it("returns resume validation errors when the run id or outline is missing", () => {
    const result = validatePresentationWorkflowRequest({ workflowRunId: "" });

    expect(result).toMatchObject({ success: false, action: "resume" });
    if (!result.success) {
      expect(formatValidationErrors(result.error).map((field) => field.field)).toEqual(["workflowRunId", "approvedOutline"]);
    }
  });
});
