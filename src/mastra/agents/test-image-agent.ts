import { Agent } from "@mastra/core";

export const testImageAgent = new Agent({
  name: "Interior Image Improvement Agent",
  instructions: `Your task is to create an image from the prompt`,
  model: "openrouter/google/gemini-3-pro-image-preview",
});
