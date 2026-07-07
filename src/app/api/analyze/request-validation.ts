import {
  presentationInputSchema,
  presentationOutlineSchema,
} from "@/src/mastra/workflows/presentation-generation-schemas";
import z from "zod";

export const resumeWorkflowRequestSchema = z.object({
  workflowRunId: z.string().trim().min(1, "Workflow run ID is required"),
  approvedOutline: presentationOutlineSchema,
});

export type WorkflowRequestAction = "start" | "resume";

export function isResumeWorkflowRequest(body: unknown) {
  return typeof body === "object" && body !== null && ("workflowRunId" in body || "approvedOutline" in body);
}

export function getPresentationBriefSource(body: unknown) {
  if (typeof body === "object" && body !== null && "presentationBrief" in body) {
    return (body as { presentationBrief?: unknown }).presentationBrief;
  }

  return body;
}

export function validatePresentationWorkflowRequest(body: unknown) {
  if (isResumeWorkflowRequest(body)) {
    const result = resumeWorkflowRequestSchema.safeParse(body);

    return result.success
      ? { success: true as const, action: "resume" as const, data: result.data }
      : { success: false as const, action: "resume" as const, error: result.error };
  }

  const result = presentationInputSchema.safeParse(getPresentationBriefSource(body));

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
