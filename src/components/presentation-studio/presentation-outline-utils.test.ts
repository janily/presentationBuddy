import { describe, expect, it } from "vitest";
import { emptyOutline, formatSlideNotes, toApprovedOutline, toSlideItem } from "./presentation-outline-utils";
import type { PresentationOutlineData } from "@/src/types/presentation-workflow";

describe("presentation outline utilities", () => {
  const baseOutline: PresentationOutlineData = {
    title: "AI Strategy",
    narrativeGoal: "Explain strategy",
    sections: ["Intro"],
    designGuidance: ["Use bold charts"],
    slides: [
      {
        pageNumber: 2,
        title: "Market Shift",
        purpose: "Show urgency",
        keyPoints: ["Budgets are moving", "Teams need governance"],
        designSuggestion: "Timeline visual",
      },
    ],
  };

  it("creates an empty outline from a brief", () => {
    expect(emptyOutline({ topic: "Roadmap", audience: "executives", slideCount: 5, style: "concise", requirements: "" })).toEqual({
      title: "Roadmap",
      narrativeGoal: "Create a concise presentation for executives.",
      sections: [],
      slides: [],
      designGuidance: [],
    });
  });

  it("converts generated slides to selected editable slide items", () => {
    const item = toSlideItem(baseOutline.slides[0]);

    expect(item).toMatchObject({
      id: "2-Market Shift",
      selected: true,
      title: "Market Shift",
      notes: "Show urgency Budgets are moving Teams need governance Timeline visual",
      originalNotes: "Show urgency Budgets are moving Teams need governance Timeline visual",
    });
    expect(item.keyPoints).toEqual(["Budgets are moving", "Teams need governance"]);
  });

  it("formats notes without empty optional text", () => {
    expect(formatSlideNotes({ purpose: "Purpose", keyPoints: ["Point"], designSuggestion: "" })).toBe("Purpose Point");
  });

  it("converts selected edited items back to an approved outline", () => {
    const approved = toApprovedOutline(baseOutline, [
      {
        id: "a",
        title: "Edited",
        notes: "User wants a customer example",
        originalNotes: "Original notes",
        selected: true,
        purpose: "",
        keyPoints: ["Existing point"],
        designSuggestion: "",
      },
      {
        id: "b",
        title: "Excluded",
        notes: "Do not include",
        selected: false,
      },
    ]);

    expect(approved.slides).toEqual([
      {
        pageNumber: 1,
        title: "Edited",
        purpose: "User wants a customer example",
        keyPoints: ["Existing point", "User notes: User wants a customer example"],
        designSuggestion: "Use bold charts",
      },
    ]);
  });
});
