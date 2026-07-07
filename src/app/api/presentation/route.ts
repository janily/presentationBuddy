import { mastra } from "@/src/mastra";
import { createUIMessageStreamResponse } from "ai";
import type { NextRequest } from "next/server";
import { toAISdkFormat } from "@mastra/ai-sdk";
import { NextResponse } from "next/server";

type PresentationRequestBody = {
  brief?: string;
  topic?: string;
  audience?: string;
  pageCount?: number;
  style?: string;
  requirements?: string;
  workflowRunId?: string;
  approvedOutline?: string[];
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PresentationRequestBody;
    const {
      brief,
      topic,
      audience,
      pageCount,
      style,
      requirements,
      workflowRunId,
      approvedOutline,
    } = body;

    const workflow = mastra.getWorkflow("presentationGenerationWorkflow");

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

    if (!topic && !brief) {
      return NextResponse.json(
        { error: "No presentation topic or brief provided" },
        { status: 400 },
      );
    }

    const run = await workflow.createRunAsync();
    const stream = run.streamVNext({
      inputData: {
        brief,
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
    console.error("Presentation request error:", error);
    return NextResponse.json(
      { error: "Failed to process presentation request" },
      { status: 500 },
    );
  }
}
