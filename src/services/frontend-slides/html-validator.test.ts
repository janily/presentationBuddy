import { describe, expect, it } from "vitest";
import {
  assertFrontendSlidesComplete,
  assertFrontendSlidesDocument,
  countGeneratedSlides,
  completeMissingFrontendSlides,
  extractHtmlFromAgentResult,
  stripHtmlCodeFence,
} from "./html-validator";

const validHtml = `<!doctype html>
<html>
<head>
  <style>
    .stage { width: 1920px; height: 1080px; }
    .slide { visibility: hidden; opacity: 0; pointer-events: none; }
    .slide.active { visibility: visible; opacity: 1; pointer-events: auto; }
  </style>
</head>
<body>
  <section class="slide active">One</section>
  <section class="slide">Two</section>
</body>
</html>`;

describe("frontend-slides html validator", () => {
  it("extracts complete HTML from fenced or mixed model output", () => {
    expect(extractHtmlFromAgentResult(`Here:\n\`\`\`html\n${validHtml}\n\`\`\``)).toBe(validHtml);
    expect(extractHtmlFromAgentResult(`Generated:\n${validHtml}\nDone.`)).toBe(validHtml);
  });

  it("strips markdown fences", () => {
    expect(stripHtmlCodeFence("```html\n<html></html>\n```")).toBe("<html></html>");
  });

  it("counts generated slides by section or slide class", () => {
    expect(countGeneratedSlides(validHtml)).toBe(2);
  });

  it("accepts valid frontend-slides documents", () => {
    expect(() => assertFrontendSlidesDocument(validHtml, 2)).not.toThrow();
  });

  it("rejects documents with too few slides", () => {
    expect(() => assertFrontendSlidesComplete(validHtml, 3)).toThrow("only contains 2 slide");
  });

  it("completes missing trailing slides from the approved outline", () => {
    const completed = completeMissingFrontendSlides(validHtml, [
      { title: "One", content: "First" },
      { title: "Two", content: "Second" },
      { title: "Three <final>", content: "Third & final" },
    ]);

    expect(countGeneratedSlides(completed)).toBe(3);
    expect(completed).toContain("Three &lt;final&gt;");
    expect(completed).toContain("Third &amp; final");
    expect(() => assertFrontendSlidesDocument(completed, 3)).not.toThrow();
  });

  it("does not alter a complete frontend-slides document", () => {
    expect(completeMissingFrontendSlides(validHtml, [
      { title: "One", content: "First" },
      { title: "Two", content: "Second" },
    ])).toBe(validHtml);
  });

  it("repairs a model response truncated after valid slide markup", () => {
    const truncatedHtml = validHtml.replace(/<section class="slide">Two<\/section>[\s\S]*$/, "");
    const completed = completeMissingFrontendSlides(truncatedHtml, [
      { title: "One", content: "First" },
      { title: "Two", content: "Second" },
      { title: "Three", content: "Third" },
    ]);

    expect(completed).toMatch(/<\/body>\s*<\/html>\s*$/);
    expect(countGeneratedSlides(completed)).toBe(3);
    expect(() => assertFrontendSlidesDocument(completed, 3)).not.toThrow();
  });

  it("rejects display none slide switching", () => {
    const invalidHtml = validHtml.replace(
      ".slide { visibility: hidden; opacity: 0; pointer-events: none; }",
      ".slide { display: none; visibility: hidden; opacity: 0; pointer-events: none; }",
    );

    expect(() => assertFrontendSlidesDocument(invalidHtml, 2)).toThrow("display none/block");
  });
});
