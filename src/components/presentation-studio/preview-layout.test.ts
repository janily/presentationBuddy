import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HtmlPreview from "./html-preview";
import PresentationPreviewPane from "./presentation-preview-pane";

describe("preview viewport contract", () => {
  // These are component structure checks, not a substitute for browser layout tests.
  for (const step of ["brief", "outlining", "review", "generating", "preview"] as const) {
    it(`${step} does not impose a minimum taller than its workspace row`, () => {
      const markup = renderToStaticMarkup(createElement(PresentationPreviewPane, { step, outline: [], html: "<html>deck</html>" }));
      const rootClasses = markup.match(/^<div class="([^"]+)"/)?.[1];
      expect(rootClasses).toContain("min-h-0");
      expect(rootClasses).not.toMatch(/min-h-\[/);
    });
  }
  it("lets the iframe fill the remaining space below a non-shrinking toolbar", () => {
    const markup = renderToStaticMarkup(createElement(HtmlPreview, { html: "<html>deck</html>" }));
    expect(markup).not.toContain("min-h-[620px]");
    expect(markup).toContain("shrink-0");
    expect(markup).toContain("w-full min-h-0 flex-1");
  });
  it("keeps style discovery scrollable inside its row and describes static samples accurately", () => {
    const markup = renderToStaticMarkup(createElement(PresentationPreviewPane, { outline: [], isDiscoveringStyles: true }));
    expect(markup).toContain("h-full min-h-0 overflow-auto");
    expect(markup).toContain("静态示例");
    expect(markup).not.toContain("按当前演示主题生成的标题页");
  });
});
