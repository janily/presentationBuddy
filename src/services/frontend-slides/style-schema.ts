import z from "zod";

export const frontendSlidesPurposeSchema = z.enum(["pitch-deck", "teaching-tutorial", "conference-talk", "internal-presentation"]);
export const frontendSlidesDensitySchema = z.enum(["speaker-led", "reading-first"]);

export const frontendSlidesStyleSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: z.enum(["frontend-slides-preset", "frontend-slides-custom", "frontend-slides-bold-template"]),
  vibe: z.string(),
  layout: z.string(),
  typography: z.object({ display: z.string(), body: z.string() }),
  palette: z.object({
    background: z.string(),
    surface: z.string(),
    text: z.string(),
    accent: z.string(),
    secondary: z.string(),
  }),
  signatureElements: z.array(z.string()),
  boldTemplate: z.object({
    slug: z.string(),
    tagline: z.string(),
    mood: z.array(z.string()),
    tone: z.array(z.string()),
    formality: z.string(),
    density: z.string(),
    scheme: z.string(),
    bestFor: z.string(),
    avoidFor: z.string(),
    previewMd: z.string(),
    designMd: z.string(),
  }).optional(),
});

export const frontendSlidesStylePreviewSchema = z.object({
  style: frontendSlidesStyleSpecSchema,
  previewImage: z.string(),
});

export type FrontendSlidesPurpose = z.infer<typeof frontendSlidesPurposeSchema>;
export type FrontendSlidesDensity = z.infer<typeof frontendSlidesDensitySchema>;
export type FrontendSlidesStyleSpec = z.infer<typeof frontendSlidesStyleSpecSchema>;
export type FrontendSlidesStylePreview = z.infer<typeof frontendSlidesStylePreviewSchema>;
