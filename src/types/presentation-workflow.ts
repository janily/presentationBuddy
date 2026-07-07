import { WorkflowDataPart } from "@mastra/ai-sdk";
import { UIMessage } from "ai";

export type PresentationBriefData = {
  topic: string;
  audience: string;
  pageCount: number;
  style: string;
  requirements?: string;
};

export type OutlineStepData = {
  status: "loading" | "streaming" | "completed";
  outline?: string[];
};

export type HtmlGenerationStepData = {
  status: "in-progress" | "completed";
  htmlUrl?: string;
  html?: string;
};

export type MyUIMessage = UIMessage<
  unknown,
  {
    presentationBrief: PresentationBriefData;
    approvedOutline?: string[];
    workflowRunId?: string;
    workflow: WorkflowDataPart;
    outlineSuggestions: OutlineStepData;
    generatedPresentation: HtmlGenerationStepData;
  }
>;
