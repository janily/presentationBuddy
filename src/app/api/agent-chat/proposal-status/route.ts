import { markProposalCancelled } from "@/src/services/agent-proposals/proposal-store";
import { NextResponse } from "next/server";
import z from "zod";

const requestSchema = z.object({
  proposalId: z.string().trim().min(1),
  status: z.literal("cancelled"),
});

export async function POST(request: Request) {
  const validation = requestSchema.safeParse(await request.json().catch(() => null));
  if (!validation.success) {
    return NextResponse.json({ error: "Invalid proposal status request" }, { status: 400 });
  }

  try {
    return NextResponse.json(markProposalCancelled(validation.data.proposalId));
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Proposal status update failed",
    }, { status: 404 });
  }
}
