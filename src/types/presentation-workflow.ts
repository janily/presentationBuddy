import { WorkflowDataPart } from "@mastra/ai-sdk";
import { UIMessage } from "ai";

export type SlideOutlineData = {
  pageNumber: number;
  title: string;
  purpose: string;
  keyPoints: string[];
  designSuggestion: string;
};

export type PresentationOutlineData = {
  title: string;
  narrativeGoal: string;
  sections: string[];
  slides: SlideOutlineData[];
  designGuidance: string[];
};

export type PresentationBriefData = {
  topic: string;
  audience: string;
  pageCount: number;
  style: string;
  requirements?: string;
};

export type OutlineStepData = {
  status: "loading" | "streaming" | "completed";
  outline?: Partial<PresentationOutlineData>;
};

export type HtmlGenerationStepData = {
  status: "in-progress" | "completed";
  phase?: "structure" | "html" | "styles" | "bundle";
  message?: string;
  progress?: number;
  generatedCharacters?: number;
  htmlUrl?: string;
  html?: string;
};

export type MyUIMessage = UIMessage<
  unknown,
  {
    presentationBrief: PresentationBriefData;
    approvedOutline?: PresentationOutlineData;
    workflowRunId?: string;
    workflow: WorkflowDataPart;
    presentationOutline: OutlineStepData;
    presentationHtml: HtmlGenerationStepData;
    outlineSuggestions: OutlineStepData;
    generatedPresentation: HtmlGenerationStepData;
  }
>;
