import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AgentMarkdown from "./agent-markdown";

describe("AgentMarkdown", () => {
  it("renders the formatting used in agent clarification messages", () => {
    const html = renderToStaticMarkup(createElement(
      AgentMarkdown,
      null,
      `**受众**：开发者\n\n1. **页数**：15 页\n2. 使用 \`Mastra\``,
    ));

    expect(html).toContain("<strong");
    expect(html).toContain("受众</strong>");
    expect(html).toContain("<ol");
    expect(html).toContain("<code");
  });

  it("does not render raw HTML from model output", () => {
    const html = renderToStaticMarkup(createElement(
      AgentMarkdown,
      null,
      `<script>alert("unsafe")</script>`,
    ));

    expect(html).not.toContain("<script>");
  });
});
