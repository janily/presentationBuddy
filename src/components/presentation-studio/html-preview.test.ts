import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HtmlPreview from "./html-preview";
import PresentationPreviewPane from "./presentation-preview-pane";

describe("HTML preview boundaries", () => {
  it("runs deck navigation scripts without granting access to the studio origin", () => {
    const markup = renderToStaticMarkup(createElement(HtmlPreview, { html: "<html>deck</html>" }));
    expect(markup).toContain('sandbox="allow-scripts"');
    expect(markup).not.toContain("allow-same-origin");
    expect(markup).toContain('referrerPolicy="no-referrer"');
    expect(markup).toContain("下载 HTML");
  });

  it("keeps the same root and preview child across revision progress transitions", () => {
    const base = { outline: [], html: "<html>deck</html>", preservePreviewDuringGeneration: true };
    const preview = PresentationPreviewPane({ ...base, step: "preview" });
    const revising = PresentationPreviewPane({ ...base, step: "generating" });
    expect(preview.type).toBe(revising.type);
    const firstChild = (element: typeof preview) => {
      const children = element.props.children;
      return Array.isArray(children) ? children[0] : children;
    };
    expect(firstChild(preview).type).toBe(firstChild(revising).type);
  });
});
