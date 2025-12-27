import { mastra } from "@/src/mastra";
import { createUIMessageStreamResponse } from "ai";
import type { NextRequest } from "next/server";
import { toAISdkFormat } from "@mastra/ai-sdk";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const {
      imageUrl,
      activeRunId,
      approvedChanges,
    }: {
      imageUrl: string;
      activeRunId?: string;
      approvedChanges?: string[];
    } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: "No image URL provided" },
        { status: 400 },
      );
    }

    const workflow = mastra.getWorkflow(
      "interiorImprovementSuggestionWorkflow",
    );

    if (!activeRunId) {
      const run = await workflow.createRunAsync();
      const stream = run.stream();
      return createUIMessageStreamResponse({
        stream: toAISdkFormat(stream, {
          from: "workflow",
        }),
      });
    }

    const run = await workflow.createRunAsync({ runId: activeRunId });
    const stream = run.resumeStream({
      resumeData: {
        approvedChanges,
      } as unknown as never,
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
