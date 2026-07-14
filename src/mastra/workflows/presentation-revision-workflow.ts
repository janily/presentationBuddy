import { createWorkflow } from "@mastra/core";
import z from "zod";
import {
  artifactOperationSchema,
  presentationInputSchema,
  presentationOutlineSchema,
  revisionSpecSchema,
} from "./presentation-generation-schemas";
import { presentationHtmlGenerationStep } from "./presentation-generation-workflow";

export const presentationRevisionWorkflowInputSchema = presentationInputSchema.extend({
  outline: presentationOutlineSchema,
  revision: revisionSpecSchema,
  artifact: artifactOperationSchema,
});

export const presentationRevisionWorkflow = createWorkflow({
  id: "presentation-revision-workflow",
  inputSchema: presentationRevisionWorkflowInputSchema,
  outputSchema: z.object({
    html: z.string(),
    htmlUrl: z.string().optional(),
    generator: z.literal("frontend-slides").optional(),
    regenerationReason: z.string().optional(),
  }),
  description: "Regenerates presentation HTML from an approved outline and a versioned revision request.",
})
  .then(presentationHtmlGenerationStep)
  .commit();
