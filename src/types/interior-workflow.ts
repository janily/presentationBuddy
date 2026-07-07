import { WorkflowDataPart } from "@mastra/ai-sdk";
import { UIMessage } from "ai";

export type SuggestionStepData = {
  status: "loading" | "streaming" | "completed";
  changes?: string[];
};

export type ImprovementStepData = {
  status: "in-progess" | "completed";
  url: string;
};

export type GeneratedPresentationStepData = {
  status: "in-progess" | "completed";
  url: string;
};

export type MyUIMessage = UIMessage<
  unknown,
  {
    userInitialImage: string;
    approvedChanges?: string[];
    workflowRunId?: string;
    workflow: WorkflowDataPart;
    improvementSuggestions: SuggestionStepData;
    improvedInterior: ImprovementStepData;
    generatedPresentation: GeneratedPresentationStepData;
    suggestions: SuggestionStepData;
  }
>;
