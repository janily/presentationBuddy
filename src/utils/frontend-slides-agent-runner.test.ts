import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertFrontendSlidesComplete,
  buildFrontendSlidesAgentPrompt,
  countGeneratedSlides,
  extractHtmlFromAgentResult,
  invokeFrontendSlidesAgent,
  isFrontendSlidesAgentConfigured,
} from "./frontend-slides-agent-runner";
import type { FrontendSlidesInput } from "./outline-to-slides-mapper";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: queryMock,
}));

const input: FrontendSlidesInput = {
  title: "AI Strategy Brief",
  style: "business modern",
  narrativeGoal: "Help executives choose the next AI investment.",
  designGuidance: ["Use restrained executive visuals"],
  slides: [
    {
      title: "Intro",
      layout: "title",
      content: "Core message:\nFrame the strategic decision.",
    },
    {
      title: "Portfolio choices",
      layout: "content",
      content: "Core message:\nCompare options.",
    },
  ],
};

describe("frontend-slides agent runner helpers", () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalApiKey;
    queryMock.mockReset();
  });

  it("detects whether the agent can be configured from ANTHROPIC_API_KEY", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(isFrontendSlidesAgentConfigured()).toBe(false);

    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(isFrontendSlidesAgentConfigured()).toBe(true);
  });

  it("builds a headless prompt that requires the approved slide count", () => {
    const prompt = buildFrontendSlidesAgentPrompt(input);

    expect(prompt).toContain("headless server-side generation task");
    expect(prompt).toContain("Required slide count: 2");
    expect(prompt).toContain("Do not ask follow-up questions");
    expect(prompt).toContain("Slide 2: Portfolio choices");
  });

  it("extracts HTML from fenced or plain agent results", () => {
    expect(extractHtmlFromAgentResult("```html\n<!doctype html><html><body>Deck</body></html>\n```"))
      .toBe("<!doctype html><html><body>Deck</body></html>");

    expect(extractHtmlFromAgentResult("Done:\n<html><body>Deck</body></html>"))
      .toBe("<html><body>Deck</body></html>");
  });

  it("counts section slides and frontend-slides class slides", () => {
    expect(countGeneratedSlides("<section>One</section><section>Two</section>")).toBe(2);
    expect(countGeneratedSlides('<div class="slide active"></div><div class="chapter slide"></div>')).toBe(2);
  });

  it("fails incomplete HTML output before it can be saved", () => {
    expect(() => assertFrontendSlidesComplete("<section>Only one</section>", 2))
      .toThrow("only contains 1 slide(s), expected 2");
  });

  it("reports friendly progress events while invoking the agent", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    queryMock.mockReturnValue((async function* () {
      yield {
        type: "assistant",
        message: { content: [{ type: "text", text: "Working" }] },
      };
      yield {
        type: "result",
        subtype: "success",
        result: "<!doctype html><html><body><section>One</section><section>Two</section></body></html>",
      };
    })());

    const progress: string[] = [];
    const result = await invokeFrontendSlidesAgent(input, {
      onProgress: (event) => progress.push(event.stage),
    });

    expect(result.html).toContain("<!doctype html>");
    expect(progress).toContain("load-skill");
    expect(progress).toContain("compose");
    expect(progress).toContain("validate");
  });
});
