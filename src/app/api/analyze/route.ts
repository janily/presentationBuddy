import { mastra } from "@/src/mastra";
import { createUIMessageStreamResponse, type UIMessageChunk } from "ai";
import { createManagedWorkflowStream } from "@/src/utils/managed-workflow-stream";
import type { NextRequest } from "next/server";
import { toAISdkFormat } from "@mastra/ai-sdk";
import { NextResponse } from "next/server";
import z from "zod";
import { formatValidationErrors, validatePresentationWorkflowRequest } from "./request-validation";
import {
  getPresentationArtifact,
  hasPresentationArtifactVersionConflict,
} from "@/src/services/presentation-artifacts/artifact-store";
import { buildRevisionWorkflowPlan } from "./revision-workflow-plan";
import { getAgentProposal } from "@/src/services/agent-proposals/proposal-store";

export const maxDuration = 300;

function workflowResponse(
  request: NextRequest,
  run: { runId: string; cancel: () => unknown },
  createStream: () => ReadableStream<UIMessageChunk>,
  deadline: number | undefined,
  announceRunId = true,
) {
  return createUIMessageStreamResponse({
    stream: createManagedWorkflowStream<UIMessageChunk>({
      signal: request.signal,
      createStream,
      deadline,
      initialChunks: announceRunId ? [{ type: "data-workflowRunId", data: run.runId }] : [],
      cancelWorkflow: () => run.cancel(),
      onCancelError: (error) => console.warn("Presentation workflow cleanup failed", { workflowRunId: run.runId, error }),
      onError: (error) => ({ type: "error", errorText: streamErrorMessage(error) }),
    }),
  });
}

function validationErrorResponse(error: z.ZodError, action: "start" | "resume" | "revise") {
  const fields = formatValidationErrors(error);

  console.warn("Presentation workflow input validation failed:", {
    action,
    fields,
  });

  return NextResponse.json(
    {
      error: action === "resume"
        ? "Invalid presentation workflow resume request"
        : action === "revise"
          ? "Invalid presentation revision request"
          : "Invalid presentation generation request",
      code: "validation_failed",
      fields,
    },
    { status: 400 },
  );
}

function serverErrorResponse(
  code: "workflow_resume_failed" | "workflow_start_failed" | "model_call_failed" | "file_save_failed" | "unknown_error",
  message: string,
) {
  return NextResponse.json(
    {
      error: message,
      code,
    },
    { status: 500 },
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isCancellationError(error: unknown) {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return error.name === "AbortError" || message.includes("cancelled") || message.includes("aborted");
}

function streamErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "TimeoutError") {
    console.warn("Presentation workflow reached the request deadline");
    return "Presentation generation exceeded this request's time limit. Please retry with fewer slides.";
  }
  const classification = classifyProcessingError(error);

  const logContext = {
    code: classification.code,
    message: getErrorMessage(error),
    error,
  };
  if (isCancellationError(error)) {
    console.warn("Presentation workflow stream cancelled by the client:", logContext);
    return "Presentation generation was cancelled.";
  }

  console.error("Presentation workflow stream failed:", logContext);

  return classification.message;
}

function classifyProcessingError(error: unknown) {
  const message = getErrorMessage(error);
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("save") || lowerMessage.includes("writefile") || lowerMessage.includes("enoent") || lowerMessage.includes("eacces")) {
    return {
      code: "file_save_failed" as const,
      message: "The presentation was generated, but saving the HTML file failed. Please retry HTML generation.",
    };
  }

  if (
    lowerMessage.includes("model")
    || lowerMessage.includes("provider")
    || lowerMessage.includes("generate")
    || lowerMessage.includes("generation")
    || lowerMessage.includes("outline")
    || lowerMessage.includes("stream")
    || lowerMessage.includes("timed out")
    || lowerMessage.includes("idle")
  ) {
    return {
      code: "model_call_failed" as const,
      message: "The AI model request failed. Please retry the current generation step.",
    };
  }

  return {
    code: "unknown_error" as const,
    message: "Failed to process the presentation workflow request.",
  };
}

export async function POST(request: NextRequest) {
  // Leave time to send a useful SSE error before Vercel terminates the function.
  // Self-hosted deployments retain their existing workflow step budgets.
  const deadline = process.env.VERCEL === "1" ? Date.now() + maxDuration * 1000 - 15_000 : undefined;
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON", code: "invalid_json" }, { status: 400 });
    }
    const validation = validatePresentationWorkflowRequest(body);

    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.action);
    }

    if (validation.action === "revise") {
      const { revision, artifact } = validation.data;
      const currentArtifact = getPresentationArtifact(artifact.deckId);
      const currentVersion = currentArtifact?.version ?? 0;

      if (hasPresentationArtifactVersionConflict(artifact.deckId, artifact.baseVersion)) {
        console.warn("presentation_revision.artifact_version_conflict", {
          operationId: artifact.operationId,
          proposalId: artifact.proposalId ?? null,
          deckId: artifact.deckId,
          expectedVersion: currentVersion,
          receivedVersion: artifact.baseVersion,
        });
        return NextResponse.json({
          error: "The presentation changed before this revision started. Refresh the current version and try again.",
          code: "artifact_version_conflict",
          currentVersion,
        }, { status: 409 });
      }

      const plan = buildRevisionWorkflowPlan(validation.data);
      const workflow = plan.workflowKind === "outline-revision"
        ? mastra.getWorkflow("presentationOutlineRevisionWorkflow")
        : mastra.getWorkflow("presentationRevisionWorkflow");
      const run = await workflow.createRunAsync();
      const proposalExecutionStartedAt = artifact.proposalId
        ? getAgentProposal(artifact.proposalId)?.executionStartedAt
        : undefined;
      const proposalConfirmToWorkflowStartMs = proposalExecutionStartedAt
        ? Date.now() - Date.parse(proposalExecutionStartedAt)
        : null;

      console.log("Presentation revision workflow started", {
        operationId: artifact.operationId,
        workflowRunId: run.runId,
        deckId: artifact.deckId,
        baseVersion: artifact.baseVersion,
        targetVersion: artifact.targetVersion,
        revisionKind: revision.kind,
        workflowKind: plan.workflowKind,
        proposalConfirmToWorkflowStartMs,
      });

      return workflowResponse(request, run, () => {
        const stream = run.stream({ inputData: plan.inputData } as never);
        return toAISdkFormat(stream.fullStream as never, { from: "workflow" });
      }, deadline);
    }

    if (validation.action === "resume") {
      const workflow = mastra.getWorkflow("presentationGenerationWorkflow");
      const { workflowRunId, approvedOutline } = validation.data;

      console.log("Received presentation workflow resume request:", {
        workflowRunId,
        slideCount: approvedOutline.slides.length,
      });

      try {
        const run = await workflow.createRunAsync({ runId: workflowRunId });
        return workflowResponse(request, run, () => {
          const stream = run.resumeStream({
            step: "presentation-outline-suggestion-step",
            resumeData: { approvedOutline } as never,
          });
          return toAISdkFormat(stream.fullStream as never, { from: "workflow" });
        }, deadline, false);
      } catch (error) {
        console.error("Presentation workflow resume failed:", {
          workflowRunId,
          error,
        });

        return serverErrorResponse(
          "workflow_resume_failed",
          "Could not resume the presentation workflow. Please create the outline again.",
        );
      }

    }

    const { topic, audience, pageCount, style, requirements } =
      validation.data;
    const workflow = mastra.getWorkflow("presentationGenerationWorkflow");

    console.log("Received presentation generation request:", {
      topicLength: topic.length,
      audienceLength: audience?.length ?? 0,
      pageCount,
      style,
      requirementsLength: requirements?.length ?? 0,
    });

    try {
      const run = await workflow.createRunAsync();
      return workflowResponse(request, run, () => {
        const stream = run.stream({
          // Keep every validated option, including custom style and density.
          inputData: validation.data,
        });
        return toAISdkFormat(stream.fullStream as never, { from: "workflow" });
      }, deadline);
    } catch (error) {
      const classification = classifyProcessingError(error);

      console.error("Presentation workflow start failed:", {
        code: classification.code,
        error,
      });

      return serverErrorResponse(
        classification.code === "unknown_error" ? "workflow_start_failed" : classification.code,
        classification.code === "unknown_error"
          ? "Could not start the presentation workflow. Please try again."
          : classification.message,
      );
    }

  } catch (error) {
    const classification = classifyProcessingError(error);

    console.error("Presentation generation request failed:", {
      code: classification.code,
      message: getErrorMessage(error),
      error,
    });

    return serverErrorResponse(classification.code, classification.message);
  }
}
