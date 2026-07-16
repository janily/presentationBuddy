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

const studioStyle = {
  id: "bold-template-studio",
  name: "Studio",
  source: "frontend-slides-bold-template" as const,
  vibe: "electric, bold, graphic",
  layout: "Black canvas with electric-yellow type",
  typography: { display: "Barlow", body: "IBM Plex Mono" },
  palette: {
    background: "#1C1C1C",
    surface: "#242422",
    text: "#F5D200",
    accent: "#F5D200",
    secondary: "#2E2E2C",
  },
  signatureElements: ["type-as-graphic-mass"],
  boldTemplate: {
    slug: "studio",
    tagline: "Black canvas with electric-yellow type",
    mood: ["electric", "bold", "graphic"],
    tone: ["loud", "intentional"],
    formality: "medium",
    density: "medium",
    scheme: "dark",
    bestFor: "Design-led decks",
    avoidFor: "Quiet institutional decks",
    previewMd: "bold-template-pack/templates/studio/preview.md",
    designMd: "bold-template-pack/templates/studio/design.md",
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

  it("derives a multi-slide structural revision count from the approved outline on the server", () => {
    const twelveSlideOutline = {
      ...outline,
      slides: Array.from({ length: 12 }, (_, index) => ({
        ...outline.slides[0],
        pageNumber: index + 1,
        title: `Slide ${index + 1}`,
      })),
    };
    const plan = buildRevisionWorkflowPlan({
      ...baseRequest,
      presentationBrief: { ...baseRequest.presentationBrief, pageCount: 12 },
      approvedOutline: twelveSlideOutline,
      revision: {
        kind: "structure",
        instruction: "1) 新增一页天气 Agent 设计；2) 新增一页完整实现代码",
        requiresOutlineReview: true,
      },
    });

    expect(plan.workflowKind).toBe("outline-revision");
    expect(plan.inputData.pageCount).toBe(14);
  });

  it("releases the old fixed palette while preserving layout for a palette revision", () => {
    const plan = buildRevisionWorkflowPlan({
      ...baseRequest,
      presentationBrief: {
        ...baseRequest.presentationBrief,
        styleSpec: {
          id: "paper-ink",
          name: "Paper & Ink",
          source: "frontend-slides-preset",
          vibe: "Editorial",
          layout: "Paper layout",
          typography: { display: "Fraunces", body: "Source Serif 4" },
          palette: {
            background: "#faf9f7",
            surface: "#fffdf9",
            text: "#1a1a1a",
            accent: "#c41e3a",
            secondary: "#6b625b",
          },
          signatureElements: ["rules"],
        },
      },
      revision: {
        kind: "palette",
        instruction: "把配色改成深蓝和青色",
        requiresOutlineReview: false,
      },
    });

    expect(plan.workflowKind).toBe("html-revision");
    if (plan.workflowKind !== "html-revision") throw new Error("Expected HTML revision plan");
    expect(plan.inputData.style).toContain("把配色改成深蓝和青色");
    expect(plan.inputData.styleSpec).toMatchObject({
      layout: "Paper layout",
      typography: { display: "Fraunces", body: "Source Serif 4" },
      palette: { accent: "#123b6d", secondary: "#16c7c7" },
      signatureElements: ["rules"],
    });
    expect(plan.inputData.outline).toBe(outline);
  });

  it("restyles every slide without carrying visual directions from the previous theme", () => {
    const plan = buildRevisionWorkflowPlan({
      ...baseRequest,
      presentationBrief: {
        ...baseRequest.presentationBrief,
      },
      revision: {
        kind: "style",
        instruction: "Restyle the entire presentation using Studio",
        style: "Studio",
        styleSpec: studioStyle,
        requiresOutlineReview: false,
      },
    });

    expect(plan.workflowKind).toBe("html-revision");
    if (plan.workflowKind !== "html-revision") throw new Error("Expected HTML revision plan");
    expect(plan.inputData.style).toBe("Studio");
    expect(plan.inputData.styleSpec).toEqual(studioStyle);
    expect(plan.inputData.requirements).toBe(baseRequest.presentationBrief.requirements);
    expect(plan.inputData.requirements).not.toContain("Restyle the entire presentation");
    expect(plan.inputData.outline.designGuidance).toEqual([]);
    expect(plan.inputData.outline.slides[0].designSuggestion).toBe("");
    expect(plan.inputData.outline.slides[0].keyPoints).toEqual(outline.slides[0].keyPoints);
  });
});
