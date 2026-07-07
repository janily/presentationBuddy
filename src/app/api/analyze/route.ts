import { mastra } from "@/src/mastra";
import {
  presentationInputSchema,
  presentationOutlineSchema,
} from "@/src/mastra/workflows/presentation-generation-workflow";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";
import type { NextRequest } from "next/server";
import { toAISdkFormat } from "@mastra/ai-sdk";
import { NextResponse } from "next/server";
import z from "zod";

const resumeWorkflowRequestSchema = z.object({
  workflowRunId: z.string().trim().min(1, "Workflow run ID is required"),
  approvedOutline: presentationOutlineSchema,
});

function formatValidationErrors(error: z.ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "request",
    message: issue.message,
  }));
}

function validationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    {
      error: "Invalid presentation generation request",
      fields: formatValidationErrors(error),
    },
    { status: 400 },
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const workflow = mastra.getWorkflow("presentationGenerationWorkflow");
    const isResumeRequest =
      "workflowRunId" in body || "approvedOutline" in body;

    if (isResumeRequest) {
      const resumeRequest = resumeWorkflowRequestSchema.safeParse(body);

      if (!resumeRequest.success) {
        return validationErrorResponse(resumeRequest.error);
      }

      const { workflowRunId, approvedOutline } = resumeRequest.data;

      console.log("Received presentation workflow resume request:", {
        workflowRunId,
        approvedOutline,
      });

      const run = await workflow.createRunAsync({ runId: workflowRunId });
      const stream = run.resumeStreamVNext({
        step: "presentation-outline-suggestion-step",
        resumeData: {
          approvedOutline,
        } as never,
      });

      return createUIMessageStreamResponse({
        stream: toAISdkFormat(stream, {
          from: "workflow",
        }),
      });
    }

    const presentationBriefSource = body.presentationBrief ?? body;
    const presentationBrief = presentationInputSchema.safeParse(
      presentationBriefSource,
    );

    if (!presentationBrief.success) {
      return validationErrorResponse(presentationBrief.error);
    }

    const { topic, audience, pageCount, style, requirements } =
      presentationBrief.data;

    console.log("Received presentation generation request:", {
      topic,
      audience,
      pageCount,
      style,
      requirements,
    });

    const run = await workflow.createRunAsync();
    const stream = run.streamVNext({
      inputData: {
        topic,
        audience,
        pageCount,
        style,
        requirements,
      },
    });

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
      }),
    });
  } catch (error) {
    console.error("Presentation generation error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
