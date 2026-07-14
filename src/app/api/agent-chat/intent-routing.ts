import type { BriefDecision } from "@/src/mastra/agents/presentation-brief-conversation-agent";
import type { AgentActionProposal } from "@/src/types/agent-chat";

type ActionProposalContext = {
  deckId: string;
  version: number;
  proposalId: string;
  createdAt: string;
};

/**
 * Builds a persistable action proposal from a model decision. This is a
 * DETERMINISTIC structural transform — it does not interpret intent. The model
 * already decided the nextAction and produced a concrete revision instruction;
 * this only reshapes that into a versioned, storable proposal when the action
 * is one that can be executed later after confirmation.
 */
export function createActionProposal(
  decision: BriefDecision,
  context: ActionProposalContext,
): AgentActionProposal | null {
  if (
    (
      decision.nextAction !== "revise-content"
      && decision.nextAction !== "revise-structure"
      && decision.nextAction !== "change-palette"
    )
    || !decision.revision?.instruction.trim()
  ) {
    return null;
  }

  return {
    proposalId: context.proposalId,
    deckId: context.deckId,
    baseVersion: context.version,
    action: decision.nextAction,
    instruction: decision.revision.instruction.trim(),
    targetSlides: decision.revision.targetSlides,
    requiresOutlineReview: decision.revision.requiresOutlineReview,
    userFacingSummary: decision.reply,
    status: "pending",
    createdAt: context.createdAt,
  };
}
