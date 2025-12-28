import { mastra } from "@/src/mastra";
import { createUIMessageStreamResponse } from "ai";
import type { NextRequest } from "next/server";
import { toAISdkFormat } from "@mastra/ai-sdk";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const imageUrl = body.imageUrl as string | undefined;
    const workflowRunId = body.workflowRunId as string | undefined;
    const approvedChanges = body.approvedChanges as string[] | undefined;

    const workflow = mastra.getWorkflow(
      "interiorImprovementSuggestionWorkflow",
    );

    console.log("Received analyze request:", {
      imageUrl,
      workflowRunId,
      approvedChanges,
    });
    // Resume an existing workflow run
    if (workflowRunId && approvedChanges) {
      const run = await workflow.createRunAsync({ runId: workflowRunId });
      const stream = run.resumeStreamVNext({
        step: "interior-improvement-suggestion-step",
        resumeData: {
          approvedChanges,
        } as unknown as { imageUrl: string },
      });

      return createUIMessageStreamResponse({
        stream: toAISdkFormat(stream, {
          from: "workflow",
        }),
      });
    }

    // Start a new workflow run
    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image URL provided" },
        { status: 400 },
      );
    }

    const run = await workflow.createRunAsync();
    const stream = run.streamVNext({
      inputData: {
        imageUrl,
      },
    });

    return createUIMessageStreamResponse({
      stream: toAISdkFormat(stream, {
        from: "workflow",
      }),
    });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 },
    );
  }
}
