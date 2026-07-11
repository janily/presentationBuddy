import {
  frontendSlidesStyleDiscoveryInputSchema,
  frontendSlidesStyleDiscoveryWorkflow,
} from "@/src/mastra/workflows/frontend-slides-style-discovery-workflow";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const validation = frontendSlidesStyleDiscoveryInputSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: "Invalid frontend-slides style discovery request" }, { status: 400 });
  }

  // Run the current module instance so Next.js HMR cannot leave this endpoint
  // attached to a stale workflow cached by the long-lived Mastra singleton.
  const run = await frontendSlidesStyleDiscoveryWorkflow.createRunAsync();
  const result = await run.start({ inputData: validation.data });

  if (result.status !== "success") {
    const message = result.status === "failed" ? result.error.message : "Style discovery did not complete";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json(result.result);
}
