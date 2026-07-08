import type { FrontendSlidesInput } from "./outline-to-slides-mapper";

type AnthropicTextBlock = {
  type: "text";
  text: string;
};

type AnthropicMessageResponse = {
  content: Array<AnthropicTextBlock | { type: string; [key: string]: unknown }>;
};

export type FrontendSlidesResult = {
  html: string;
};

const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";
const DEFAULT_FRONTEND_SLIDES_MODEL = "claude-3-5-sonnet-latest";

export function isFrontendSlidesConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function buildFrontendSlidesPrompt(input: FrontendSlidesInput) {
  const slides = input.slides
    .map((slide, index) => {
      return [
        `Slide ${index + 1}: ${slide.title}`,
        `Layout hint: ${slide.layout}`,
        slide.content,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  return `Use the frontend-slides skill to generate a polished, standalone HTML presentation.

Presentation title: ${input.title}
Narrative goal: ${input.narrativeGoal}
Requested style: ${input.style}
Slide count: ${input.slides.length}
Design guidance:
${input.designGuidance.map((item) => `- ${item}`).join("\n") || "- Create a refined, presentation-ready visual system."}

Approved outline:
${slides}

Requirements:
- Generate a complete standalone HTML document.
- Prefer a Reveal.js-style presentation structure with one section per slide.
- Include rich but tasteful animations and transitions.
- Keep all CSS and JavaScript embedded in the HTML document.
- Do not load Google Fonts or external font assets.
- Keep text readable and avoid overcrowded slides.
- Return only the complete HTML document, starting with <!doctype html> or <html>.`;
}

export function extractHtmlFromFrontendSlidesResponse(response: AnthropicMessageResponse) {
  const content = response.content
    .filter((block): block is AnthropicTextBlock => block.type === "text" && typeof (block as AnthropicTextBlock).text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();

  const fencedMatch = content.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const htmlMatch = content.match(/(?:<!doctype html>|<html[\s>])[\s\S]*<\/html>/i);
  if (htmlMatch?.[0]) {
    return htmlMatch[0].trim();
  }

  throw new Error("Failed to extract HTML from frontend-slides response");
}

function getMessagesEndpoint(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/v1/messages`;
}

export async function invokeFrontendSlidesSkill(
  input: FrontendSlidesInput,
): Promise<FrontendSlidesResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!isFrontendSlidesConfigured() || !apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required to invoke frontend-slides");
  }

  const baseUrl = process.env.ANTHROPIC_BASE_URL || DEFAULT_ANTHROPIC_BASE_URL;
  const model = process.env.ANTHROPIC_MODEL || process.env.FRONTEND_SLIDES_MODEL || DEFAULT_FRONTEND_SLIDES_MODEL;
  const prompt = buildFrontendSlidesPrompt(input);

  console.log("Invoking frontend-slides generator:", {
    title: input.title,
    slideCount: input.slides.length,
    style: input.style,
    model,
    baseUrl,
  });

  const response = await fetch(getMessagesEndpoint(baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "Authorization": `Bearer ${apiKey}`,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: Number(process.env.FRONTEND_SLIDES_MAX_TOKENS || 16_000),
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`frontend-slides request failed with ${response.status}: ${body.slice(0, 500)}`);
  }

  const message = await response.json() as AnthropicMessageResponse;
  const html = extractHtmlFromFrontendSlidesResponse(message);

  console.log("frontend-slides generator completed:", {
    htmlLength: html.length,
  });

  return { html };
}
