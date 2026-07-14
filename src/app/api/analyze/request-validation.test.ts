import { describe, expect, it } from "vitest";
import { formatValidationErrors, getAgentRequestSource, getPresentationBriefSource, isResumeWorkflowRequest, validatePresentationWorkflowRequest } from "./request-validation";

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


  it("normalizes nested natural-language agent requests into presentation input", () => {
    expect(getAgentRequestSource({ agentRequest: { message: "Build a launch deck" } })).toEqual({ message: "Build a launch deck" });

    const result = validatePresentationWorkflowRequest({ agentRequest: { message: "Build a launch deck" } });

    expect(result).toMatchObject({ success: true, action: "start" });
    if (result.success && result.action === "start") {
      expect(result.data).toMatchObject({
        topic: "Build a launch deck",
        audience: "General business audience",
        pageCount: 6,
        style: "Polished modern presentation",
        requirements: "Build a launch deck",
      });
    }
  });

  it("preserves explicit context when normalizing top-level agent messages", () => {
    const result = validatePresentationWorkflowRequest({
      message: "Make it investor-ready",
      context: {
        topic: "Series A fundraising",
        audience: "Investors",
        pageCount: 8,
        style: "Minimal",
        requirements: "Include traction",
      },
    });

    expect(result).toMatchObject({ success: true, action: "start" });
    if (result.success && result.action === "start") {
      expect(result.data).toMatchObject({
        topic: "Series A fundraising",
        audience: "Investors",
        pageCount: 8,
        style: "Minimal",
        requirements: "Include traction\n\nMake it investor-ready",
      });
    }
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

  it("keeps the 12-slide limit for new decks but accepts a larger structural revision", () => {
    const startResult = validatePresentationWorkflowRequest({ topic: "AI", pageCount: 14 });
    expect(startResult).toMatchObject({ success: false, action: "start" });

    const revisionResult = validatePresentationWorkflowRequest({
      revisionRequest: {
        presentationBrief: { topic: "AI", pageCount: 14 },
        approvedOutline: outline,
        revision: {
          kind: "structure",
          instruction: "新增两页案例",
          requiresOutlineReview: true,
        },
        artifact: {
          operationId: "operation-2",
          deckId: "deck-1",
          baseVersion: 1,
          targetVersion: 2,
        },
      },
    });
    expect(revisionResult).toMatchObject({ success: true, action: "revise" });
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

  it("treats null resume fields from the chat transport as a start request", () => {
    expect(isResumeWorkflowRequest({
      presentationBrief: { topic: "AI" },
      workflowRunId: null,
      approvedOutline: undefined,
    })).toBe(false);

    const result = validatePresentationWorkflowRequest({
      presentationBrief: { topic: "AI", audience: "PMs", pageCount: 4, style: "visual" },
      workflowRunId: null,
      approvedOutline: undefined,
    });

    expect(result).toMatchObject({ success: true, action: "start" });
  });

  it("returns resume validation errors when the run id or outline is missing", () => {
    const result = validatePresentationWorkflowRequest({ workflowRunId: "" });

    expect(result).toMatchObject({ success: false, action: "resume" });
    if (!result.success) {
      expect(formatValidationErrors(result.error).map((field) => field.field)).toEqual(["workflowRunId", "approvedOutline"]);
    }
  });

  it("validates a versioned style revision separately from start and resume", () => {
    const result = validatePresentationWorkflowRequest({
      revisionRequest: {
        presentationBrief: {
          topic: "AI agents",
          audience: "Developers",
          pageCount: 4,
          style: "Modern",
        },
        approvedOutline: outline,
        revision: {
          kind: "style",
          instruction: "Use a professional dark visual system",
          style: "Professional dark",
          requiresOutlineReview: false,
        },
        artifact: {
          operationId: "operation-2",
          deckId: "deck-1",
          baseVersion: 1,
          targetVersion: 2,
        },
      },
    });

    expect(result).toMatchObject({ success: true, action: "revise" });
    if (result.success && result.action === "revise") {
      expect(result.data.artifact.targetVersion).toBe(2);
      expect(result.data.revision.kind).toBe("style");
      expect(result.data.approvedOutline).toEqual(outline);
    }
  });

  it("preserves the selected frontend-slides style contract in generation input", () => {
    const result = validatePresentationWorkflowRequest({
      presentationBrief: {
        topic: "Mastra",
        audience: "TypeScript developers",
        pageCount: 8,
        style: "Terminal Green",
        density: "reading-first",
        purpose: "teaching-tutorial",
        styleSpec: {
          id: "terminal-green",
          name: "Terminal Green",
          source: "frontend-slides-preset",
          vibe: "developer focused",
          layout: "terminal",
          typography: { display: "JetBrains Mono", body: "JetBrains Mono" },
          palette: { background: "#0d1117", surface: "#161b22", text: "#e6edf3", accent: "#39d353", secondary: "#58a6ff" },
          signatureElements: ["scan lines", "blinking cursor"],
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success && result.action === "start") {
      expect(result.data.styleSpec?.id).toBe("terminal-green");
      expect(result.data.density).toBe("reading-first");
    }
  });

  it("rejects revision versions that do not advance the base version by one", () => {
    const result = validatePresentationWorkflowRequest({
      revisionRequest: {
        presentationBrief: { topic: "AI agents", pageCount: 4 },
        approvedOutline: outline,
        revision: {
          kind: "palette",
          instruction: "Use a different palette",
          requiresOutlineReview: false,
        },
        artifact: {
          operationId: "operation-3",
          deckId: "deck-1",
          baseVersion: 1,
          targetVersion: 3,
        },
      },
    });

    expect(result).toMatchObject({ success: false, action: "revise" });
    if (!result.success) {
      expect(formatValidationErrors(result.error)).toContainEqual({
        field: "artifact.targetVersion",
        message: "Target version must advance the base version by one",
      });
    }
  });
});
