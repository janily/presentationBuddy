import { createStep, createWorkflow } from "@mastra/core";
import z from "zod";
import { discoverFrontendSlideStyles } from "@/src/services/frontend-slides/style-catalog";
import { loadFrontendSlidesDiscoveryContext } from "@/src/services/frontend-slides/skill-loader";
import {
  frontendSlidesDensitySchema,
  frontendSlidesPurposeSchema,
  frontendSlidesStylePreviewSchema,
} from "@/src/services/frontend-slides/style-schema";

export const frontendSlidesStyleDiscoveryInputSchema = z.object({
  topic: z.string().trim().min(1),
  audience: z.string().trim().min(1),
  purpose: frontendSlidesPurposeSchema,
  density: frontendSlidesDensitySchema,
});

export const frontendSlidesStyleDiscoveryOutputSchema = z.object({
  previews: z.array(frontendSlidesStylePreviewSchema).length(3),
});

const discoverStylesStep = createStep({
  id: "discover-frontend-slides-styles",
  inputSchema: frontendSlidesStyleDiscoveryInputSchema,
  outputSchema: frontendSlidesStyleDiscoveryOutputSchema,
  execute: async ({ inputData }) => {
    const context = await loadFrontendSlidesDiscoveryContext();
    return { previews: discoverFrontendSlideStyles(inputData, context.stylePresets) };
  },
});

export const frontendSlidesStyleDiscoveryWorkflow = createWorkflow({
  id: "frontend-slides-style-discovery-workflow",
  description: "Selects three frontend-slides design systems and creates authentic title-slide previews.",
  inputSchema: frontendSlidesStyleDiscoveryInputSchema,
  outputSchema: frontendSlidesStyleDiscoveryOutputSchema,
})
  .then(discoverStylesStep)
  .commit();
