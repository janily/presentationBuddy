import {
  presentationRevisionRequestSchema,
  presentationInputSchema,
  presentationStartInputSchema,
  presentationOutlineSchema,
} from "@/src/mastra/workflows/presentation-generation-schemas";
import z from "zod";

export const resumeWorkflowRequestSchema = z.object({
  workflowRunId: z.string().trim().min(1, "Workflow run ID is required"),
  approvedOutline: presentationOutlineSchema,
});

const defaultAgentRequestPresentationInput = {
  audience: "General business audience",
  pageCount: 6,
  style: "Polished modern presentation",
};

export const agentRequestSchema = z.object({
  message: z.string().trim().min(1, "Message is required"),
  context: presentationInputSchema.partial().optional(),
});

function normalizeAgentRequestToPresentationInput(request: z.infer<typeof agentRequestSchema>) {
  const context = request.context ?? {};

  return {
    ...defaultAgentRequestPresentationInput,
    ...context,
    topic: context.topic?.trim() || request.message,
    requirements: [context.requirements, request.message].filter(Boolean).join("\n\n"),
  };
}

export type WorkflowRequestAction = "start" | "resume" | "revise";

function hasNonNullProperty(body: Record<string, unknown>, property: "workflowRunId" | "approvedOutline") {
  return property in body && body[property] !== null && body[property] !== undefined;
}

export function isResumeWorkflowRequest(body: unknown) {
  if (typeof body !== "object" || body === null) {
    return false;
  }

  const request = body as Record<string, unknown>;

  return hasNonNullProperty(request, "workflowRunId") || hasNonNullProperty(request, "approvedOutline");
}

export function isRevisionWorkflowRequest(body: unknown) {
  return typeof body === "object"
    && body !== null
    && "revisionRequest" in body;
}

export function getPresentationBriefSource(body: unknown) {
  if (typeof body === "object" && body !== null && "presentationBrief" in body) {
    return (body as { presentationBrief?: unknown }).presentationBrief;
  }

  return body;
}

export function getAgentRequestSource(body: unknown) {
  if (typeof body === "object" && body !== null && "agentRequest" in body) {
    return (body as { agentRequest?: unknown }).agentRequest;
  }

  if (typeof body === "object" && body !== null && "message" in body) {
    return body;
  }

  return null;
}

export function validatePresentationWorkflowRequest(body: unknown) {
  if (isRevisionWorkflowRequest(body)) {
    const source = (body as { revisionRequest?: unknown }).revisionRequest;
    const result = presentationRevisionRequestSchema.safeParse(source);

    return result.success
      ? { success: true as const, action: "revise" as const, data: result.data }
      : { success: false as const, action: "revise" as const, error: result.error };
  }

  if (isResumeWorkflowRequest(body)) {
    const result = resumeWorkflowRequestSchema.safeParse(body);

    return result.success
      ? { success: true as const, action: "resume" as const, data: result.data }
      : { success: false as const, action: "resume" as const, error: result.error };
  }

  const agentRequestSource = getAgentRequestSource(body);
  if (agentRequestSource) {
    const agentRequestResult = agentRequestSchema.safeParse(agentRequestSource);

    if (!agentRequestResult.success) {
      return { success: false as const, action: "start" as const, error: agentRequestResult.error };
    }

    const normalizedResult = presentationStartInputSchema.safeParse(normalizeAgentRequestToPresentationInput(agentRequestResult.data));

    return normalizedResult.success
      ? { success: true as const, action: "start" as const, data: normalizedResult.data }
      : { success: false as const, action: "start" as const, error: normalizedResult.error };
  }

  const result = presentationStartInputSchema.safeParse(getPresentationBriefSource(body));

  return result.success
    ? { success: true as const, action: "start" as const, data: result.data }
    : { success: false as const, action: "start" as const, error: result.error };
}

export function formatValidationErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "request",
    message: issue.message,
  }));
}
