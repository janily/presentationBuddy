import { describe, expect, it } from "vitest";
import type { AgentActionProposal } from "@/src/types/agent-chat";
import {
  buildRevisionFromProposal,
  resolveProposalConfirmation,
  resolveStructureRevisionPageCount,
} from "./proposal-routing";

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

  it("increments for a natural one-slide addition without a numeral next to page", () => {
    expect(resolveStructureRevisionPageCount(8, "新增一个 Mastra Workflow 实战案例页")).toBe(9);
  });

  it("accumulates multiple additions in one confirmed proposal", () => {
    expect(resolveStructureRevisionPageCount(
      12,
      "1) 新增一页天气查询 Agent 设计；2) 新增一页完整实现代码",
    )).toBe(14);
    expect(resolveStructureRevisionPageCount(12, "新增两页实战内容")).toBe(14);
  });

  it("decrements for an explicit one-slide removal", () => {
    expect(resolveStructureRevisionPageCount(8, "删除一页重复的背景介绍")).toBe(7);
  });

  it("treats an ordinal page reference as one removed slide, not a quantity", () => {
    expect(resolveStructureRevisionPageCount(8, "删除第 5 页重复的背景介绍")).toBe(7);
    expect(resolveStructureRevisionPageCount(12, "删除第10页重复的背景介绍")).toBe(11);
    expect(resolveStructureRevisionPageCount(14, "删除第12页重复的背景介绍")).toBe(13);
  });

  it("keeps the count when the instruction only reorders sections", () => {
    expect(resolveStructureRevisionPageCount(8, "调整章节顺序，把案例放到结尾")).toBe(8);
  });
});

describe("proposal workflow mapping", () => {
  it("maps a palette proposal to a palette-only HTML revision", () => {
    expect(buildRevisionFromProposal({
      ...proposal,
      action: "change-palette",
      instruction: "把配色改成深蓝和青色",
      requiresOutlineReview: false,
    })).toEqual({
      kind: "palette",
      instruction: "把配色改成深蓝和青色",
      targetSlides: undefined,
      requiresOutlineReview: false,
    });
  });
});
