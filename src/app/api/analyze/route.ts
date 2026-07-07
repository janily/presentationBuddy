import { mastra } from "@/src/mastra";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { NextRequest } from "next/server";
import { toAISdkFormat } from "@mastra/ai-sdk";
import { NextResponse } from "next/server";
import z from "zod";
import { formatValidationErrors, validatePresentationWorkflowRequest } from "./request-validation";

function validationErrorResponse(error: z.ZodError, action: "start" | "resume") {
  const fields = formatValidationErrors(error);

  console.warn("Presentation workflow input validation failed:", {
    action,
    fields,
  });

  return NextResponse.json(
    {
      error: action === "resume"
        ? "Invalid presentation workflow resume request"
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
    const workflow = mastra.getWorkflow("presentationGenerationWorkflow");
    const validation = validatePresentationWorkflowRequest(body);

    if (!validation.success) {
      return validationErrorResponse(validation.error, validation.action);
    }

    if (validation.action === "resume") {
      const { workflowRunId, approvedOutline } = validation.data;

      console.log("Received presentation workflow resume request:", {
        workflowRunId,
        slideCount: approvedOutline.slides.length,
      });

      let stream;
      try {
        const run = await workflow.createRunAsync({ runId: workflowRunId });
        stream = run.resumeStreamVNext({
          step: "presentation-outline-suggestion-step",
          resumeData: {
            approvedOutline,
          } as never,
        });
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

    const { topic, audience, pageCount, style, requirements } =
      validation.data;

    console.log("Received presentation generation request:", {
      topic,
      audience,
      pageCount,
      style,
      requirements,
    });

    let run;
    let stream;
    try {
      run = await workflow.createRunAsync();
      stream = run.streamVNext({
        inputData: {
          topic,
          audience,
          pageCount,
          style,
          requirements,
        },
      });
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
