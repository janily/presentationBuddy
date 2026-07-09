import { query } from "@anthropic-ai/claude-agent-sdk";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
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

export function isFrontendSlidesRequired() {
  return process.env.FRONTEND_SLIDES_REQUIRED === "true";
}

export function buildFrontendSlidesAgentPrompt(input: FrontendSlidesInput, outputPath = ".frontend-slides-runs/deck.html") {
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

This is a headless server-side generation task. Use the enabled frontend-slides skill as the design and implementation reference. Do not ask follow-up questions, do not create style previews, and do not open files in a browser.

Presentation title: ${input.title}
Narrative goal: ${input.narrativeGoal}
Requested style: ${input.style}
Required slide count: ${input.slides.length}
Design guidance:
${input.designGuidance.map((item) => `- ${item}`).join("\n") || "- Create a refined, presentation-ready visual system."}

Approved outline:
${slides}

Requirements:
- Write exactly one complete HTML document to this path: ${outputPath}
- After writing the file, respond with either the full HTML document or the path ${outputPath}.
- The HTML document must start with <!doctype html> or <html>.
- The deck must contain at least ${input.slides.length} real slides, matching the approved outline.
- Use the frontend-slides fixed 1920x1080 stage rules and include the mandatory viewport CSS.
- Keep all CSS and JavaScript embedded in the HTML document.
- Do not return Markdown fences, commentary, or instructions.`;
}

export async function invokeFrontendSlidesAgent(
  input: FrontendSlidesInput,
  options: InvokeFrontendSlidesAgentOptions = {},
): Promise<FrontendSlidesResult> {
  if (!isFrontendSlidesAgentConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is required to invoke frontend-slides agent");
  }

  const runId = randomUUID();
  const relativeOutputPath = path.posix.join(".frontend-slides-runs", runId, "deck.html");
  const absoluteOutputPath = path.join(process.cwd(), ".frontend-slides-runs", runId, "deck.html");
  const prompt = buildFrontendSlidesAgentPrompt(input, relativeOutputPath);
  let html = "";
  let resultText = "";
  let didReportComposition = false;
  let lastHeartbeatAt = 0;

  await mkdir(path.dirname(absoluteOutputPath), { recursive: true });

  options.onProgress?.({
    stage: "load-skill",
    message: "Loading presentation design instructions...",
  });

  const agentQuery = query({
    prompt,
    options: {
      cwd: process.cwd(),
      skills: ["frontend-slides"],
      tools: ["Read", "Write", "Edit", "Glob", "Grep"],
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      maxTurns: Number(process.env.FRONTEND_SLIDES_AGENT_MAX_TURNS || 6),
      model: process.env.FRONTEND_SLIDES_MODEL || process.env.ANTHROPIC_MODEL,
      env: {
        ...process.env,
        CLAUDE_AGENT_SDK_CLIENT_APP: "presentation-buddy/frontend-slides",
      },
      stderr: (data: string) => {
        if (process.env.FRONTEND_SLIDES_AGENT_DEBUG === "true") {
          console.warn("frontend-slides agent stderr:", data);
        }
      },
    },
  });

  await assertFrontendSlidesSkillAvailable(agentQuery);

  for await (const message of agentQuery) {
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
      resultText = message.result;
      html = await resolveFrontendSlidesHtml(message.result, absoluteOutputPath);
    }
  }

  if (!html) {
    throw new Error(`frontend-slides agent did not return HTML content. Result preview: ${truncateForLog(resultText)}`);
  }

  assertFrontendSlidesDocument(html, input.slides.length);

  if (process.env.FRONTEND_SLIDES_KEEP_RUN_FILES !== "true") {
    await rm(path.dirname(absoluteOutputPath), { recursive: true, force: true }).catch(() => undefined);
  }

  return { html };
}

async function assertFrontendSlidesSkillAvailable(
  agentQuery: ReturnType<typeof query>,
) {
  const commands = await agentQuery.supportedCommands();
  const hasFrontendSlides = commands.some((command) => command.name === "frontend-slides");

  if (!hasFrontendSlides) {
    agentQuery.close();
    throw new Error("Claude Agent SDK did not discover the frontend-slides skill in .claude/skills/frontend-slides");
  }
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

export async function resolveFrontendSlidesHtml(result: string, outputPath: string) {
  try {
    return extractHtmlFromAgentResult(result);
  } catch (extractError) {
    const fileHtml = await readGeneratedHtmlFile(outputPath);
    if (fileHtml) {
      return fileHtml;
    }

    console.warn("frontend-slides agent result did not contain HTML and output file was not readable:", {
      outputPath,
      resultPreview: truncateForLog(result),
      message: extractError instanceof Error ? extractError.message : String(extractError),
    });

    throw extractError;
  }
}

async function readGeneratedHtmlFile(outputPath: string) {
  try {
    const html = await readFile(outputPath, "utf8");
    return html.trim() || null;
  } catch {
    return null;
  }
}

function truncateForLog(value: string, maxLength = 1_000) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
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

export function assertFrontendSlidesDocument(html: string, expectedSlideCount: number) {
  assertFrontendSlidesComplete(html, expectedSlideCount);

  const checks = [
    {
      passed: /\bwidth\s*:\s*1920px\b/i.test(html) && /\bheight\s*:\s*1080px\b/i.test(html),
      message: "missing fixed 1920x1080 stage rules",
    },
    {
      passed: /class=["'][^"']*\bslide\b[^"']*["']/i.test(html),
      message: "missing frontend-slides .slide elements",
    },
    {
      passed: /visibility\s*:\s*hidden/i.test(html)
        && /visibility\s*:\s*visible/i.test(html)
        && /pointer-events\s*:\s*none/i.test(html)
        && /pointer-events\s*:\s*auto/i.test(html),
      message: "missing viewport-base visibility and pointer-events rules",
    },
    {
      passed: !/\.slide\s*\{[^}]*display\s*:\s*none/gi.test(html)
        && !/\.slide\.active\s*\{[^}]*display\s*:\s*block/gi.test(html),
      message: "uses display none/block for slide switching instead of viewport-base visibility rules",
    },
  ];

  const failed = checks.find((check) => !check.passed);
  if (failed) {
    throw new Error(`frontend-slides output failed validation: ${failed.message}`);
  }
}
