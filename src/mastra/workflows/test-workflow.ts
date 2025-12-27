import { getBase64FromFileUrl } from "@/src/utils/get-base-64-from-file-url";
import { createStep, createWorkflow } from "@mastra/core";
import z from "zod";

export const testImageStep = createStep({
  id: "test-image-step",
  inputSchema: z.object({
    prompt: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { prompt } = inputData;

    // const base64Image = await getBase64FromFileUrl(imageUrl);
    //
    // conso

    console.log("hello");
    const improvementAgent = mastra.getAgent("testImageAgent");

    const result = await improvementAgent.generate([
      {
        role: "user",
        content: [{ type: "text", text: prompt }],
      },
    ]);

    result.files[0].payload.data

    return { success: true };
  },
});

export const testWorkflow = createWorkflow({
  id: "test-workflow",
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({ success: z.boolean() }),
  description: "A workflow to test image generation.",
})
  .then(testImageStep)
  .commit();
