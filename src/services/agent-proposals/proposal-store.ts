import type { AgentActionProposal } from "@/src/types/agent-chat";

type ArtifactIdentity = {
  deckId: string;
  version: number;
};

const globalProposalStore = globalThis as typeof globalThis & {
  __presentationBuddyAgentProposals?: Map<string, AgentActionProposal>;
};

function getStore() {
  globalProposalStore.__presentationBuddyAgentProposals ??= new Map<string, AgentActionProposal>();
  return globalProposalStore.__presentationBuddyAgentProposals;
}

export function getAgentProposal(proposalId: string) {
  return getStore().get(proposalId) ?? null;
}

export function saveAgentProposal(proposal: AgentActionProposal) {
  const store = getStore();
  for (const [proposalId, current] of store.entries()) {
    if (current.deckId === proposal.deckId && current.status === "pending") {
      store.set(proposalId, { ...current, status: "superseded" });
    }
  }
  store.set(proposal.proposalId, proposal);
  return proposal;
}

export function beginProposalExecution(proposalId: string, artifact: ArtifactIdentity) {
  const store = getStore();
  const proposal = store.get(proposalId);
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.deckId !== artifact.deckId || proposal.baseVersion !== artifact.version) {
    throw new Error("Proposal artifact version does not match the current presentation");
  }
  if (proposal.status === "executing" || proposal.status === "consumed") return proposal;
  if (proposal.status !== "pending") throw new Error(`Proposal is ${proposal.status}`);

  const executing: AgentActionProposal = {
    ...proposal,
    status: "executing",
    executionStartedAt: new Date().toISOString(),
    executionId: crypto.randomUUID(),
  };
  store.set(proposalId, executing);
  return executing;
}

export function resumeProposalExecution(proposalId: string, artifact: ArtifactIdentity) {
  const store = getStore();
  const proposal = store.get(proposalId);
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.deckId !== artifact.deckId || proposal.baseVersion !== artifact.version) {
    throw new Error("Proposal artifact version does not match the current presentation");
  }
  if (proposal.status !== "cancelled" && proposal.status !== "executing") {
    throw new Error(`Only a cancelled or interrupted proposal can be resumed; proposal is ${proposal.status}`);
  }

  const executing: AgentActionProposal = {
    ...proposal,
    status: "executing",
    executionStartedAt: new Date().toISOString(),
    executionId: crypto.randomUUID(),
  };
  store.set(proposalId, executing);
  return executing;
}

function setTerminalStatus(
  proposalId: string,
  status: Extract<AgentActionProposal["status"], "consumed" | "cancelled">,
) {
  const store = getStore();
  const proposal = store.get(proposalId);
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.status === status) return proposal;
  if (proposal.status === "consumed" || proposal.status === "cancelled" || proposal.status === "superseded") {
    throw new Error(`Proposal is already ${proposal.status}`);
  }
  const updated: AgentActionProposal = { ...proposal, status };
  store.set(proposalId, updated);
  return updated;
}

export function markProposalConsumed(proposalId: string) {
  return setTerminalStatus(proposalId, "consumed");
}

export function markProposalCancelled(proposalId: string, expectedExecutionId?: string) {
  const proposal = getAgentProposal(proposalId);
  if (
    expectedExecutionId
    && proposal?.executionId
    && proposal.executionId !== expectedExecutionId
  ) {
    throw new Error("Proposal execution attempt no longer matches the cancellation request");
  }
  return setTerminalStatus(proposalId, "cancelled");
}

export function resetAgentProposalStore() {
  getStore().clear();
}
