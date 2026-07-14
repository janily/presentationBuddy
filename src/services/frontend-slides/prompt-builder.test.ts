import { describe, expect, it } from "vitest";
import { buildFrontendSlidesMastraPrompt, buildFrontendSlidesRepairPrompt } from "./prompt-builder";

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

  it("locks generation to the selected frontend-slides design contract", () => {
    const prompt = buildFrontendSlidesMastraPrompt(
      {
        title: "Mastra",
        narrativeGoal: "Teach agents",
        style: "Terminal Green",
        designGuidance: [],
        slides: [{ title: "Intro", content: "Welcome", layout: "title" }],
        density: "reading-first",
        styleSpec: {
          id: "terminal-green",
          name: "Terminal Green",
          source: "frontend-slides-preset",
          vibe: "developer-focused",
          layout: "terminal",
          typography: { display: "JetBrains Mono", body: "JetBrains Mono" },
          palette: { background: "#0d1117", surface: "#161b22", text: "#e6edf3", accent: "#39d353", secondary: "#58a6ff" },
          signatureElements: ["scan lines", "blinking cursor"],
        },
      },
      { skill: "rules", htmlTemplate: "template", viewportBaseCss: "viewport", animationPatterns: "motion" },
    );

    expect(prompt).toContain("Selected style contract (NON-NEGOTIABLE)");
    expect(prompt).toContain('"id": "terminal-green"');
    expect(prompt).toContain("Content density: reading-first");
  });

  it("applies a confirmed content revision without turning it into a style request", () => {
    const prompt = buildFrontendSlidesMastraPrompt(
      {
        title: "Mastra",
        narrativeGoal: "Teach workflows",
        style: "Paper & Ink",
        designGuidance: [],
        slides: [{ title: "Workflow", content: "Existing content", layout: "content" }],
        revisionInstruction: "丰富第 1 页的 Workflow 实战示例",
        revisionTargetSlides: [1],
      },
      { skill: "rules", htmlTemplate: "template", viewportBaseCss: "viewport", animationPatterns: "motion" },
    );

    expect(prompt).toContain("Requested style: Paper & Ink");
    expect(prompt).toContain("Confirmed revision (NON-NEGOTIABLE)");
    expect(prompt).toContain("丰富第 1 页的 Workflow 实战示例");
    expect(prompt).toContain("Apply it specifically to slide(s): 1");
    expect(prompt).toContain("Do not reinterpret this content revision as a request to change the visual style");
  });

  it("builds a full frontend-slides regeneration prompt after validation failure", () => {
    const prompt = buildFrontendSlidesRepairPrompt(
      {
        title: "Ten Slides",
        narrativeGoal: "Complete the deck",
        style: "Swiss Modern",
        designGuidance: [],
        slides: Array.from({ length: 10 }, (_, index) => ({
          title: `Slide ${index + 1}`,
          content: `Content ${index + 1}`,
          layout: "content" as const,
        })),
      },
      { skill: "rules", htmlTemplate: "template", viewportBaseCss: "viewport", animationPatterns: "motion" },
      "output contains 4 slide(s), expected exactly 10",
    );

    expect(prompt).toContain("previous frontend-slides generation attempt failed before producing valid output");
    expect(prompt).toContain("exactly 10 complete .slide elements");
    expect(prompt).toContain("frontend-slides/SKILL.md");
  });
});
