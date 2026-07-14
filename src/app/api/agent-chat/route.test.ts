import { describe, expect, it } from "vitest";
import type { BriefDecision } from "@/src/mastra/agents/presentation-brief-conversation-agent";
import { applyIntentGuard, createActionProposal, detectExplicitAction } from "./intent-routing";
import { buildRevisionConfirmationReply, explicitlyConfirmedGeneration } from "./route";

const baseDecision: BriefDecision = {
  reply: "正在准备视觉风格预览。",
  readyToGenerate: false,
  nextAction: "discover-styles",
  revision: null,
  styleId: null,
  brief: null,
};

describe("agent chat intent guard", () => {
  it("keeps content enrichment out of style discovery", () => {
    const result = applyIntentGuard(baseDecision, "我觉得内容还需要再丰富下", true, {
      explicitlyConfirmedGeneration: () => false,
    });

    expect(result.nextAction).toBe("revise-content");
    expect(result.revision).toMatchObject({
      instruction: "我觉得内容还需要再丰富下",
      requiresOutlineReview: false,
    });
    expect(result.reply).not.toContain("风格预览");
  });

  it("recognizes a request for another style batch", () => {
    expect(detectExplicitAction("再推荐一些其它的风格", true)).toBe("more-styles");
  });

  it("does not intercept an ordinary question", () => {
    expect(detectExplicitAction("Mastra 和 LangGraph 有什么区别？", true)).toBeNull();
  });

  it("turns a concrete palette request into a confirmable revision", () => {
    const result = applyIntentGuard(baseDecision, "把配色改成深蓝和青色", true, {
      explicitlyConfirmedGeneration: () => false,
    });

    expect(result.nextAction).toBe("change-palette");
    expect(result.revision).toEqual({
      instruction: "把配色改成深蓝和青色",
      requiresOutlineReview: false,
    });
  });

  it("fills a missing palette revision even when the model classified the action correctly", () => {
    const result = applyIntentGuard({
      ...baseDecision,
      nextAction: "change-palette",
      revision: null,
    }, "把配色改成深蓝和青色", true, {
      explicitlyConfirmedGeneration: () => false,
    });

    expect(result.revision).toEqual({
      instruction: "把配色改成深蓝和青色",
      requiresOutlineReview: false,
    });
  });
});

describe("agent action proposal policy", () => {
  it("binds a structural revision proposal to the current artifact version", () => {
    const decision: BriefDecision = {
      ...baseDecision,
      reply: "我会增加一页实战案例，确认后执行。",
      nextAction: "revise-structure",
      revision: {
        instruction: "增加一页 Mastra Workflow 实战案例",
        targetSlides: [6],
        requiresOutlineReview: true,
      },
    };

    expect(createActionProposal(decision, {
      deckId: "deck-1",
      version: 4,
      proposalId: "proposal-1",
      createdAt: "2026-07-13T00:00:00.000Z",
    })).toEqual({
      proposalId: "proposal-1",
      deckId: "deck-1",
      baseVersion: 4,
      action: "revise-structure",
      instruction: "增加一页 Mastra Workflow 实战案例",
      targetSlides: [6],
      requiresOutlineReview: true,
      userFacingSummary: "我会增加一页实战案例，确认后执行。",
      status: "pending",
      createdAt: "2026-07-13T00:00:00.000Z",
    });
  });

  it("does not create a proposal for ordinary chat", () => {
    expect(createActionProposal({
      ...baseDecision,
      reply: "Mastra 的 Workflow 适合确定性的多步骤流程。",
      nextAction: "chat",
      revision: null,
    }, {
      deckId: "deck-1",
      version: 4,
      proposalId: "proposal-1",
      createdAt: "2026-07-13T00:00:00.000Z",
    })).toBeNull();
  });

  it("creates a version-bound proposal for a palette revision", () => {
    expect(createActionProposal({
      ...baseDecision,
      reply: "将配色改为深蓝和青色，保持内容与版式不变。",
      nextAction: "change-palette",
      revision: {
        instruction: "把配色改成深蓝和青色",
        requiresOutlineReview: false,
      },
    }, {
      deckId: "deck-1",
      version: 4,
      proposalId: "proposal-palette",
      createdAt: "2026-07-13T00:00:00.000Z",
    })).toMatchObject({
      action: "change-palette",
      instruction: "把配色改成深蓝和青色",
      baseVersion: 4,
      status: "pending",
    });
  });
});

describe("generation confirmation policy", () => {
  it.each([
    "按你的方案来执行",
    "按上述方案生成",
    "就按刚才的建议改",
  ])("recognizes a proposal-referencing confirmation: %s", (message) => {
    expect(explicitlyConfirmedGeneration(message)).toBe(true);
  });

  it("does not confirm when the user adds a new constraint", () => {
    expect(explicitlyConfirmedGeneration("按你的方案来执行，但不要新增页面")).toBe(false);
  });

  it("confirms the pending revision rather than the existing visual style", () => {
    const reply = buildRevisionConfirmationReply({
      ...baseDecision,
      brief: {
        topic: "Mastra 教程",
        audience: "开发者",
        pageCount: 8,
        style: "Paper & Ink",
        requirements: "",
        purpose: "teaching-tutorial",
        density: "speaker-led",
        contentReadiness: "ready",
      },
      revision: {
        instruction: "增加一页 Workflow 实战",
        requiresOutlineReview: true,
      },
    });

    expect(reply).toContain("增加一页 Workflow 实战");
    expect(reply).not.toContain("Paper & Ink");
  });
});
