import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PresentationWorkspace from "./presentation-workspace";

describe("responsive workspace", () => {
  it("bounds both mobile panels within the dynamic viewport instead of auto-sized overflowing rows", () => {
    const html = renderToStaticMarkup(createElement(PresentationWorkspace, { previewContent: "Preview", agentContent: "Chat" }));
    expect(html).toContain("h-dvh");
    expect(html).toContain("grid-rows-[minmax(0,0.8fr)_minmax(0,1fr)]");
    expect(html).toContain("lg:grid-rows-1");
    expect(html).toContain('aria-label="演示预览"');
    expect(html).toContain('aria-label="AI 助手"');
  });
});
