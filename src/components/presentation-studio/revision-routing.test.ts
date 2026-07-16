import { describe, expect, it } from "vitest";
import { buildFullDeckStyleRevision, isStructureChangingRevision } from "./revision-routing";

describe("revision routing", () => {
  it("builds an explicit full-deck style revision for a selected visual system", () => {
    const styleSpec = {
      id: "bold-template-studio",
      name: "Studio",
      source: "frontend-slides-bold-template" as const,
      vibe: "electric",
      layout: "black and acid yellow",
      typography: { display: "Barlow", body: "IBM Plex Mono" },
      palette: { background: "#1C1C1C", surface: "#242422", text: "#F5D200", accent: "#F5D200", secondary: "#2E2E2C" },
      signatureElements: ["type-as-graphic-mass"],
      boldTemplate: {
        slug: "studio",
        tagline: "Black canvas with electric-yellow type",
        mood: ["electric"],
        tone: ["loud"],
        formality: "medium",
        density: "medium",
        scheme: "dark",
        bestFor: "Design decks",
        avoidFor: "Quiet decks",
        previewMd: "bold-template-pack/templates/studio/preview.md",
        designMd: "bold-template-pack/templates/studio/design.md",
      },
    };

    expect(buildFullDeckStyleRevision("Studio", styleSpec)).toEqual({
      kind: "style",
      instruction: "Restyle the entire presentation using the selected Studio visual system. Apply it to every slide and replace the previous theme's layout, typography, palette, and signature elements while preserving the approved content and slide order.",
      style: "Studio",
      styleSpec,
      requiresOutlineReview: false,
    });
  });

  it.each([
    "增加一页客户案例",
    "删掉第 3 页",
    "把最后两页调换顺序",
    "add one slide for pricing",
  ])("requires outline review for structural request: %s", (message) => {
    expect(isStructureChangingRevision(message)).toBe(true);
  });

  it.each([
    "换成专业深色风格",
    "修改配色",
    "精简每页文案",
  ])("reuses the approved outline for non-structural request: %s", (message) => {
    expect(isStructureChangingRevision(message)).toBe(false);
  });
});
