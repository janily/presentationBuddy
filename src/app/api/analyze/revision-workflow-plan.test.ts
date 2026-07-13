import { describe, expect, it } from "vitest";
import type { PresentationRevisionRequestData } from "@/src/types/presentation-workflow";
import { buildRevisionWorkflowPlan } from "./revision-workflow-plan";

const outline = {
  title: "Mastra",
  narrativeGoal: "Teach workflows",
  sections: ["Core"],
  slides: [{
    pageNumber: 1,
    title: "Intro",
    purpose: "Orient the audience",
    keyPoints: ["Agents and workflows"],
    designSuggestion: "Paper texture",
  }],
  designGuidance: ["Keep the paper-and-ink system"],
};

const baseRequest: PresentationRevisionRequestData = {
  presentationBrief: {
    topic: "Mastra",
    audience: "Developers",
    pageCount: 3,
    style: "Paper & Ink",
    requirements: "Explain the core concepts",
  },
  approvedOutline: outline,
  revision: {
    kind: "content",
    instruction: "丰富第 1 页的 Workflow 示例",
    requiresOutlineReview: false,
  },
  artifact: {
    operationId: "operation-2",
    deckId: "deck-1",
    baseVersion: 1,
    targetVersion: 2,
    proposalId: "proposal-1",
  },
};

describe("revision workflow planning", () => {
  it("preserves the visual style while passing a content revision separately", () => {
    const plan = buildRevisionWorkflowPlan(baseRequest);

    expect(plan.workflowKind).toBe("html-revision");
    expect(plan.inputData.style).toBe("Paper & Ink");
    expect(plan.inputData.revision.instruction).toBe("丰富第 1 页的 Workflow 示例");
    expect(plan.inputData.style).not.toContain("丰富");
  });

  it("routes structural changes through an auto-approved outline revision", () => {
    const plan = buildRevisionWorkflowPlan({
      ...baseRequest,
      revision: {
        kind: "structure",
        instruction: "增加一页 Workflow 实战案例",
        targetSlides: [2],
        requiresOutlineReview: true,
      },
    });

    expect(plan.workflowKind).toBe("outline-revision");
    expect(plan.inputData).toMatchObject({
      style: "Paper & Ink",
      autoApproveOutline: true,
      outlineRevisionContext: {
        instruction: "增加一页 Workflow 实战案例",
        targetSlides: [2],
        currentOutline: outline,
      },
    });
  });
});
