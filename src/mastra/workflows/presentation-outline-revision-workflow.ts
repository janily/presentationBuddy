import { createWorkflow } from "@mastra/core";
import z from "zod";
import { presentationInputSchema, presentationOutlineSchema, revisionSpecSchema } from "./presentation-generation-schemas";
import {
  presentationHtmlGenerationStep,
  presentationOutlineSuggestionStep,
} from "./presentation-generation-workflow";

export const presentationOutlineRevisionWorkflow = createWorkflow({
  id: "presentation-outline-revision-workflow",
  inputSchema: presentationInputSchema.extend({
    autoApproveOutline: z.literal(true),
    revision: revisionSpecSchema,
    outlineRevisionContext: z.object({
      instruction: z.string().trim().min(1),
      targetSlides: z.array(z.number().int().positive()).optional(),
      currentOutline: presentationOutlineSchema,
    }),
  }),
  outputSchema: z.object({
    html: z.string(),
    htmlUrl: z.string().optional(),
    generator: z.enum(["frontend-slides", "backup"]).optional(),
    fallbackReason: z.string().optional(),
  }),
  description: "Revises an approved outline from a confirmed structural proposal and publishes a new presentation version.",
})
  .then(presentationOutlineSuggestionStep)
  .then(presentationHtmlGenerationStep)
  .commit();
