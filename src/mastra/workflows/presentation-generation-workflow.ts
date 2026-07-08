import { createStep, createWorkflow } from "@mastra/core";
import z from "zod";
import { saveHtmlToFile } from "@/src/utils/save-html-to-file";
import { presentationInputSchema, presentationOutlineSchema } from "./presentation-generation-schemas";

type PresentationOutlineStepData = {
  status: "loading" | "streaming" | "completed";
  outline?: Partial<z.infer<typeof presentationOutlineSchema>>;
};

type PresentationHtmlStepData = {
  status: "in-progress" | "completed";
  phase?: "structure" | "html" | "styles" | "bundle";
  message?: string;
  progress?: number;
  generatedCharacters?: number;
  html?: string;
  htmlUrl?: string;
};

// Free-tier reasoning models (e.g. tencent/hy3:free) can think for a long time
// before emitting the first structured token, so idle timeouts must be generous.
const isProduction = process.env.NODE_ENV === "production";
const TIMEOUT_MULTIPLIER = isProduction ? 1.5 : 1;
const OUTLINE_GENERATION_TIMEOUT_MS = Math.floor(300_000 * TIMEOUT_MULTIPLIER);
const HTML_GENERATION_TIMEOUT_MS = Math.floor(480_000 * TIMEOUT_MULTIPLIER);
const HTML_STREAM_IDLE_TIMEOUT_MS = Math.floor(240_000 * TIMEOUT_MULTIPLIER);
const OUTLINE_STREAM_IDLE_TIMEOUT_MS = Math.floor(180_000 * TIMEOUT_MULTIPLIER);

let didLogTimeoutConfiguration = false;

function logTimeoutConfiguration() {
  if (didLogTimeoutConfiguration) return;
  didLogTimeoutConfiguration = true;

  console.log("Presentation workflow timeout configuration:", {
    environment: isProduction ? "production" : "development",
    multiplier: TIMEOUT_MULTIPLIER,
    outlineGenerationTimeoutMs: OUTLINE_GENERATION_TIMEOUT_MS,
    htmlGenerationTimeoutMs: HTML_GENERATION_TIMEOUT_MS,
    outlineStreamIdleTimeoutMs: OUTLINE_STREAM_IDLE_TIMEOUT_MS,
    htmlStreamIdleTimeoutMs: HTML_STREAM_IDLE_TIMEOUT_MS,
  });
}

function stripHtmlCodeFence(html: string) {
  return html
    .trim()
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function timeoutAfter(ms: number, message: string) {
  return new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

async function nextWithTimeout<T>(
  iterator: AsyncIterator<T>,
  ms: number,
  message: string,
) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      iterator.next(),
      new Promise<IteratorResult<T>>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function getTextDelta(chunk: unknown) {
  if (!chunk || typeof chunk !== "object" || !("type" in chunk) || chunk.type !== "text-delta") {
    return "";
  }

  const textChunk = chunk as {
    text?: unknown;
    delta?: unknown;
    textDelta?: unknown;
    payload?: { text?: unknown; delta?: unknown; textDelta?: unknown };
  };
  const text = textChunk.text
    ?? textChunk.delta
    ?? textChunk.textDelta
    ?? textChunk.payload?.text
    ?? textChunk.payload?.delta
    ?? textChunk.payload?.textDelta;

  return typeof text === "string" ? text : "";
}

async function getCompletedStreamText(stream: { text?: Promise<string> }) {
  if (!stream.text) return "";

  return Promise.race([
    stream.text,
    timeoutAfter(
      HTML_STREAM_IDLE_TIMEOUT_MS,
      `HTML generation stream closed but text aggregation did not finish within ${Math.round(HTML_STREAM_IDLE_TIMEOUT_MS / 1000)} seconds`,
    ),
  ]);
}

export const presentationOutlineSuggestionStep = createStep({
  id: "presentation-outline-suggestion-step",
  inputSchema: presentationInputSchema,
  outputSchema: presentationInputSchema.extend({
    outline: presentationOutlineSchema,
  }),
  suspendSchema: z.object({
    reason: z.string(),
    suggestedOutline: presentationOutlineSchema,
  }),
  resumeSchema: z.object({
    approvedOutline: presentationOutlineSchema,
  }),
  execute: async ({ inputData, suspend, resumeData, mastra, writer }) => {
    logTimeoutConfiguration();

    const { approvedOutline } = resumeData ?? {};

    if (approvedOutline) {
      return {
        ...inputData,
        outline: approvedOutline,
      };
    }

    writer.write({
      type: "data-presentationOutline",
      data: {
        status: "loading",
      } satisfies PresentationOutlineStepData,
    });

    const outlineAgent = mastra.getAgent("presentationOutlineSuggestionAgent");
    console.log("Presentation outline generation: starting", {
      timestamp: new Date().toISOString(),
      topic: inputData.topic,
      pageCount: inputData.pageCount,
      timeoutMs: OUTLINE_GENERATION_TIMEOUT_MS,
    });

    const stream = await outlineAgent.stream(
      [
        {
          role: "user",
          content: `Create a reviewable presentation outline for this request:\n${JSON.stringify(
            inputData,
            null,
            2,
          )}`,
        },
      ],
      {
        structuredOutput: {
          schema: presentationOutlineSchema,
        },
      },
    );

    const outlineStartedAt = Date.now();
    let lastOutlineSnapshot = "";
    const outlineIterator = stream.objectStream[Symbol.asyncIterator]();

    while (true) {
      if (Date.now() - outlineStartedAt > OUTLINE_GENERATION_TIMEOUT_MS) {
        throw new Error(`Outline generation timed out after ${Math.round(OUTLINE_GENERATION_TIMEOUT_MS / 1000)} seconds`);
      }

      const result = await nextWithTimeout(
        outlineIterator,
        OUTLINE_STREAM_IDLE_TIMEOUT_MS,
        `Outline generation did not produce an update for ${Math.round(OUTLINE_STREAM_IDLE_TIMEOUT_MS / 1000)} seconds`,
      );

      if (result.done) break;

      const chunk = result.value;
      const outlineSnapshot = JSON.stringify(chunk);
      if (outlineSnapshot === lastOutlineSnapshot) continue;
      lastOutlineSnapshot = outlineSnapshot;

      writer.write({
        type: "data-presentationOutline",
        data: {
          status: "streaming",
          outline: chunk,
        } satisfies PresentationOutlineStepData,
      });
    }

    const outline = await Promise.race([
      stream.object,
      timeoutAfter(
        OUTLINE_STREAM_IDLE_TIMEOUT_MS,
        `Outline generation did not finish after the stream closed within ${Math.round(OUTLINE_STREAM_IDLE_TIMEOUT_MS / 1000)} seconds`,
      ),
    ]);

    console.log("Presentation outline generation: completed", {
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - outlineStartedAt,
      slideCount: outline.slides.length,
    });

    writer.write({
      type: "data-presentationOutline",
      data: {
        status: "completed",
        outline,
      } satisfies PresentationOutlineStepData,
    });

    await suspend({
      reason: "Awaiting user approval or edits for the presentation outline.",
      suggestedOutline: outline,
    });

    return {
      ...inputData,
      outline,
    };
  },
});

const presentationHtmlGenerationStep = createStep({
  id: "presentation-html-generation-step",
  inputSchema: presentationInputSchema.extend({
    outline: presentationOutlineSchema,
  }),
  outputSchema: z.object({
    html: z.string(),
    htmlUrl: z.string().optional(),
  }),
  execute: async ({ inputData, mastra, writer }) => {
    logTimeoutConfiguration();

    const stepStartedAt = Date.now();

    writer.write({
      type: "data-presentationHtml",
      data: {
        status: "in-progress",
        phase: "structure",
        message: "Preparing selected slides for HTML generation...",
        progress: 10,
      } satisfies PresentationHtmlStepData,
    });

    const generationAgent = mastra.getAgent("presentationHtmlGenerationAgent");
    console.log("Presentation HTML generation: starting model stream", {
      timestamp: new Date().toISOString(),
      slideCount: inputData.outline.slides.length,
      title: inputData.outline.title,
      timeoutMs: HTML_GENERATION_TIMEOUT_MS,
      idleTimeoutMs: HTML_STREAM_IDLE_TIMEOUT_MS,
    });

    const stream = await Promise.race([
      generationAgent.stream([
        {
          role: "user",
          content: `Generate a standalone HTML presentation from this approved outline and original request. Return only the complete HTML document, starting with <!doctype html> or <html>, and do not wrap it in Markdown fences:\n${JSON.stringify(
            inputData,
            null,
            2,
          )}`,
        },
      ]),
      timeoutAfter(HTML_GENERATION_TIMEOUT_MS, `HTML generation did not start within ${Math.round(HTML_GENERATION_TIMEOUT_MS / 1000)} seconds`),
    ]);

    let html = "";
    let lastProgressWrite = 0;

    writer.write({
      type: "data-presentationHtml",
      data: {
        status: "in-progress",
        phase: "html",
        message: "Writing slide markup...",
        progress: 30,
      } satisfies PresentationHtmlStepData,
    });

    const htmlStartedAt = Date.now();
    const reader = stream.fullStream.getReader();

    try {
      while (Date.now() - htmlStartedAt <= HTML_GENERATION_TIMEOUT_MS) {
        const { done, value } = await Promise.race([
          reader.read(),
          timeoutAfter(
            HTML_STREAM_IDLE_TIMEOUT_MS,
            `HTML generation stream was idle for ${Math.round(HTML_STREAM_IDLE_TIMEOUT_MS / 1000)} seconds`,
          ),
        ]);

        if (done) break;

        const textDelta = getTextDelta(value);
        if (!textDelta) continue;

        html += textDelta;

        if (html.length - lastProgressWrite >= 800) {
          lastProgressWrite = html.length;
          console.log("Presentation HTML generation: received text", {
            generatedCharacters: html.length,
          });
          writer.write({
            type: "data-presentationHtml",
            data: {
              status: "in-progress",
              phase: html.length > 4_000 ? "styles" : "html",
              message: html.length > 4_000 ? "Applying layout and visual styling..." : "Writing slide markup...",
              progress: Math.min(85, 30 + Math.floor(html.length / 250)),
              generatedCharacters: html.length,
            } satisfies PresentationHtmlStepData,
          });
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (Date.now() - htmlStartedAt > HTML_GENERATION_TIMEOUT_MS) {
      await stream.fullStream.cancel().catch(() => undefined);
      throw new Error(`HTML generation timed out after ${Math.round(HTML_GENERATION_TIMEOUT_MS / 1000)} seconds`);
    }

    if (!html.trim()) {
      html = await getCompletedStreamText(stream);
    }

    html = stripHtmlCodeFence(html);

    writer.write({
      type: "data-presentationHtml",
      data: {
        status: "in-progress",
        phase: "bundle",
        message: "Saving preview document...",
        progress: 92,
        generatedCharacters: html.length,
      } satisfies PresentationHtmlStepData,
    });

    if (!html) {
      throw new Error("HTML generation finished without returning any HTML content");
    }

    console.log("Presentation HTML generation: model stream completed", {
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - htmlStartedAt,
      generatedCharacters: html.length,
    });

    const saveStartedAt = Date.now();
    const htmlUrl = await saveHtmlToFile(html, { prefix: "presentation-deck" });
    console.log("Presentation HTML generation: saved preview document", {
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - saveStartedAt,
      totalDurationMs: Date.now() - stepStartedAt,
      htmlUrl,
    });

    writer.write({
      type: "data-presentationHtml",
      data: {
        status: "completed",
        phase: "bundle",
        message: "HTML presentation ready.",
        progress: 100,
        generatedCharacters: html.length,
        html,
        htmlUrl,
      } satisfies PresentationHtmlStepData,
    });

    return {
      html,
      htmlUrl,
    };
  },
});

export const presentationGenerationWorkflow = createWorkflow({
  id: "presentation-generation-workflow",
  inputSchema: presentationInputSchema,
  outputSchema: z.object({
    html: z.string(),
    htmlUrl: z.string().optional(),
  }),
  description:
    "A workflow that drafts a presentation outline for approval, then generates a standalone HTML presentation.",
})
  .then(presentationOutlineSuggestionStep)
  .then(presentationHtmlGenerationStep)
  .commit();
