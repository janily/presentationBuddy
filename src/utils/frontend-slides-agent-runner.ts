import { query } from "@anthropic-ai/claude-agent-sdk";
import type { FrontendSlidesInput } from "./outline-to-slides-mapper";

export type FrontendSlidesResult = {
  html: string;
};

export type FrontendSlidesAgentProgress = {
  stage: "load-skill" | "compose" | "validate";
  message: string;
};

type InvokeFrontendSlidesAgentOptions = {
  onProgress?: (progress: FrontendSlidesAgentProgress) => void;
};

export function isFrontendSlidesAgentConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function buildFrontendSlidesAgentPrompt(input: FrontendSlidesInput) {
  const slides = input.slides
    .map((slide, index) => {
      return [
        `Slide ${index + 1}: ${slide.title}`,
        `Layout hint: ${slide.layout}`,
        slide.content,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  return `Generate a complete standalone HTML presentation from this approved outline.

This is a headless server-side generation task. Do not ask follow-up questions, do not create style previews, do not open files in a browser, and do not write files. Use the enabled frontend-slides skill as the design and implementation reference, then return only the final HTML document.

Presentation title: ${input.title}
Narrative goal: ${input.narrativeGoal}
Requested style: ${input.style}
Required slide count: ${input.slides.length}
Design guidance:
${input.designGuidance.map((item) => `- ${item}`).join("\n") || "- Create a refined, presentation-ready visual system."}

Approved outline:
${slides}

Requirements:
- Return exactly one complete HTML document, starting with <!doctype html> or <html>.
- The deck must contain at least ${input.slides.length} real slides, matching the approved outline.
- Use the frontend-slides fixed 1920x1080 stage rules and include the mandatory viewport CSS.
- Keep all CSS and JavaScript embedded in the HTML document.
- Do not return Markdown fences, commentary, file paths, or instructions.`;
}

export async function invokeFrontendSlidesAgent(
  input: FrontendSlidesInput,
  options: InvokeFrontendSlidesAgentOptions = {},
): Promise<FrontendSlidesResult> {
  if (!isFrontendSlidesAgentConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is required to invoke frontend-slides agent");
  }

  const prompt = buildFrontendSlidesAgentPrompt(input);
  let html = "";
  let didReportComposition = false;
  let lastHeartbeatAt = 0;

  options.onProgress?.({
    stage: "load-skill",
    message: "Loading presentation design instructions...",
  });

  for await (const message of query({
    prompt,
    options: {
      cwd: process.cwd(),
      skills: ["frontend-slides"],
      tools: ["Read"],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: Number(process.env.FRONTEND_SLIDES_AGENT_MAX_TURNS || 6),
      model: process.env.FRONTEND_SLIDES_MODEL || process.env.ANTHROPIC_MODEL,
      env: {
        ...process.env,
        CLAUDE_AGENT_SDK_CLIENT_APP: "presentation-buddy/frontend-slides",
      },
    },
  })) {
    const now = Date.now();
    if (now - lastHeartbeatAt >= 15_000) {
      lastHeartbeatAt = now;
      options.onProgress?.({
        stage: didReportComposition ? "compose" : "load-skill",
        message: didReportComposition
          ? "Designing slide layouts and writing the HTML document..."
          : "Loading presentation design instructions...",
      });
    }

    if (message.type === "assistant" && !didReportComposition) {
      didReportComposition = true;
      options.onProgress?.({
        stage: "compose",
        message: "Designing slide layouts and writing the HTML document...",
      });
    }

    if (message.type === "result" && message.subtype === "success") {
      options.onProgress?.({
        stage: "validate",
        message: "Checking the generated presentation document...",
      });
      html = extractHtmlFromAgentResult(message.result);
    }
  }

  if (!html) {
    throw new Error("frontend-slides agent did not return HTML content");
  }

  return { html };
}

export function extractHtmlFromAgentResult(result: string) {
  const content = result.trim();
  const fencedMatch = content.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const htmlMatch = content.match(/(?:<!doctype html>|<html[\s>])[\s\S]*<\/html>/i);
  if (htmlMatch?.[0]) {
    return htmlMatch[0].trim();
  }

  throw new Error("Failed to extract HTML from frontend-slides agent result");
}

export function countGeneratedSlides(html: string) {
  const sectionCount = html.match(/<section(?:\s|>)/gi)?.length ?? 0;
  const slideClassCount = html.match(/class=["'][^"']*\bslide\b[^"']*["']/gi)?.length ?? 0;

  return Math.max(sectionCount, slideClassCount);
}

export function assertFrontendSlidesComplete(html: string, expectedSlideCount: number) {
  const slideCount = countGeneratedSlides(html);

  if (slideCount < expectedSlideCount) {
    throw new Error(`frontend-slides output only contains ${slideCount} slide(s), expected ${expectedSlideCount}`);
  }
}
