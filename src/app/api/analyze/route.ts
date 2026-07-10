import { mastra } from "@/src/mastra";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { NextRequest } from "next/server";
import { toAISdkFormat } from "@mastra/ai-sdk";
import { NextResponse } from "next/server";
import z from "zod";
import { formatValidationErrors, validatePresentationWorkflowRequest } from "./request-validation";
import { getPresentationArtifact } from "@/src/services/presentation-artifacts/artifact-store";

export const maxDuration = 300;

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

function streamErrorMessage(error: unknown) {
  const classification = classifyProcessingError(error);

  console.error("Presentation workflow stream failed:", {
    code: classification.code,
    message: getErrorMessage(error),
    error,
  });

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
  try {
    const body = await request.json();
    const validation = validatePresentationWorkflowRequest(body);

    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.action);
    }

    if (validation.action === "revise") {
      const { presentationBrief, approvedOutline, revision, artifact } = validation.data;
      const currentArtifact = getPresentationArtifact(artifact.deckId);
      const currentVersion = currentArtifact?.version ?? 0;

      if (currentVersion !== artifact.baseVersion) {
        return NextResponse.json({
          error: "The presentation changed before this revision started. Refresh the current version and try again.",
          code: "artifact_version_conflict",
          currentVersion,
        }, { status: 409 });
      }

      const workflow = mastra.getWorkflow("presentationRevisionWorkflow");
      const run = await workflow.createRunAsync();
      const revisedStyle = [
        revision.style ?? presentationBrief.style,
        revision.palette?.length ? `Palette: ${revision.palette.join(", ")}` : null,
        revision.instruction,
      ].filter(Boolean).join(". ");
      const stream = run.stream({
        inputData: {
          ...presentationBrief,
          style: revisedStyle,
          requirements: [
            presentationBrief.requirements,
            `Revision request (${revision.kind}): ${revision.instruction}`,
          ].filter(Boolean).join("\n\n"),
          outline: approvedOutline,
          revision,
          artifact,
        },
      });

      request.signal.addEventListener("abort", () => {
        void run.cancel();
      }, { once: true });

      console.log("Presentation revision workflow started", {
        operationId: artifact.operationId,
        workflowRunId: run.runId,
        deckId: artifact.deckId,
        baseVersion: artifact.baseVersion,
        targetVersion: artifact.targetVersion,
        revisionKind: revision.kind,
      });

      return createUIMessageStreamResponse({
        stream: createUIMessageStream({
          execute: ({ writer }) => {
            writer.write({
              type: "data-workflowRunId",
              data: run.runId,
            });
            writer.merge(toAISdkFormat(stream, { from: "workflow" }));
          },
          onError: streamErrorMessage,
        }),
      });
    }

    if (validation.action === "resume") {
      const workflow = mastra.getWorkflow("presentationGenerationWorkflow");
      const { workflowRunId, approvedOutline } = validation.data;

      console.log("Received presentation workflow resume request:", {
        workflowRunId,
        slideCount: approvedOutline.slides.length,
      });

      let stream;
      try {
        const run = await workflow.createRunAsync({ runId: workflowRunId });
        stream = run.resumeStream({
          step: "presentation-outline-suggestion-step",
          resumeData: {
            approvedOutline,
          } as never,
        });
        request.signal.addEventListener("abort", () => {
          void run.cancel();
        }, { once: true });
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

      return createUIMessageStreamResponse({
        stream: createUIMessageStream({
          execute: ({ writer }) => {
            writer.merge(toAISdkFormat(stream, {
              from: "workflow",
            }));
          },
          onError: streamErrorMessage,
        }),
      });
    }

    const { topic, audience, pageCount, style, requirements, artifact } =
      validation.data;
    const workflow = mastra.getWorkflow("presentationGenerationWorkflow");

    console.log("Received presentation generation request:", {
      topic,
      audience,
      pageCount,
      style,
      requirements,
    });

    type PresentationWorkflowRun = Awaited<ReturnType<typeof workflow.createRunAsync>>;
    let run: PresentationWorkflowRun;
    let stream: ReturnType<PresentationWorkflowRun["stream"]>;
    try {
      run = await workflow.createRunAsync();
      stream = run.stream({
        inputData: {
          topic,
          audience,
          pageCount,
          style,
          requirements,
          artifact,
        },
      });
      request.signal.addEventListener("abort", () => {
        void run.cancel();
      }, { once: true });
    } catch (error) {
      const classification = classifyProcessingError(error);

      console.error("Presentation workflow start failed:", {
        code: classification.code,
        topic,
        error,
      });

      return serverErrorResponse(
        classification.code === "unknown_error" ? "workflow_start_failed" : classification.code,
        classification.code === "unknown_error"
          ? "Could not start the presentation workflow. Please try again."
          : classification.message,
      );
    }

    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: ({ writer }) => {
          writer.write({
            type: "data-workflowRunId",
            data: run.runId,
          });
          writer.merge(toAISdkFormat(stream, {
            from: "workflow",
          }));
        },
        onError: streamErrorMessage,
      }),
    });
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
