import { createStep, createWorkflow } from "@mastra/core";
import z from "zod";
import {
  assertFrontendSlidesDocument,
  extractHtmlFromAgentResult,
  stripHtmlCodeFence,
} from "@/src/services/frontend-slides/html-validator";
import { loadFrontendSlidesFinalContext } from "@/src/services/frontend-slides/skill-loader";
import {
  buildFrontendSlidesMastraPrompt,
  buildFrontendSlidesRepairPrompt,
} from "@/src/services/frontend-slides/prompt-builder";
import { saveHtmlToFile } from "@/src/utils/save-html-to-file";
import { savePresentationArtifact } from "@/src/services/presentation-artifacts/artifact-store";
import {
  assertProposalExecution,
  markProposalConsumed,
} from "@/src/services/agent-proposals/proposal-store";
import { mapOutlineToFrontendSlides } from "@/src/utils/outline-to-slides-mapper";
import { presentationInputSchema, presentationOutlineSchema } from "./presentation-generation-schemas";
import { validateOutlineRevisionResult } from "./outline-revision-validation";

// Progress chunks are best-effort telemetry: if the underlying stream was already
// closed/canceled (e.g. the client aborted the request), writer.write() throws
// "Invalid state: WritableStream is locked"/closed errors that must not crash the step.
function safeWrite(writer: { write: (chunk: unknown) => unknown }, chunk: unknown) {
  try {
    const result = writer.write(chunk);
    if (result && typeof (result as Promise<unknown>).catch === "function") {
      (result as Promise<unknown>).catch(() => undefined);
    }
  } catch {
    // ignore
  }
}

type PresentationOutlineStepData = {
  status: "loading" | "streaming" | "completed";
  outline?: Partial<z.infer<typeof presentationOutlineSchema>>;
  message?: string;
  progress?: number;
  lastUpdatedAt?: number;
  steps?: OutlineProgressStep[];
};

type OutlineProgressStepId = "prepare" | "analyze" | "structure" | "detail" | "review";

type OutlineProgressStep = {
  id: OutlineProgressStepId;
  label: string;
  status: "pending" | "active" | "completed";
  detail?: string;
};

type PresentationHtmlStepData = {
  status: "in-progress" | "completed";
  phase?: "structure" | "html" | "styles" | "bundle";
  message?: string;
  progress?: number;
  generator?: "frontend-slides";
  regenerationReason?: string;
  generatedCharacters?: number;
  lastUpdatedAt?: number;
  steps?: HtmlGenerationProgressStep[];
  html?: string;
  htmlUrl?: string;
  artifact?: {
    operationId: string;
    deckId: string;
    version: number;
  };
};

type HtmlGenerationProgressStepId = "prepare" | "load-skill" | "compose" | "regenerate" | "validate" | "save";

type HtmlGenerationProgressStep = {
  id: HtmlGenerationProgressStepId;
  label: string;
  status: "pending" | "active" | "completed";
  detail?: string;
};

// Free-tier reasoning models (e.g. tencent/hy3:free) can think for a long time
// before emitting the first structured token, so idle timeouts must be generous.
const isProduction = process.env.NODE_ENV === "production";
const TIMEOUT_MULTIPLIER = isProduction ? 1.5 : 1;
const OUTLINE_GENERATION_TIMEOUT_MS = Math.floor(300_000 * TIMEOUT_MULTIPLIER);
const HTML_GENERATION_TIMEOUT_MS = Math.floor(480_000 * TIMEOUT_MULTIPLIER);
const HTML_STREAM_IDLE_TIMEOUT_MS = Math.floor(240_000 * TIMEOUT_MULTIPLIER);
const OUTLINE_STREAM_IDLE_TIMEOUT_MS = Math.floor(180_000 * TIMEOUT_MULTIPLIER);
const OUTLINE_FIRST_UPDATE_TIMEOUT_MS = Math.floor(60_000 * TIMEOUT_MULTIPLIER);
const FRONTEND_SLIDES_TIMEOUT_MS = Math.floor(420_000 * TIMEOUT_MULTIPLIER);
const HTML_MAX_OUTPUT_TOKENS = Math.max(
  8_192,
  Number.parseInt(process.env.PRESENTATION_HTML_MAX_OUTPUT_TOKENS ?? "32768", 10) || 32_768,
);

let didLogTimeoutConfiguration = false;

function logTimeoutConfiguration() {
  if (didLogTimeoutConfiguration) return;
  didLogTimeoutConfiguration = true;

  console.log("Presentation workflow timeout configuration:", {
    environment: isProduction ? "production" : "development",
    multiplier: TIMEOUT_MULTIPLIER,
    outlineGenerationTimeoutMs: OUTLINE_GENERATION_TIMEOUT_MS,
    htmlGenerationTimeoutMs: HTML_GENERATION_TIMEOUT_MS,
    frontendSlidesTimeoutMs: FRONTEND_SLIDES_TIMEOUT_MS,
    htmlMaxOutputTokens: HTML_MAX_OUTPUT_TOKENS,
    outlineFirstUpdateTimeoutMs: OUTLINE_FIRST_UPDATE_TIMEOUT_MS,
    outlineStreamIdleTimeoutMs: OUTLINE_STREAM_IDLE_TIMEOUT_MS,
    htmlStreamIdleTimeoutMs: HTML_STREAM_IDLE_TIMEOUT_MS,
  });
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const objectMatch = candidate.match(/\{[\s\S]*\}/);
    if (!objectMatch?.[0]) {
      throw new Error("Model did not return a JSON object");
    }

    return JSON.parse(objectMatch[0]);
  }
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

const baseHtmlProgressSteps: HtmlGenerationProgressStep[] = [
  { id: "prepare", label: "Preparing selected slides", status: "pending" },
  { id: "load-skill", label: "Loading design instructions", status: "pending" },
  { id: "compose", label: "Designing and writing HTML", status: "pending" },
  { id: "validate", label: "Checking slide completeness", status: "pending" },
  { id: "regenerate", label: "Regenerating with frontend-slides", status: "pending" },
  { id: "save", label: "Saving preview document", status: "pending" },
];

const baseOutlineProgressSteps: OutlineProgressStep[] = [
  { id: "prepare", label: "Reading your request", status: "pending" },
  { id: "analyze", label: "Identifying audience and goals", status: "pending" },
  { id: "structure", label: "Planning the deck structure", status: "pending" },
  { id: "detail", label: "Writing slide-level details", status: "pending" },
  { id: "review", label: "Preparing outline for review", status: "pending" },
];

function updateOutlineProgressSteps(
  activeStepId: OutlineProgressStepId,
  detail?: string,
  completeThrough?: OutlineProgressStepId,
) {
  const activeIndex = baseOutlineProgressSteps.findIndex((step) => step.id === activeStepId);
  const completeThroughIndex = completeThrough
    ? baseOutlineProgressSteps.findIndex((step) => step.id === completeThrough)
    : -1;

  return baseOutlineProgressSteps.map((step, index) => {
    let status: OutlineProgressStep["status"] = "pending";

    if (completeThroughIndex >= 0 && index <= completeThroughIndex) {
      status = "completed";
    } else if (activeIndex >= 0 && index < activeIndex) {
      status = "completed";
    } else if (step.id === activeStepId) {
      status = "active";
    }

    return {
      ...step,
      status,
      detail: step.id === activeStepId ? detail : step.detail,
    };
  });
}

function updateHtmlProgressSteps(
  activeStepId: HtmlGenerationProgressStepId,
  detail?: string,
  options: { includeRegeneration?: boolean; completeThrough?: HtmlGenerationProgressStepId } = {},
) {
  const visibleSteps = options.includeRegeneration
    ? baseHtmlProgressSteps
    : baseHtmlProgressSteps.filter((step) => step.id !== "regenerate");
  const activeIndex = visibleSteps.findIndex((step) => step.id === activeStepId);
  const completeThroughIndex = options.completeThrough
    ? visibleSteps.findIndex((step) => step.id === options.completeThrough)
    : -1;

  return visibleSteps.map((step, index) => {
    let status: HtmlGenerationProgressStep["status"] = "pending";

    if (completeThroughIndex >= 0 && index <= completeThroughIndex) {
      status = "completed";
    } else if (activeIndex >= 0 && index < activeIndex) {
      status = "completed";
    } else if (step.id === activeStepId) {
      status = "active";
    }

    return {
      ...step,
      status,
      detail: step.id === activeStepId ? detail : step.detail,
    };
  });
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

function assertOutlineHasSlides(
  outline: z.infer<typeof presentationOutlineSchema>,
  expectedSlideCount?: number,
) {
  if (outline.slides.length < 1) {
    throw new Error("Outline generation returned no slides");
  }

  if (expectedSlideCount && outline.slides.length < Math.min(expectedSlideCount, 3)) {
    throw new Error(`Outline generation returned only ${outline.slides.length} slide(s), expected about ${expectedSlideCount}`);
  }
}

function validateGeneratedOutline(
  outline: z.infer<typeof presentationOutlineSchema>,
  inputData: z.infer<typeof presentationInputSchema>,
) {
  assertOutlineHasSlides(outline, inputData.pageCount);
  if (!inputData.outlineRevisionContext) return;

  validateOutlineRevisionResult({
    currentOutline: inputData.outlineRevisionContext.currentOutline,
    revisedOutline: outline,
    expectedSlideCount: inputData.pageCount ?? inputData.outlineRevisionContext.currentOutline.slides.length,
    targetSlides: inputData.outlineRevisionContext.targetSlides,
  });
}

function buildOutlinePrompt(inputData: z.infer<typeof presentationInputSchema>) {
  if (inputData.outlineRevisionContext) {
    return `Revise the current approved presentation outline according to the confirmed instruction.
Preserve every unaffected slide, the narrative intent, and the existing visual direction.
Return a complete replacement outline with exactly ${inputData.pageCount ?? 6} slides.

Confirmed revision instruction:
${inputData.outlineRevisionContext.instruction}

Current approved outline:
${JSON.stringify(inputData.outlineRevisionContext.currentOutline, null, 2)}

Presentation brief:
${JSON.stringify({
      topic: inputData.topic,
      audience: inputData.audience,
      pageCount: inputData.pageCount,
      style: inputData.style,
      requirements: inputData.requirements,
    }, null, 2)}`;
  }

  return `Create a reviewable presentation outline for this request:
${JSON.stringify(inputData, null, 2)}`;
}

function buildOutlineJsonFallbackPrompt(inputData: z.infer<typeof presentationInputSchema>) {
  return `${buildOutlinePrompt(inputData)}

Return strict JSON only. Do not wrap it in Markdown.
The JSON shape must be:
{
  "title": "string",
  "narrativeGoal": "string",
  "sections": ["string"],
  "slides": [
    {
      "pageNumber": 1,
      "title": "string",
      "purpose": "string",
      "keyPoints": ["string"],
      "designSuggestion": "string"
    }
  ],
  "designGuidance": ["string"]
}

The slides array must contain ${inputData.pageCount ?? 6} items unless the request clearly needs fewer.`;
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
  execute: async ({ inputData, suspend, resumeData, mastra, writer, abortSignal }) => {
    logTimeoutConfiguration();

    const { approvedOutline } = resumeData ?? {};

    if (approvedOutline) {
      return {
        ...inputData,
        outline: approvedOutline,
      };
    }

    const writeOutlineProgress = (
      data: Omit<PresentationOutlineStepData, "lastUpdatedAt" | "steps"> & {
        activeStepId: OutlineProgressStepId;
        stepDetail?: string;
        completeThrough?: OutlineProgressStepId;
      },
    ) => {
      const { activeStepId, stepDetail, completeThrough, ...rest } = data;

      safeWrite(writer, {
        type: "data-presentationOutline",
        data: {
          ...rest,
          lastUpdatedAt: Date.now(),
          steps: updateOutlineProgressSteps(activeStepId, stepDetail, completeThrough),
        } satisfies PresentationOutlineStepData,
      });
    };

    writeOutlineProgress({
      status: "loading",
      activeStepId: "prepare",
      message: "Reading your request and preparing the outline workflow...",
      progress: 10,
    });

    const outlineAgent = mastra.getAgent("presentationOutlineSuggestionAgent");
    console.log("Presentation outline generation: starting", {
      timestamp: new Date().toISOString(),
      topic: inputData.topic,
      pageCount: inputData.pageCount,
      timeoutMs: OUTLINE_GENERATION_TIMEOUT_MS,
    });

    const outlineStartedAt = Date.now();
    let outline: z.infer<typeof presentationOutlineSchema>;
    let outlineHeartbeat: ReturnType<typeof setInterval> | undefined;

    const startOutlineHeartbeat = () => {
      let tick = 0;
      outlineHeartbeat = setInterval(() => {
        tick += 1;
        const stage: OutlineProgressStepId = tick < 2 ? "analyze" : tick < 4 ? "structure" : "detail";
        writeOutlineProgress({
          status: "loading",
          activeStepId: stage,
          message: stage === "analyze"
            ? "Analyzing the audience, goals, and requested style..."
            : stage === "structure"
              ? "Planning the deck structure and narrative flow..."
              : "Writing slide titles, key points, and design notes...",
          progress: Math.min(72, 18 + tick * 8),
        });
      }, 12_000);
    };

    const stopOutlineHeartbeat = () => {
      if (outlineHeartbeat) {
        clearInterval(outlineHeartbeat);
        outlineHeartbeat = undefined;
      }
    };

    try {
      writeOutlineProgress({
        status: "loading",
        activeStepId: "analyze",
        message: "Analyzing the audience, goals, and requested style...",
        progress: 18,
      });
      startOutlineHeartbeat();

      const stream = await outlineAgent.stream(
        [
          {
            role: "user",
            content: buildOutlinePrompt(inputData),
          },
        ],
        {
          structuredOutput: {
            schema: presentationOutlineSchema,
          },
          abortSignal,
        },
      );

      let lastOutlineSnapshot = "";
      const outlineIterator = stream.objectStream[Symbol.asyncIterator]();

      while (true) {
        if (Date.now() - outlineStartedAt > OUTLINE_GENERATION_TIMEOUT_MS) {
          throw new Error(`Outline generation timed out after ${Math.round(OUTLINE_GENERATION_TIMEOUT_MS / 1000)} seconds`);
        }

        const result = await nextWithTimeout(
          outlineIterator,
          lastOutlineSnapshot ? OUTLINE_STREAM_IDLE_TIMEOUT_MS : OUTLINE_FIRST_UPDATE_TIMEOUT_MS,
          lastOutlineSnapshot
            ? `Outline generation did not produce an update for ${Math.round(OUTLINE_STREAM_IDLE_TIMEOUT_MS / 1000)} seconds`
            : `Outline generation did not produce its first update for ${Math.round(OUTLINE_FIRST_UPDATE_TIMEOUT_MS / 1000)} seconds`,
        );

        if (result.done) break;

        const chunk = result.value;
        const outlineSnapshot = JSON.stringify(chunk);
        if (outlineSnapshot === lastOutlineSnapshot) continue;
        lastOutlineSnapshot = outlineSnapshot;
        const partialSlideCount = Array.isArray((chunk as Partial<z.infer<typeof presentationOutlineSchema>>).slides)
          ? (chunk as Partial<z.infer<typeof presentationOutlineSchema>>).slides?.length ?? 0
          : 0;

        writeOutlineProgress({
          status: "streaming",
          activeStepId: partialSlideCount > 0 ? "detail" : "structure",
          message: partialSlideCount > 0
            ? `Drafting slide details (${partialSlideCount} slide${partialSlideCount === 1 ? "" : "s"} ready)...`
            : "Planning the deck structure and narrative flow...",
          progress: Math.min(82, 34 + partialSlideCount * 6),
          outline: chunk,
        });
      }

      outline = await Promise.race([
        stream.object,
        timeoutAfter(
          OUTLINE_STREAM_IDLE_TIMEOUT_MS,
          `Outline generation did not finish after the stream closed within ${Math.round(OUTLINE_STREAM_IDLE_TIMEOUT_MS / 1000)} seconds`,
        ),
      ]);
      validateGeneratedOutline(outline, inputData);
    } catch (error) {
      stopOutlineHeartbeat();
      console.warn("Presentation outline structured stream failed; retrying with JSON text fallback:", {
        message: error instanceof Error ? error.message : String(error),
      });

      writeOutlineProgress({
        status: "loading",
        activeStepId: "structure",
        message: "Retrying outline generation with a stricter JSON prompt...",
        progress: 42,
        outline: {
          title: inputData.topic,
          narrativeGoal: "Retrying outline generation with a stricter JSON prompt.",
          slides: [],
        },
      });

      const fallbackResult = await outlineAgent.generate(
        [
          {
            role: "user",
            content: buildOutlineJsonFallbackPrompt(inputData),
          },
        ],
        { abortSignal },
      );
      const fallbackText = typeof fallbackResult.text === "string" ? fallbackResult.text : "";
      outline = presentationOutlineSchema.parse(parseJsonObject(fallbackText));
      validateGeneratedOutline(outline, inputData);
    } finally {
      stopOutlineHeartbeat();
    }

    console.log("Presentation outline generation: completed", {
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - outlineStartedAt,
      slideCount: outline.slides.length,
    });

    writeOutlineProgress({
      status: "completed",
      activeStepId: "review",
      completeThrough: "review",
      message: "Outline ready for review.",
      progress: 100,
      outline,
    });

    if (inputData.autoApproveOutline) {
      return {
        ...inputData,
        outline,
      };
    }

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

export const presentationHtmlGenerationStep = createStep({
  id: "presentation-html-generation-step",
  inputSchema: presentationInputSchema.extend({
    outline: presentationOutlineSchema,
  }),
  outputSchema: z.object({
    html: z.string(),
    htmlUrl: z.string().optional(),
    generator: z.literal("frontend-slides").optional(),
    regenerationReason: z.string().optional(),
  }),
  execute: async ({ inputData, mastra, writer, abortSignal }) => {
    logTimeoutConfiguration();

    const stepStartedAt = Date.now();
    let includeRegenerationStep = false;

    const writeHtmlProgress = (
      data: Omit<PresentationHtmlStepData, "status" | "lastUpdatedAt" | "steps"> & {
        status?: PresentationHtmlStepData["status"];
        activeStepId: HtmlGenerationProgressStepId;
        stepDetail?: string;
        completeThrough?: HtmlGenerationProgressStepId;
      },
    ) => {
      const { activeStepId, stepDetail, completeThrough, ...rest } = data;

      safeWrite(writer, {
        type: "data-presentationHtml",
        data: {
          status: "in-progress",
          ...rest,
          artifact: inputData.artifact ? {
            operationId: inputData.artifact.operationId,
            deckId: inputData.artifact.deckId,
            version: inputData.artifact.targetVersion,
          } : undefined,
          lastUpdatedAt: Date.now(),
          steps: updateHtmlProgressSteps(activeStepId, stepDetail, {
            includeRegeneration: includeRegenerationStep,
            completeThrough,
          }),
        } satisfies PresentationHtmlStepData,
      });
    };

    writeHtmlProgress({
      activeStepId: "prepare",
      phase: "structure",
      message: "Preparing selected slides for HTML generation...",
      progress: 10,
    });

    let html = "";
    let generator: PresentationHtmlStepData["generator"] | undefined;
    let regenerationReason: string | undefined;
    const frontendSlidesInput = mapOutlineToFrontendSlides(inputData.outline, inputData.style, {
      density: inputData.density,
      styleSpec: inputData.styleSpec,
      revisionInstruction: inputData.revision?.instruction ?? inputData.outlineRevisionContext?.instruction,
      revisionTargetSlides: inputData.revision?.targetSlides ?? inputData.outlineRevisionContext?.targetSlides,
    });

    writeHtmlProgress({
      activeStepId: "load-skill",
      phase: "html",
      message: "Loading frontend-slides design instructions...",
      progress: 24,
    });

    const frontendSlidesStartedAt = Date.now();
    try {
      const frontendSlidesContext = await loadFrontendSlidesFinalContext();
      const frontendSlidesAgent = mastra.getAgent("frontendSlidesComposerAgent");

      const runFrontendSlidesAttempt = async (prompt: string, attempt: "initial" | "repair") => {
        const attemptStartedAt = Date.now();
        const stream = await Promise.race([
          frontendSlidesAgent.stream(
            [{ role: "user", content: prompt }],
            {
              abortSignal,
              modelSettings: { maxOutputTokens: HTML_MAX_OUTPUT_TOKENS },
            },
          ),
          timeoutAfter(
            FRONTEND_SLIDES_TIMEOUT_MS,
            `frontend-slides ${attempt} generation did not start within ${Math.round(FRONTEND_SLIDES_TIMEOUT_MS / 1000)} seconds`,
          ),
        ]);
        let output = "";
        let lastProgressWrite = 0;
        const reader = stream.fullStream.getReader();

        try {
          while (Date.now() - attemptStartedAt <= FRONTEND_SLIDES_TIMEOUT_MS) {
            const { done, value } = await Promise.race([
              reader.read(),
              timeoutAfter(
                HTML_STREAM_IDLE_TIMEOUT_MS,
                `frontend-slides ${attempt} generation stream was idle for ${Math.round(HTML_STREAM_IDLE_TIMEOUT_MS / 1000)} seconds`,
              ),
            ]);
            if (done) break;

            const textDelta = getTextDelta(value);
            if (!textDelta) continue;
            output += textDelta;

            if (output.length - lastProgressWrite >= 800) {
              lastProgressWrite = output.length;
              writeHtmlProgress({
                activeStepId: attempt === "repair" ? "regenerate" : "compose",
                phase: output.length > 6_000 ? "styles" : "html",
                message: attempt === "repair"
                  ? "Regenerating a complete frontend-slides document..."
                  : output.length > 6_000
                    ? "Applying frontend-slides layout, styling, and motion..."
                    : "Writing the presentation HTML document...",
                progress: Math.min(82, 40 + Math.floor(output.length / 350)),
                generator: "frontend-slides",
                generatedCharacters: output.length,
                stepDetail: `${Math.max(1, Math.round(output.length / 1024))} KB generated`,
              });
            }
          }
        } catch (error) {
          await reader.cancel().catch(() => undefined);
          throw error;
        } finally {
          reader.releaseLock();
        }

        if (Date.now() - attemptStartedAt > FRONTEND_SLIDES_TIMEOUT_MS) {
          await stream.fullStream.cancel().catch(() => undefined);
          throw new Error(`frontend-slides ${attempt} generation timed out after ${Math.round(FRONTEND_SLIDES_TIMEOUT_MS / 1000)} seconds`);
        }
        if (!output.trim()) output = await getCompletedStreamText(stream);
        return output;
      };

      const validateFrontendSlidesHtml = (result: string) => {
        const document = extractHtmlFromAgentResult(stripHtmlCodeFence(result));
        assertFrontendSlidesDocument(document, frontendSlidesInput.slides.length);
        return document;
      };

      writeHtmlProgress({
        activeStepId: "compose",
        phase: "html",
        message: "Designing slide layouts with Mastra and frontend-slides rules...",
        progress: 36,
      });

      try {
        html = validateFrontendSlidesHtml(await runFrontendSlidesAttempt(
          buildFrontendSlidesMastraPrompt(frontendSlidesInput, frontendSlidesContext),
          "initial",
        ));
      } catch (initialError) {
        const initialFailure = initialError instanceof Error ? initialError.message : String(initialError);
        includeRegenerationStep = true;
        regenerationReason = `Initial frontend-slides attempt failed: ${initialFailure}`;
        console.warn("Presentation HTML generation: retrying with frontend-slides after the initial attempt failed", {
          initialFailure,
          expectedSlideCount: frontendSlidesInput.slides.length,
        });
        writeHtmlProgress({
          activeStepId: "regenerate",
          phase: "html",
          message: "The first attempt failed; regenerating the complete deck with frontend-slides...",
          progress: 38,
          generator: "frontend-slides",
          regenerationReason,
        });
        html = validateFrontendSlidesHtml(await runFrontendSlidesAttempt(
          buildFrontendSlidesRepairPrompt(frontendSlidesInput, frontendSlidesContext, initialFailure),
          "repair",
        ));
      }

      generator = "frontend-slides";
      console.log("Presentation HTML generation: frontend-slides Mastra agent completed", {
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - frontendSlidesStartedAt,
        generatedCharacters: html.length,
        expectedSlideCount: frontendSlidesInput.slides.length,
        regeneratedAfterInitialFailure: Boolean(regenerationReason),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("frontend-slides Mastra generation failed; no alternate generator is allowed:", {
        message,
        error,
      });
      throw new Error(`frontend-slides generation failed: ${message}`);
    }

    if (!html) {
      throw new Error("HTML generation finished without returning any HTML content");
    }

    html = stripHtmlCodeFence(html);
    writeHtmlProgress({
      activeStepId: "validate",
      phase: "styles",
      message: "Checking slide count and document completeness...",
      progress: 88,
      generator,
      regenerationReason,
      generatedCharacters: html.length,
    });
    assertFrontendSlidesDocument(html, frontendSlidesInput.slides.length);

    writeHtmlProgress({
      activeStepId: "save",
      phase: "bundle",
      message: "Saving preview document...",
      progress: 92,
      generator,
      regenerationReason,
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

    abortSignal?.throwIfAborted();

    if (inputData.artifact) {
      if (inputData.artifact.proposalId && inputData.artifact.executionId) {
        assertProposalExecution(inputData.artifact.proposalId, inputData.artifact.executionId);
      }
      savePresentationArtifact({
        operation: inputData.artifact,
        brief: {
          topic: inputData.topic,
          audience: inputData.audience ?? "General audience",
          pageCount: inputData.pageCount ?? inputData.outline.slides.length,
          style: inputData.style ?? "Polished modern presentation",
          requirements: inputData.requirements,
          purpose: inputData.purpose,
          density: inputData.density,
          contentReadiness: inputData.contentReadiness,
          styleSpec: inputData.styleSpec,
        },
        approvedOutline: inputData.outline,
        html,
        htmlUrl,
      });
      if (inputData.artifact.proposalId) {
        markProposalConsumed(inputData.artifact.proposalId, inputData.artifact.executionId);
      }
    }

    safeWrite(writer, {
      type: "data-presentationHtml",
      data: {
        status: "completed",
        phase: "bundle",
        message: "HTML presentation ready.",
        progress: 100,
        generator,
        regenerationReason,
        generatedCharacters: html.length,
        lastUpdatedAt: Date.now(),
        steps: updateHtmlProgressSteps("save", "Preview document saved.", {
          includeRegeneration: includeRegenerationStep,
          completeThrough: "save",
        }),
        html,
        htmlUrl,
        artifact: inputData.artifact ? {
          operationId: inputData.artifact.operationId,
          deckId: inputData.artifact.deckId,
          version: inputData.artifact.targetVersion,
        } : undefined,
      } satisfies PresentationHtmlStepData,
    });

    return {
      html,
      htmlUrl,
      generator,
      regenerationReason,
    };
  },
});

export const presentationGenerationWorkflow = createWorkflow({
  id: "presentation-generation-workflow",
  inputSchema: presentationInputSchema,
  outputSchema: z.object({
    html: z.string(),
    htmlUrl: z.string().optional(),
    generator: z.literal("frontend-slides").optional(),
    regenerationReason: z.string().optional(),
  }),
  description:
    "A workflow that drafts a presentation outline for approval, then generates a standalone HTML presentation.",
})
  .then(presentationOutlineSuggestionStep)
  .then(presentationHtmlGenerationStep)
  .commit();
