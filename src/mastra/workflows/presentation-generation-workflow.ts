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

const OUTLINE_GENERATION_TIMEOUT_MS = 90_000;
const HTML_GENERATION_TIMEOUT_MS = 120_000;
const HTML_STREAM_IDLE_TIMEOUT_MS = 30_000;

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

function getTextDelta(chunk: unknown) {
  if (!chunk || typeof chunk !== "object" || !("type" in chunk) || chunk.type !== "text-delta") {
    return "";
  }

  const payload = (chunk as { payload?: { text?: unknown }; textDelta?: unknown }).payload;
  const text = payload?.text ?? (chunk as { textDelta?: unknown }).textDelta;

  return typeof text === "string" ? text : "";
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

    for await (const chunk of stream.objectStream) {
      if (Date.now() - outlineStartedAt > OUTLINE_GENERATION_TIMEOUT_MS) {
        throw new Error(`Outline generation timed out after ${Math.round(OUTLINE_GENERATION_TIMEOUT_MS / 1000)} seconds`);
      }

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

    const outline = await stream.object;

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
      slideCount: inputData.outline.slides.length,
      title: inputData.outline.title,
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
      generatedCharacters: html.length,
    });

    const htmlUrl = await saveHtmlToFile(html, { prefix: "presentation-deck" });

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
