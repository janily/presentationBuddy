import {
  markProposalCancelled,
  resumeProposalExecution,
} from "@/src/services/agent-proposals/proposal-store";
import { NextResponse } from "next/server";
import z from "zod";

const requestSchema = z.discriminatedUnion("status", [
  z.object({
    proposalId: z.string().trim().min(1),
    status: z.literal("cancelled"),
    executionId: z.string().trim().min(1),
  }),
  z.object({
    proposalId: z.string().trim().min(1),
    status: z.literal("executing"),
    deckId: z.string().trim().min(1),
    baseVersion: z.number().int().nonnegative(),
  }),
]);

export async function POST(request: Request) {
  const validation = requestSchema.safeParse(await request.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid proposal status request" }, { status: 400 });
  }

  try {
    const proposal = validation.data.status === "cancelled"
      ? markProposalCancelled(validation.data.proposalId, validation.data.executionId)
      : resumeProposalExecution(validation.data.proposalId, {
          deckId: validation.data.deckId,
          version: validation.data.baseVersion,
        });
    return NextResponse.json(proposal);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Proposal status update failed",
    }, { status: 404 });
  }
}
