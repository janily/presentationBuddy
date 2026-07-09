import { describe, expect, it } from "vitest";
import { buildFrontendSlidesMastraPrompt } from "./prompt-builder";

describe("buildFrontendSlidesMastraPrompt", () => {
  it("includes the approved outline and mandatory frontend-slides context", () => {
    const prompt = buildFrontendSlidesMastraPrompt(
      {
        title: "Demo Deck",
        style: "editorial",
        narrativeGoal: "Explain the plan",
        designGuidance: ["Use confident typography"],
        slides: [
          {
            title: "Opening",
            layout: "title",
            content: "Core message:\nStart here",
          },
        ],
      },
      {
        skill: "Fixed 16:9 Stage",
        htmlTemplate: "<!doctype html>",
        viewportBaseCss: ".slide { visibility: hidden; }",
        animationPatterns: "@keyframes enter {}",
        stylePresets: "Swiss Modern",
      },
    );

    expect(prompt).toContain("Demo Deck");
    expect(prompt).toContain("Slide 1: Opening");
    expect(prompt).toContain("fixed 1920x1080 stage");
    expect(prompt).toContain("Fixed 16:9 Stage");
    expect(prompt).toContain(".slide { visibility: hidden; }");
    expect(prompt).toContain("Swiss Modern");
  });
});
