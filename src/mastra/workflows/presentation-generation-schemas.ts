import z from "zod";

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
