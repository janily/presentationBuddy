import z from "zod";
import { frontendSlidesStyleSpecSchema } from "@/src/services/frontend-slides/style-schema";

export const artifactOperationSchema = z.object({
  operationId: z.string().trim().min(1, "Operation ID is required"),
  deckId: z.string().trim().min(1, "Deck ID is required"),
  baseVersion: z.number().int().min(0),
  targetVersion: z.number().int().positive(),
}).superRefine((artifact, context) => {
  if (artifact.targetVersion !== artifact.baseVersion + 1) {
    context.addIssue({
      code: "custom",
      path: ["targetVersion"],
      message: "Target version must advance the base version by one",
    });
  }
});

export const presentationInputSchema = z.object({
  topic: z.string().trim().min(1, "Topic is required"),
  audience: z.string().optional(),
  pageCount: z
    .number()
    .int("Page count must be a whole number")
    .min(3, "Page count must be at least 3")
    .max(12, "Page count must be at most 12")
    .optional(),
  style: z.string().optional(),
  requirements: z.string().optional(),
  purpose: z.enum(["pitch-deck", "teaching-tutorial", "conference-talk", "internal-presentation"]).optional(),
  density: z.enum(["speaker-led", "reading-first"]).optional(),
  contentReadiness: z.enum(["ready", "rough-notes", "topic-only"]).optional(),
  styleSpec: frontendSlidesStyleSpecSchema.optional(),
  artifact: artifactOperationSchema.optional(),
});

export const slideOutlineSchema = z.object({
  pageNumber: z.number(),
  title: z.string(),
  purpose: z.string(),
  keyPoints: z.array(z.string()),
  designSuggestion: z.string(),
});

export const presentationOutlineSchema = z.object({
  title: z.string(),
  narrativeGoal: z.string(),
  sections: z.array(z.string()),
  slides: z.array(slideOutlineSchema).min(1, "Outline must contain at least one slide"),
  designGuidance: z.array(z.string()),
});

export const revisionSpecSchema = z.object({
  kind: z.enum(["style", "palette", "content", "structure", "mixed"]),
  instruction: z.string().trim().min(1, "Revision instruction is required"),
  targetSlides: z.array(z.number().int().positive()).optional(),
  style: z.string().trim().min(1).optional(),
  palette: z.array(z.string().trim().min(1)).min(1).optional(),
  styleSpec: frontendSlidesStyleSpecSchema.optional(),
  requiresOutlineReview: z.boolean(),
});

export const presentationRevisionRequestSchema = z.object({
  presentationBrief: presentationInputSchema,
  approvedOutline: presentationOutlineSchema,
  revision: revisionSpecSchema,
  artifact: artifactOperationSchema,
});
