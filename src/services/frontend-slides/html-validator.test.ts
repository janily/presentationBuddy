import { describe, expect, it } from "vitest";
import {
  assertFrontendSlidesComplete,
  assertFrontendSlidesDocument,
  countGeneratedSlides,
  extractHtmlFromAgentResult,
  stripHtmlCodeFence,
} from "./html-validator";
import { ensureFrontendSlidesStyleContract } from "./style-contract";

const validHtml = `<!doctype html>
<html>
<head>
  <style>
    .deck-viewport { position: fixed; inset: 0; }
    .deck-stage { width: 100vw; height: 100dvh; }
    .slide { visibility: hidden; opacity: 0; pointer-events: none; }
    .slide.active { visibility: visible; opacity: 1; pointer-events: auto; }
    @media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; } }
  </style>
</head>
<body>
  <div class="deck-viewport">
    <main class="deck-stage" id="deckStage">
      <section class="slide active">One</section>
      <section class="slide">Two</section>
    </main>
  </div>
  <script>
    document.addEventListener('keydown', () => {});
  </script>
</body>
</html>`;

const studioStyle = {
  id: "bold-template-studio",
  name: "Studio",
  source: "frontend-slides-bold-template" as const,
  vibe: "electric",
  layout: "black and acid yellow",
  typography: { display: "Barlow", body: "IBM Plex Mono" },
  palette: { background: "#1C1C1C", surface: "#242422", text: "#F5D200", accent: "#F5D200", secondary: "#2E2E2C" },
  signatureElements: ["type-as-graphic-mass"],
};

const neoGridStyle = {
  id: "bold-template-neo-grid-bold",
  name: "Neo-Grid Bold",
  source: "frontend-slides-bold-template" as const,
  vibe: "confident editorial",
  layout: "12-column by 8-row grid",
  typography: { display: "Space Grotesk", body: "Space Grotesk" },
  palette: { background: "#ECECE8", surface: "#F5F4EF", text: "#0A0A0A", accent: "#E6FF3D", secondary: "#8A8A85" },
  signatureElements: ["dense 12-column by 8-row panel grid"],
};

describe("frontend-slides html validator", () => {
  it.each(["", "   \n\t  "])("reports empty agent output separately: %j", (output) => {
    expect(() => extractHtmlFromAgentResult(output)).toThrow(
      "frontend-slides agent returned empty output (stream may have been aborted or truncated)",
    );
  });

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

  it("does not count slide-prefixed helper classes as additional slides", () => {
    const htmlWithHelperClasses = validHtml
      .replace("One</section>", '<div class="slide-content">One</div></section>')
      .replace("Two</section>", '<div class="slide-number">Two</div></section>');

    expect(countGeneratedSlides(htmlWithHelperClasses)).toBe(2);
    expect(() => assertFrontendSlidesComplete(htmlWithHelperClasses, 2)).not.toThrow();
  });

  it("accepts valid frontend-slides documents", () => {
    expect(() => assertFrontendSlidesDocument(validHtml, 2)).not.toThrow();
  });

  it("does not require fixed dimensions or stage scaling", () => {
    expect(validHtml).not.toContain("1920");
    expect(validHtml).not.toContain("1080");
    expect(validHtml).not.toContain("Math.min");
    expect(() => assertFrontendSlidesDocument(validHtml, 2)).not.toThrow();
  });

  it("rejects a generated deck that does not contain the selected style's core visual tokens", () => {
    expect(() => assertFrontendSlidesDocument(validHtml, 2, studioStyle)).toThrow(
      "selected style contract",
    );

    const tokenOnlyHtml = validHtml.replace(
      "<style>",
      "<style>\n/* Studio #1C1C1C #F5D200 Barlow IBM Plex Mono */",
    );
    expect(() => assertFrontendSlidesDocument(tokenOnlyHtml, 2, studioStyle)).toThrow(
      "selected style contract",
    );

    const styledHtml = validHtml
      .replace(
        "<style>",
        `<style>
    :root {
      --presentation-style-background: #1C1C1C;
      --presentation-style-accent: #F5D200;
      --presentation-style-display-font: "Barlow";
      --presentation-style-body-font: "IBM Plex Mono";
    }
    .deck-stage { background: var(--presentation-style-background); color: var(--presentation-style-accent); font-family: var(--presentation-style-body-font); }
    .slide h1, .slide h2 { font-family: var(--presentation-style-display-font); }`,
      )
      .replace('class="deck-stage"', 'class="deck-stage" data-presentation-style="bold-template-studio"');
    expect(() => assertFrontendSlidesDocument(styledHtml, 2, studioStyle)).not.toThrow();
  });

  it("requires Neo-Grid Bold to implement the grid promised by its preview", () => {
    const styledHtml = validHtml
      .replace(
        "<style>",
        `<style>
    :root {
      --presentation-style-background: #ECECE8;
      --presentation-style-accent: #E6FF3D;
      --presentation-style-display-font: "Space Grotesk";
      --presentation-style-body-font: "Space Grotesk";
    }
    .deck-stage { background: var(--presentation-style-background); font-family: var(--presentation-style-body-font); }
    .slide h1, .slide h2 { color: var(--presentation-style-accent); font-family: var(--presentation-style-display-font); }`,
      )
      .replace('class="deck-stage"', 'class="deck-stage" data-presentation-style="bold-template-neo-grid-bold"');

    expect(() => assertFrontendSlidesDocument(styledHtml, 2, neoGridStyle)).toThrow(
      "missing visual grammar 12-column grid, 8-row grid, 12px grid gap",
    );

    const gridHtml = styledHtml.replace(
      ".slide { visibility: hidden; opacity: 0; pointer-events: none; }",
      ".neo-grid-frame { display: grid; grid-template-columns: repeat(12, 1fr); grid-template-rows: repeat(8, 1fr); gap: 12px; }\n    .slide { visibility: hidden; opacity: 0; pointer-events: none; }",
    );
    expect(() => assertFrontendSlidesDocument(gridHtml, 2, neoGridStyle)).not.toThrow();
  });

  it("requires an exact slide class token even when section fallback can count pages", () => {
    const helperClassesOnly = validHtml.replaceAll(
      'class="slide',
      'data-class="slide" class="slide-content',
    );

    expect(countGeneratedSlides(helperClassesOnly)).toBe(2);
    expect(() => assertFrontendSlidesDocument(helperClassesOnly, 2)).toThrow("missing frontend-slides .slide elements");
  });

  it("rejects documents with too few slides", () => {
    expect(() => assertFrontendSlidesComplete(validHtml, 3)).toThrow("contains 2 slide(s), expected exactly 3");
  });

  it("rejects documents with more slides than the approved outline", () => {
    const extraSlide = validHtml.replace("</body>", '<section class="slide">Three</section>\n</body>');
    expect(() => assertFrontendSlidesComplete(extraSlide, 2)).toThrow("expected exactly 2");
  });

  it("rejects truncated documents even when their slide count matches", () => {
    const truncatedHtml = validHtml.replace(/<\/body>[\s\S]*$/, "");
    expect(() => assertFrontendSlidesDocument(truncatedHtml, 2)).toThrow("truncated");
    expect(() => extractHtmlFromAgentResult(truncatedHtml)).toThrow("Failed to extract HTML");
  });

  it("rejects display none slide switching", () => {
    const invalidHtml = validHtml.replace(
      ".slide { visibility: hidden; opacity: 0; pointer-events: none; }",
      ".slide { display: none; visibility: hidden; opacity: 0; pointer-events: none; }",
    );

    expect(() => assertFrontendSlidesDocument(invalidHtml, 2)).toThrow("display none/block");
  });

  it("rejects documents without keyboard navigation", () => {
    expect(() => assertFrontendSlidesDocument(validHtml.replace("keydown", "keyup"), 2)).toThrow("keyboard navigation");
  });

  it("rejects external presentation controllers", () => {
    const externalScriptHtml = validHtml.replace("<script>", '<script src="deck.js"></script><script>');
    expect(() => assertFrontendSlidesDocument(externalScriptHtml, 2)).toThrow("external script");
  });
});
