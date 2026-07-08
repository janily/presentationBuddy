import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFrontendSlidesPrompt,
  extractHtmlFromFrontendSlidesResponse,
  invokeFrontendSlidesSkill,
  isFrontendSlidesConfigured,
} from "./frontend-slides-invoker";
import type { FrontendSlidesInput } from "./outline-to-slides-mapper";

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
  ],
};

describe("frontend-slides invoker", () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  const originalBaseUrl = process.env.ANTHROPIC_BASE_URL;
  const originalModel = process.env.ANTHROPIC_MODEL;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.ANTHROPIC_MODEL;
  });

  afterEach(() => {
    process.env.ANTHROPIC_API_KEY = originalApiKey;
    process.env.ANTHROPIC_BASE_URL = originalBaseUrl;
    process.env.ANTHROPIC_MODEL = originalModel;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("builds a frontend-slides prompt from structured outline data", () => {
    const prompt = buildFrontendSlidesPrompt(input);

    expect(prompt).toContain("Use the frontend-slides skill");
    expect(prompt).toContain("Presentation title: AI Strategy Brief");
    expect(prompt).toContain("Layout hint: title");
    expect(prompt).toContain("Do not load Google Fonts");
  });

  it("extracts HTML from a fenced response", () => {
    const html = extractHtmlFromFrontendSlidesResponse({
      content: [
        {
          type: "text",
          text: "```html\n<!doctype html><html><body>Deck</body></html>\n```",
        },
      ],
    });

    expect(html).toBe("<!doctype html><html><body>Deck</body></html>");
  });

  it("extracts HTML from plain text response content", () => {
    const html = extractHtmlFromFrontendSlidesResponse({
      content: [
        {
          type: "text",
          text: "Here is the deck:\n<html><body>Deck</body></html>",
        },
      ],
    });

    expect(html).toBe("<html><body>Deck</body></html>");
  });

  it("throws when no API key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    expect(isFrontendSlidesConfigured()).toBe(false);
    await expect(invokeFrontendSlidesSkill(input)).rejects.toThrow("ANTHROPIC_API_KEY");
  });

  it("posts to the configured Anthropic-compatible endpoint and returns HTML", async () => {
    process.env.ANTHROPIC_BASE_URL = "https://anthropic-proxy.example";
    process.env.ANTHROPIC_MODEL = "custom-claude";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: "text",
            text: "<!doctype html><html><body>AI Strategy Brief</body></html>",
          },
        ],
      }),
    });
    globalThis.fetch = fetchMock;

    const result = await invokeFrontendSlidesSkill(input);

    expect(result.html).toContain("AI Strategy Brief");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://anthropic-proxy.example/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "test-key",
          "anthropic-version": "2023-06-01",
        }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("custom-claude");
  });

  it("throws a useful error when the API request fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "invalid api key",
    });

    await expect(invokeFrontendSlidesSkill(input)).rejects.toThrow("frontend-slides request failed with 401");
  });
});
