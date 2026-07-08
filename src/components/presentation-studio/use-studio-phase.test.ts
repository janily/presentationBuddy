import { describe, expect, it } from "vitest";
import { deriveStudioPhase } from "./use-studio-phase";

describe("deriveStudioPhase", () => {
  it("uses error as the highest priority phase", () => {
    expect(deriveStudioPhase({
      hasWorkflowError: true,
      workflowErrorSource: "html",
      workflowErrorMessage: "Failed",
      hasGeneratedHtml: true,
      hasSuspenseOutline: true,
      hasOutlineSlides: true,
      htmlGeneration: { status: "completed", html: "<html />" },
    })).toEqual({
      phase: "error",
      errorSource: "html",
      errorMessage: "Failed",
    });
  });

  it("uses previewing after HTML is completed", () => {
    expect(deriveStudioPhase({
      hasWorkflowError: false,
      hasGeneratedHtml: true,
      hasSuspenseOutline: true,
      hasOutlineSlides: true,
      htmlGeneration: { status: "completed", html: "<html />" },
    }).phase).toBe("previewing");
  });

  it("uses generating while HTML is in progress", () => {
    expect(deriveStudioPhase({
      hasWorkflowError: false,
      hasGeneratedHtml: false,
      hasSuspenseOutline: true,
      hasOutlineSlides: true,
      htmlGeneration: { status: "in-progress", progress: 40 },
    }).phase).toBe("generating");
  });

  it("uses reviewing when an outline is waiting for approval", () => {
    expect(deriveStudioPhase({
      hasWorkflowError: false,
      hasGeneratedHtml: false,
      hasSuspenseOutline: true,
      hasOutlineSlides: true,
      workflowStatus: "ready",
    }).phase).toBe("reviewing");
  });

  it("uses outlining while the workflow is submitted or streaming", () => {
    expect(deriveStudioPhase({
      hasWorkflowError: false,
      hasGeneratedHtml: false,
      hasSuspenseOutline: false,
      hasOutlineSlides: false,
      workflowStatus: "streaming",
    }).phase).toBe("outlining");
  });

  it("defaults to briefing", () => {
    expect(deriveStudioPhase({
      hasWorkflowError: false,
      hasGeneratedHtml: false,
      hasSuspenseOutline: false,
      hasOutlineSlides: false,
    }).phase).toBe("briefing");
  });
});
