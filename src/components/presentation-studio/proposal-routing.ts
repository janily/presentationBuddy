import type { AgentActionProposal } from "@/src/types/agent-chat";
import type { RevisionSpec } from "@/src/types/presentation-workflow";
import { classifyProposalConfirmation } from "@/src/utils/proposal-confirmation";
export { resolveStructureRevisionPageCount } from "@/src/utils/structure-revision-page-count";

type CurrentArtifactIdentity = {
  deckId: string;
  version: number;
};

export type ProposalConfirmationResolution =
  | { kind: "execute"; proposal: AgentActionProposal }
  | { kind: "amend" }
  | { kind: "stale" }
  | { kind: "consumed" }
  | { kind: "none" };

export function resolveProposalConfirmation(
  message: string,
  proposal: AgentActionProposal | null,
  currentArtifact: CurrentArtifactIdentity | null,
): ProposalConfirmationResolution {
  if (!proposal) return { kind: "none" };

  const confirmationIntent = classifyProposalConfirmation(message);
  if (confirmationIntent === "none") return { kind: "none" };
  if (proposal.status === "consumed" || proposal.status === "executing") return { kind: "consumed" };
  if (proposal.status !== "pending") return { kind: "none" };
  if (confirmationIntent === "amend") return { kind: "amend" };

  if (
    !currentArtifact
    || currentArtifact.deckId !== proposal.deckId
    || currentArtifact.version !== proposal.baseVersion
  ) {
    return { kind: "stale" };
  }

  return { kind: "execute", proposal };
}

export function buildRevisionFromProposal(proposal: AgentActionProposal): RevisionSpec {
  const kind = proposal.action === "revise-structure"
    ? "structure"
    : proposal.action === "change-palette"
      ? "palette"
      : proposal.action === "change-style"
        ? "style"
        : proposal.action === "mixed"
          ? "mixed"
          : "content";

  return {
    kind,
    instruction: proposal.instruction,
    targetSlides: proposal.targetSlides,
    requiresOutlineReview: proposal.requiresOutlineReview,
  };
}
