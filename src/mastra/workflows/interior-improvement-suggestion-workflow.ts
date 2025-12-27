import { getBase64FromFileUrl } from "@/src/utils/get-base-64-from-file-url";
import { saveImageToFile } from "@/src/utils/save-image-to-file";
import { createStep, createWorkflow } from "@mastra/core";
import z from "zod";
import { interiorImprovementSuggestionAgent } from "../agents/interior-improvement-suggestion-agent";

export const interiorImprovementSuggestionStep = createStep({
  id: "interior-improvement-suggestion-step",
  inputSchema: z.object({
    imageUrl: z.string(),
  }),
  outputSchema: z.object({
    imageUrl: z.string(),
    changes: z.array(z.string()),
  }),
  resumeSchema: z.object({
    approvedChanges: z.array(z.string()),
  }),
  suspendSchema: z.object({
    reason: z.string(),
    suggestedChanges: z.array(z.string()),
  }),
  execute: async ({ inputData, suspend, resumeData, mastra }) => {
    const { imageUrl } = inputData;
    const { approvedChanges } = resumeData ?? {};

    if (!approvedChanges?.length) {
      const base64Image = await getBase64FromFileUrl(imageUrl);

      const suggestionAgent = mastra.getAgent(
        "interiorImprovementSuggestionAgent",
      );

      const result = await suggestionAgent.generate(
        [
          {
            role: "user",
            content: [
              {
                type: "image",
                image: base64Image,
              },
            ],
          },
        ],
        {
          structuredOutput: {
            schema: z.object({
              suggestions: z.array(z.string()),
            }),
          },
        },
      );

      await suspend({
        reason: "Awaiting user approval for suggested changes.",
        suggestedChanges: result.object.suggestions,
      });
    }

    return {
      imageUrl,
      changes: approvedChanges ?? [],
    };
  },
});

const interiorImageImprovementStep = createStep({
  id: "interior-image-improvement-step",
  inputSchema: z.object({
    imageUrl: z.string(),
    changes: z.array(z.string()),
  }),
  outputSchema: z.object({
    improvedImageUrl: z.string(),
  }),
  execute: async ({ inputData, mastra, runId }) => {
    const { imageUrl, changes } = inputData;

    const base64Image = await getBase64FromFileUrl(imageUrl);

    const improvementAgent = mastra.getAgent("interiorImageImprovementAgent");

    const result = await improvementAgent.generate([
      {
        role: "user",
        content: [
          {
            type: "image",
            image: base64Image,
          },
          {
            type: "text",
            text: `Apply the following changes to the interior image: ${changes.join(
              ", ",
            )}`,
          },
        ],
      },
    ]);

    // The reason why we get the last file is that the agent might return multiple files during generation
    const generatedImageBase64 =
      result.files?.[result.files.length - 1].payload.data;

    const filePath = await saveImageToFile(
      generatedImageBase64 as string,
      `${runId}`,
      "png",
    );

    return {
      improvedImageUrl: filePath,
    };
  },
});

export const interiorImprovementSuggestionWorkflow = createWorkflow({
  id: "interior-improvement-suggestion-workflow",
  inputSchema: z.object({
    imageUrl: z.string(),
  }),
  outputSchema: z.object({
    improvedImageUrl: z.string(),
  }),
  description:
    "A workflow that suggests improvements for interior images and applies them upon approval.",
})
  .then(interiorImprovementSuggestionStep)
  .then(interiorImageImprovementStep)
  .commit();
