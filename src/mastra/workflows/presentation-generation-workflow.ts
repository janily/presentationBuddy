import { createStep, createWorkflow } from "@mastra/core";
import z from "zod";
import { saveHtmlToFile } from "@/src/utils/save-html-to-file";

const presentationInputSchema = z.object({
  topic: z.string(),
  audience: z.string().optional(),
  pageCount: z.number().optional(),
  style: z.string().optional(),
  requirements: z.string().optional(),
});

const slideOutlineSchema = z.object({
  pageNumber: z.number(),
  title: z.string(),
  purpose: z.string(),
  keyPoints: z.array(z.string()),
  designSuggestion: z.string(),
});

const presentationOutlineSchema = z.object({
  title: z.string(),
  narrativeGoal: z.string(),
  sections: z.array(z.string()),
  slides: z.array(slideOutlineSchema),
  designGuidance: z.array(z.string()),
});

type PresentationOutlineStepData = {
  status: "loading" | "streaming" | "completed";
  outline?: Partial<z.infer<typeof presentationOutlineSchema>>;
};

type PresentationHtmlStepData = {
  status: "in-progress" | "completed";
  html?: string;
  htmlUrl?: string;
};

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
  execute: async ({ inputData, suspend, resumeData, mastra, writer }) => {
    const { approvedOutline } = resumeData ?? {};

    if (approvedOutline) {
      return {
        ...inputData,
        outline: approvedOutline,
      };
    }

    writer.write({
      type: "data-presentationOutline",
      data: {
        status: "loading",
      } satisfies PresentationOutlineStepData,
    });

    const outlineAgent = mastra.getAgent("presentationOutlineSuggestionAgent");
    const stream = await outlineAgent.stream(
      [
        {
          role: "user",
          content: `Create a reviewable presentation outline for this request:\n${JSON.stringify(
            inputData,
            null,
            2,
          )}`,
        },
      ],
      {
        structuredOutput: {
          schema: presentationOutlineSchema,
        },
      },
    );

    for await (const chunk of stream.objectStream) {
      writer.write({
        type: "data-presentationOutline",
        data: {
          status: "streaming",
          outline: chunk,
        } satisfies PresentationOutlineStepData,
      });
    }

    const outline = await stream.object;

    writer.write({
      type: "data-presentationOutline",
      data: {
        status: "completed",
        outline,
      } satisfies PresentationOutlineStepData,
    });

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

const presentationHtmlGenerationStep = createStep({
  id: "presentation-html-generation-step",
  inputSchema: presentationInputSchema.extend({
    outline: presentationOutlineSchema,
  }),
  outputSchema: z.object({
    html: z.string(),
    htmlUrl: z.string().optional(),
  }),
  execute: async ({ inputData, mastra, writer }) => {
    writer.write({
      type: "data-presentationHtml",
      data: {
        status: "in-progress",
      } satisfies PresentationHtmlStepData,
    });

    const generationAgent = mastra.getAgent("presentationHtmlGenerationAgent");
    const result = await generationAgent.generate(
      [
        {
          role: "user",
          content: `Generate a standalone HTML presentation from this approved outline and original request:\n${JSON.stringify(
            inputData,
            null,
            2,
          )}`,
        },
      ],
      {
        structuredOutput: {
          schema: z.object({
            html: z.string(),
          }),
        },
      },
    );

    const html = result.object.html;
    const htmlUrl = await saveHtmlToFile(html, { prefix: "presentation-deck" });

    writer.write({
      type: "data-presentationHtml",
      data: {
        status: "completed",
        html,
        htmlUrl,
      } satisfies PresentationHtmlStepData,
    });

    return {
      html,
      htmlUrl,
    };
  },
});

export const presentationGenerationWorkflow = createWorkflow({
  id: "presentation-generation-workflow",
  inputSchema: presentationInputSchema,
  outputSchema: z.object({
    html: z.string(),
    htmlUrl: z.string().optional(),
  }),
  description:
    "A workflow that drafts a presentation outline for approval, then generates a standalone HTML presentation.",
})
  .then(presentationOutlineSuggestionStep)
  .then(presentationHtmlGenerationStep)
  .commit();
