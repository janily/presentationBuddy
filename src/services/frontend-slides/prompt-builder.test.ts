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
    expect(prompt).toContain("exact whitespace-delimited `slide` class token");
    expect(prompt).toContain("`slide-content` or `slide-number` do not count as slide roots");
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

  it("includes the selected bold template design recipe when present", () => {
    const prompt = buildFrontendSlidesMastraPrompt(
      {
        title: "Market Update",
        narrativeGoal: "Brief executives",
        style: "Blue Professional",
        designGuidance: [],
        slides: [{ title: "Intro", content: "Welcome", layout: "title" }],
        styleSpec: {
          id: "bold-template-blue-professional",
          name: "Blue Professional",
          source: "frontend-slides-bold-template",
          vibe: "professional",
          layout: "Cream paper background with electric cobalt blue accents",
          typography: { display: "Space Grotesk", body: "Inter" },
          palette: { background: "#fdfae7", surface: "#f4f1e8", text: "#111111", accent: "#1e2bfa", secondary: "#6b6b6b" },
          signatureElements: ["executive report structure"],
          boldTemplate: {
            slug: "blue-professional",
            tagline: "Cream paper background with electric cobalt blue accents; clean modern professional.",
            mood: ["professional"],
            tone: ["clean"],
            formality: "medium-high",
            density: "medium",
            scheme: "light",
            bestFor: "Executive briefings",
            avoidFor: "Playful decks",
            previewMd: "bold-template-pack/templates/blue-professional/preview.md",
            designMd: "bold-template-pack/templates/blue-professional/design.md",
          },
        },
      },
      {
        skill: "rules",
        htmlTemplate: "template",
        viewportBaseCss: "viewport",
        animationPatterns: "motion",
        boldTemplateDesign: {
          name: "Blue Professional",
          slug: "blue-professional",
          path: "bold-template-pack/templates/blue-professional/design.md",
          content: "Use warm cream canvas and saturated cobalt accents.",
        },
      },
    );

    expect(prompt).toContain("Selected bold template design recipe (NON-NEGOTIABLE)");
    expect(prompt).toContain("frontend-slides/bold-template-pack/templates/blue-professional/design.md");
    expect(prompt).toContain("Use warm cream canvas and saturated cobalt accents.");
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
    expect(prompt).toContain("exactly 10 complete slide roots");
    expect(prompt).toContain("`slide-content` and `slide-number` are helper classes");
    expect(prompt).toContain("frontend-slides/SKILL.md");
  });
});
