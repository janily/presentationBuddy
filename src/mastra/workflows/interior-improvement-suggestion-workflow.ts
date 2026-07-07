import { createStep, createWorkflow } from "@mastra/core";
import z from "zod";
import type {
  GeneratedPresentationStepData,
  ImprovementStepData,
  SuggestionStepData,
} from "@/src/types/interior-workflow";
import { getBase64FromFileUrl } from "@/src/utils/get-base-64-from-file-url";
import { saveImageToFile } from "@/src/utils/save-image-to-file";
import { saveHtmlToFile } from "@/src/utils/save-html-to-file";

export const interiorImprovementSuggestionStep = createStep({
  id: "interior-improvement-suggestion-step",
  inputSchema: z.object({
    imageUrl: z.string(),
  }),
  outputSchema: z.object({
    imageUrl: z.string(),
    changes: z.array(z.string()),
  }),
  suspendSchema: z.object({
    reason: z.string(),
    suggestedChanges: z.array(z.string()),
  }),
  resumeSchema: z.object({
    approvedChanges: z.array(z.string()),
  }),
  execute: async ({ inputData, suspend, resumeData, mastra, writer }) => {
    const { imageUrl } = inputData;
    const { approvedChanges } = resumeData ?? {};

    if (!approvedChanges?.length) {
      writer.write({
        type: "data-suggestions",
        data: {
          changes: [],
          status: "loading",
        } satisfies SuggestionStepData,
      });

      const base64Image = await getBase64FromFileUrl(imageUrl);

      const suggestionAgent = mastra.getAgent(
        "interiorImprovementSuggestionAgent",
      );

      const stream = await suggestionAgent.stream(
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

      for await (const chunk of stream.objectStream) {
        writer.write({
          type: "data-suggestions",
          data: {
            changes: chunk.suggestions,
            status: "streaming",
          } satisfies SuggestionStepData,
        });
      }

      const result = await stream.object;

      writer.write({
        type: "data-suggestions",
        data: {
          changes: result.suggestions,
          status: "completed",
        } satisfies SuggestionStepData,
      });

      await suspend({
        reason: "Awaiting user approval for suggested changes.",
        suggestedChanges: result.suggestions,
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
  execute: async ({ inputData, mastra, writer }) => {
    const { imageUrl, changes } = inputData;

    const base64Image = await getBase64FromFileUrl(imageUrl);

    const improvementAgent = mastra.getAgent("interiorImageImprovementAgent");

    writer.write({
      type: "data-improvedInterior",
      data: {
        status: "in-progress",
        url: "",
      } satisfies ImprovementStepData,
    });

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
    const files = result?.files;
    const generatedImageBase64 = files?.[files?.length - 1]?.payload.data;

    const url = await saveImageToFile(generatedImageBase64 as string, "png");

    writer.write({
      type: "data-improvedInterior",
      data: {
        status: "completed",
        url,
      } satisfies ImprovementStepData,
    });

    return {
      improvedImageUrl: url,
    };
  },
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const presentationHtmlGenerationStep = createStep({
  id: "presentation-html-generation-step",
  inputSchema: z.object({
    improvedImageUrl: z.string(),
  }),
  outputSchema: z.object({
    improvedImageUrl: z.string(),
    generatedPresentationUrl: z.string(),
  }),
  execute: async ({ inputData, writer }) => {
    const { improvedImageUrl } = inputData;

    writer.write({
      type: "data-generatedPresentation",
      data: {
        status: "in-progess",
        url: "",
      } satisfies GeneratedPresentationStepData,
    });

    const escapedImageUrl = escapeHtml(improvedImageUrl);
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Generated Presentation</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #111827; font-family: Arial, sans-serif; }
      main { width: min(1120px, 92vw); aspect-ratio: 16 / 9; display: grid; place-items: center; border-radius: 24px; overflow: hidden; background: #f9fafb; box-shadow: 0 24px 80px rgb(0 0 0 / 0.35); }
      img { width: 100%; height: 100%; object-fit: cover; }
    </style>
  </head>
  <body>
    <main aria-label="Generated interior presentation slide">
      <img src="${escapedImageUrl}" alt="Generated interior design presentation" />
    </main>
  </body>
</html>`;

    const url = await saveHtmlToFile(html);

    writer.write({
      type: "data-generatedPresentation",
      data: {
        status: "completed",
        url,
      } satisfies GeneratedPresentationStepData,
    });

    return {
      improvedImageUrl,
      generatedPresentationUrl: url,
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
    generatedPresentationUrl: z.string(),
  }),
  description:
    "A workflow that suggests improvements for interior images and applies them upon approval.",
})
  .then(interiorImprovementSuggestionStep)
  .then(interiorImageImprovementStep)
  .then(presentationHtmlGenerationStep)
  .commit();
