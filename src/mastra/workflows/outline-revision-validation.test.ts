import { describe, expect, it } from "vitest";
import { validateOutlineRevisionResult } from "./outline-revision-validation";

const currentOutline = {
  title: "Mastra",
  narrativeGoal: "Teach workflows",
  sections: ["Intro"],
  slides: [
    { pageNumber: 1, title: "Intro", purpose: "Open", keyPoints: ["A"], designSuggestion: "Clean" },
    { pageNumber: 2, title: "Agents", purpose: "Explain", keyPoints: ["B"], designSuggestion: "Diagram" },
    { pageNumber: 3, title: "Summary", purpose: "Close", keyPoints: ["C"], designSuggestion: "Quote" },
  ],
  designGuidance: ["Paper & Ink"],
};

describe("outline revision validation", () => {
  it("accepts a sequential outline with the confirmed slide count and a real diff", () => {
    expect(() => validateOutlineRevisionResult({
      currentOutline,
      revisedOutline: {
        ...currentOutline,
        slides: [
          currentOutline.slides[0],
          currentOutline.slides[1],
          { pageNumber: 3, title: "Workflow Lab", purpose: "Practice", keyPoints: ["Build"], designSuggestion: "Steps" },
          { ...currentOutline.slides[2], pageNumber: 4 },
        ],
      },
      expectedSlideCount: 4,
      targetSlides: [3],
    })).not.toThrow();
  });

  it("rejects a revision with the wrong slide count", () => {
    expect(() => validateOutlineRevisionResult({
      currentOutline,
      revisedOutline: currentOutline,
      expectedSlideCount: 4,
    })).toThrow(/expected exactly 4/i);
  });

  it("rejects non-sequential page numbers", () => {
    expect(() => validateOutlineRevisionResult({
      currentOutline,
      revisedOutline: {
        ...currentOutline,
        narrativeGoal: "Updated",
        slides: currentOutline.slides.map((slide, index) => ({ ...slide, pageNumber: index + 2 })),
      },
      expectedSlideCount: 3,
    })).toThrow(/sequential/i);
  });

  it("rejects a no-op structural revision", () => {
    expect(() => validateOutlineRevisionResult({
      currentOutline,
      revisedOutline: currentOutline,
      expectedSlideCount: 3,
    })).toThrow(/did not change/i);
  });
});
