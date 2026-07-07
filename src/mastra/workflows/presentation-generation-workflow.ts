import { createStep, createWorkflow } from "@mastra/core";
import z from "zod";

const presentationBriefSchema = z.object({
  brief: z.string().optional(),
  topic: z.string().optional(),
  audience: z.string().optional(),
  pageCount: z.number().optional(),
  style: z.string().optional(),
  requirements: z.string().optional(),
});

export const presentationOutlineSuggestionStep = createStep({
  id: "presentation-outline-suggestion-step",
  inputSchema: presentationBriefSchema,
  outputSchema: presentationBriefSchema.extend({
    outline: z.array(z.string()),
  }),
  suspendSchema: z.object({
    reason: z.string(),
    suggestedOutline: z.array(z.string()),
  }),
  resumeSchema: z.object({
    approvedOutline: z.array(z.string()),
  }),
  execute: async ({ inputData, suspend, resumeData, writer }) => {
    const { approvedOutline } = resumeData ?? {};

    if (!approvedOutline?.length) {
      const pageCount = inputData.pageCount ?? 5;
      const subject = inputData.topic ?? inputData.brief ?? "Presentation";
      const suggestedOutline = Array.from(
        { length: pageCount },
        (_, index) => `Slide ${index + 1}: ${subject}`,
      );

      writer.write({
        type: "data-outline",
        data: {
          outline: suggestedOutline,
          status: "completed",
        },
      });

      await suspend({
        reason: "Awaiting user approval for suggested presentation outline.",
        suggestedOutline,
      });
    }

    return {
      ...inputData,
      outline: approvedOutline ?? [],
    };
  },
});

const presentationGenerationStep = createStep({
  id: "presentation-generation-step",
  inputSchema: presentationBriefSchema.extend({
    outline: z.array(z.string()),
  }),
  outputSchema: z.object({
    slides: z.array(z.string()),
  }),
  execute: async ({ inputData, writer }) => {
    const slides = inputData.outline.map((item) => item.trim());

    writer.write({
      type: "data-presentation",
      data: {
        slides,
        status: "completed",
      },
    });

    return { slides };
  },
});

export const presentationGenerationWorkflow = createWorkflow({
  id: "presentation-generation-workflow",
  inputSchema: presentationBriefSchema,
  outputSchema: z.object({
    slides: z.array(z.string()),
  }),
  description:
    "A workflow that creates a presentation outline and generates slides from approved presentation input.",
})
  .then(presentationOutlineSuggestionStep)
  .then(presentationGenerationStep)
  .commit();
