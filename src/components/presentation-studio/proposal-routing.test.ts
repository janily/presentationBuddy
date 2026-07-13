import { describe, expect, it } from "vitest";
import type { AgentActionProposal } from "@/src/types/agent-chat";
import { resolveProposalConfirmation, resolveStructureRevisionPageCount } from "./proposal-routing";

const proposal: AgentActionProposal = {
  proposalId: "proposal-1",
  deckId: "deck-1",
  baseVersion: 2,
  action: "revise-structure",
  instruction: "增加一页 Mastra Workflow 实战案例",
  requiresOutlineReview: true,
  userFacingSummary: "新增一页实战案例并更新大纲",
  status: "pending",
  createdAt: "2026-07-13T00:00:00.000Z",
};

describe("proposal confirmation routing", () => {
  it.each([
    "按你的方案来执行",
    "按上述方案生成",
    "可以，就这么改",
    "就按刚才的建议改",
  ])("executes the unique pending proposal for: %s", (message) => {
    expect(resolveProposalConfirmation(message, proposal, { deckId: "deck-1", version: 2 })).toEqual({
      kind: "execute",
      proposal,
    });
  });

  it("treats added constraints as an amendment instead of executing the old proposal", () => {
    expect(resolveProposalConfirmation(
      "按你的方案来执行，但不要新增页面",
      proposal,
      { deckId: "deck-1", version: 2 },
    )).toEqual({ kind: "amend" });
  });

  it("rejects a proposal created for an older artifact version", () => {
    expect(resolveProposalConfirmation("按方案执行", proposal, { deckId: "deck-1", version: 3 })).toEqual({
      kind: "stale",
    });
  });

  it("does not execute when there is no pending proposal", () => {
    expect(resolveProposalConfirmation("执行吧", null, { deckId: "deck-1", version: 2 })).toEqual({
      kind: "none",
    });
  });

  it("treats a repeated confirmation of a consumed proposal as idempotent", () => {
    expect(resolveProposalConfirmation(
      "按方案执行",
      { ...proposal, status: "consumed" },
      { deckId: "deck-1", version: 3 },
    )).toEqual({ kind: "consumed" });
  });
});

describe("structure revision page count", () => {
  it("increments for an explicit one-slide addition", () => {
    expect(resolveStructureRevisionPageCount(8, "增加一页 Mastra Workflow 实战案例")).toBe(9);
  });

  it("decrements for an explicit one-slide removal", () => {
    expect(resolveStructureRevisionPageCount(8, "删除一页重复的背景介绍")).toBe(7);
  });

  it("keeps the count when the instruction only reorders sections", () => {
    expect(resolveStructureRevisionPageCount(8, "调整章节顺序，把案例放到结尾")).toBe(8);
  });
});
