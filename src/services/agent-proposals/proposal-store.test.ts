import { beforeEach, describe, expect, it } from "vitest";
import type { AgentActionProposal } from "@/src/types/agent-chat";
import {
  beginProposalExecution,
  getAgentProposal,
  markProposalCancelled,
  markProposalConsumed,
  resetAgentProposalStore,
  saveAgentProposal,
} from "./proposal-store";

const proposal: AgentActionProposal = {
  proposalId: "proposal-1",
  deckId: "deck-1",
  baseVersion: 2,
  action: "revise-content",
  instruction: "丰富第 4 页",
  requiresOutlineReview: false,
  userFacingSummary: "丰富第 4 页内容",
  status: "pending",
  createdAt: "2026-07-13T00:00:00.000Z",
};

describe("agent proposal store", () => {
  beforeEach(() => resetAgentProposalStore());

  it("persists and atomically begins a proposal for its artifact version", () => {
    saveAgentProposal(proposal);

    expect(beginProposalExecution("proposal-1", { deckId: "deck-1", version: 2 })).toMatchObject({
      status: "executing",
    });
    expect(getAgentProposal("proposal-1")?.status).toBe("executing");
  });

  it("rejects execution against a newer artifact version", () => {
    saveAgentProposal(proposal);

    expect(() => beginProposalExecution("proposal-1", { deckId: "deck-1", version: 3 })).toThrow(/version/i);
    expect(getAgentProposal("proposal-1")?.status).toBe("pending");
  });

  it("marks a proposal consumed only after successful publication", () => {
    saveAgentProposal(proposal);
    beginProposalExecution("proposal-1", { deckId: "deck-1", version: 2 });

    expect(markProposalConsumed("proposal-1").status).toBe("consumed");
  });

  it("marks a stopped execution cancelled", () => {
    saveAgentProposal(proposal);
    beginProposalExecution("proposal-1", { deckId: "deck-1", version: 2 });

    expect(markProposalCancelled("proposal-1").status).toBe("cancelled");
  });

  it("does not regress a consumed proposal to cancelled", () => {
    saveAgentProposal(proposal);
    beginProposalExecution("proposal-1", { deckId: "deck-1", version: 2 });
    markProposalConsumed("proposal-1");

    expect(() => markProposalCancelled("proposal-1")).toThrow(/already consumed/i);
    expect(getAgentProposal("proposal-1")?.status).toBe("consumed");
  });
});
