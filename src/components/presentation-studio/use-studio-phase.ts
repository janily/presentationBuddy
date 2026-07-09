import type { HtmlGenerationStepData } from "@/src/types/presentation-workflow";

export type StudioPhase =
  | "briefing"
  | "outlining"
  | "reviewing"
  | "generating"
  | "previewing"
  | "error";

export type StudioErrorSource = "outline" | "html" | "resume";

export interface StudioPhaseState {
  phase: StudioPhase;
  errorSource?: StudioErrorSource;
  errorMessage?: string;
}

export interface StudioPhaseInput {
  hasWorkflowError: boolean;
  workflowErrorSource?: StudioErrorSource;
  workflowErrorMessage?: string;
  hasGeneratedHtml: boolean;
  htmlGeneration?: HtmlGenerationStepData;
  hasSuspenseOutline: boolean;
  hasOutlineSlides: boolean;
  workflowStatus?: string;
}

export function deriveStudioPhase(input: StudioPhaseInput): StudioPhaseState {
  if (input.hasWorkflowError) {
    return {
      phase: "error",
      errorSource: input.workflowErrorSource,
      errorMessage: input.workflowErrorMessage,
    };
  }

  if (input.htmlGeneration?.status === "completed" && input.hasGeneratedHtml) {
    return { phase: "previewing" };
  }

  if (input.htmlGeneration?.status === "in-progress") {
    return { phase: "generating" };
  }

  if ((input.hasSuspenseOutline && input.hasOutlineSlides) || (input.hasOutlineSlides && input.workflowStatus !== "submitted" && input.workflowStatus !== "streaming")) {
    return { phase: "reviewing" };
  }

  if (input.workflowStatus === "submitted" || input.workflowStatus === "streaming" || input.hasOutlineSlides) {
    return { phase: "outlining" };
  }

  return { phase: "briefing" };
}

export function getPhaseLabel(phase: StudioPhase) {
  switch (phase) {
    case "briefing":
      return "准备中";
    case "outlining":
      return "起草大纲";
    case "reviewing":
      return "确认大纲";
    case "generating":
      return "生成中";
    case "previewing":
      return "预览就绪";
    case "error":
      return "需要处理";
  }
}
