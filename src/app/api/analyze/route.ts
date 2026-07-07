import { mastra } from "@/src/mastra";
import { createUIMessageStreamResponse } from "ai";
import type { NextRequest } from "next/server";
import { toAISdkFormat } from "@mastra/ai-sdk";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const topic = body.topic as string | undefined;
    const audience = body.audience as string | undefined;
    const pageCount = body.pageCount as number | undefined;
    const style = body.style as string | undefined;
    const requirements = body.requirements as string | undefined;
    const workflowRunId = body.workflowRunId as string | undefined;
    const approvedOutline = body.approvedOutline as unknown | undefined;

    const workflow = mastra.getWorkflow("presentationGenerationWorkflow");

    console.log("Received presentation generation request:", {
      topic,
      audience,
      pageCount,
      style,
      requirements,
      workflowRunId,
      approvedOutline,
    });

    // Resume an existing workflow run after outline approval/editing.
    if (workflowRunId && approvedOutline) {
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

    // Start a new workflow run.
    if (!topic) {
      return NextResponse.json(
        { error: "No presentation topic provided" },
        { status: 400 },
      );
    }

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
      stream: toAISdkFormat(stream, {
        from: "workflow",
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
