import { describe, expect, it } from "vitest";
import { mapOutlineToFrontendSlides } from "./outline-to-slides-mapper";
import type { PresentationOutlineData } from "@/src/types/presentation-workflow";

const outline: PresentationOutlineData = {
  title: "AI Strategy Brief",
  narrativeGoal: "Help executives choose the next AI investment.",
  sections: ["Context", "Plan", "Decision"],
  designGuidance: ["Use a restrained executive visual style"],
  slides: [
    {
      pageNumber: 1,
      title: "Intro",
      purpose: "Frame the strategic decision.",
      keyPoints: ["Market changed quickly", "Timing matters"],
      designSuggestion: "Bold title treatment",
    },
    {
      pageNumber: 2,
      title: "Operating Model",
      purpose: "Show how teams will use AI.",
      keyPoints: ["Governance", "Enablement", "Measurement", "Security"],
      designSuggestion: "Two-column comparison",
    },
    {
      pageNumber: 3,
      title: "Conclusion",
      purpose: "Ask for approval.",
      keyPoints: ["Approve pilot", "Review in 90 days"],
      designSuggestion: "Confident closing slide",
    },
  ],
};

describe("mapOutlineToFrontendSlides", () => {
  it("preserves presentation metadata and applies the requested style", () => {
    const result = mapOutlineToFrontendSlides(outline, "business modern");

    expect(result).toMatchObject({
      title: "AI Strategy Brief",
      style: "business modern",
      narrativeGoal: "Help executives choose the next AI investment.",
      designGuidance: ["Use a restrained executive visual style"],
    });
  });

  it("formats slide content for the generator prompt", () => {
    const result = mapOutlineToFrontendSlides(outline);

    expect(result.slides[1].content).toContain("Core message:\nShow how teams will use AI.");
    expect(result.slides[1].content).toContain("- Governance");
    expect(result.slides[1].content).toContain("Design direction:\nTwo-column comparison");
  });

  it("infers useful layout hints from slide position and density", () => {
    const result = mapOutlineToFrontendSlides(outline);

    expect(result.slides.map((slide) => slide.layout)).toEqual([
      "title",
      "split",
      "quote",
    ]);
  });
});
