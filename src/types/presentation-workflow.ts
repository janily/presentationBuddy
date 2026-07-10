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
  artifact?: ArtifactOperation;
};

export type RevisionKind = "style" | "palette" | "content" | "structure" | "mixed";

export type RevisionSpec = {
  kind: RevisionKind;
  instruction: string;
  targetSlides?: number[];
  style?: string;
  palette?: string[];
  requiresOutlineReview: boolean;
};

export type ArtifactOperation = {
  operationId: string;
  deckId: string;
  baseVersion: number;
  targetVersion: number;
};

export type DeckArtifact = {
  deckId: string;
  version: number;
  operationId: string;
  brief: PresentationBriefData;
  approvedOutline: PresentationOutlineData;
  html: string;
  htmlUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentRequestData = {
  message: string;
  context?: Partial<PresentationBriefData>;
};

export type OutlineStepData = {
  status: "loading" | "streaming" | "completed";
  outline?: Partial<PresentationOutlineData>;
  message?: string;
  progress?: number;
  lastUpdatedAt?: number;
  steps?: OutlineProgressStep[];
};

export type OutlineProgressStep = {
  id: "prepare" | "analyze" | "structure" | "detail" | "review";
  label: string;
  status: "pending" | "active" | "completed";
  detail?: string;
};

export type HtmlGenerationStepData = {
  status: "in-progress" | "completed";
  phase?: "structure" | "html" | "styles" | "bundle";
  message?: string;
  progress?: number;
  generator?: "frontend-slides" | "backup";
  fallbackReason?: string;
  generatedCharacters?: number;
  lastUpdatedAt?: number;
  steps?: HtmlGenerationProgressStep[];
  htmlUrl?: string;
  html?: string;
  artifact?: {
    operationId: string;
    deckId: string;
    version: number;
  };
};

export type PresentationRevisionRequestData = {
  presentationBrief: PresentationBriefData;
  approvedOutline: PresentationOutlineData;
  revision: RevisionSpec;
  artifact: ArtifactOperation;
};

export type HtmlGenerationProgressStep = {
  id: "prepare" | "load-skill" | "compose" | "validate" | "fallback" | "save";
  label: string;
  status: "pending" | "active" | "completed";
  detail?: string;
};

export type MyUIMessage = UIMessage<
  unknown,
  {
    presentationBrief: PresentationBriefData;
    agentRequest: AgentRequestData;
    approvedOutline?: PresentationOutlineData;
    workflowRunId?: string;
    workflow: WorkflowDataPart;
    presentationOutline: OutlineStepData;
    presentationHtml: HtmlGenerationStepData;
    presentationRevision: PresentationRevisionRequestData;
    outlineSuggestions: OutlineStepData;
    generatedPresentation: HtmlGenerationStepData;
  }
>;
