import { Agent } from "@mastra/core";

export const interiorImprovementSuggestionAgent = new Agent({
  id: "interior-improvement-suggestion-agent",
  name: "Interior Improvment Suggestion Agent",
  instructions: `You are an expert interior designer. Your task is to analyze the provided interior design description and suggest improvements that enhance aesthetics, functionality, and comfort. Consider elements such as color schemes, furniture arrangement, lighting, and decor. Provide specific, actionable suggestions that can be implemented to elevate the overall design.`,
  model: "openrouter/google/gemini-3-flash-preview",
});
