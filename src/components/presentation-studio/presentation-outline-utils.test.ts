import { describe, expect, it } from "vitest";
import { emptyOutline, formatSlideNotes, getCompleteOutline, toApprovedOutline, toSlideItem, toStreamingSlideItem } from "./presentation-outline-utils";
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

  it("formats notes before streamed key points arrive", () => {
    expect(formatSlideNotes({ purpose: "Show urgency" })).toBe("Show urgency");
  });

  it("does not promote a partial streamed slide to an approvable outline", () => {
    const partial = { ...baseOutline, slides: [{ pageNumber: 1, title: "Market" }] };

    expect(getCompleteOutline(partial)).toBeNull();
    expect(toStreamingSlideItem(partial.slides[0], 0)).toMatchObject({
      title: "Market",
      keyPoints: [],
    });
  });

  it("switches to a complete outline once all streamed fields arrive", () => {
    expect(getCompleteOutline(baseOutline)).toEqual(baseOutline);
    expect(toStreamingSlideItem(baseOutline.slides[0], 0)).toEqual(toSlideItem(baseOutline.slides[0]));
  });

  it.each([null, {}, { keyPoints: null }, { keyPoints: "unfinished" }])("renders incomplete stream values safely: %j", (value) => {
    // JSON transport can carry incomplete shapes before schema validation.
    const slide = JSON.parse(JSON.stringify(value));
    expect(toStreamingSlideItem(slide, 1)).toMatchObject({
      title: "Drafting slide 2...",
      keyPoints: [],
    });
    expect(getCompleteOutline({ ...baseOutline, slides: [slide] })).toBeNull();
  });

  it("renders streamed key points without exposing null entries", () => {
    const slide = JSON.parse('{"title":"Market","keyPoints":["First point",null]}');
    expect(toStreamingSlideItem(slide, 0).keyPoints).toEqual(["First point"]);
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
