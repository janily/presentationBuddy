import { Agent } from "@mastra/core";

export const presentationOutlineSuggestionAgent = new Agent({
  id: "presentation-outline-suggestion-agent",
  name: "Presentation Outline Suggestion Agent",
  instructions: `You are an expert presentation strategist and slide designer. Create reviewable presentation outlines from a user's topic, audience, desired page count, style, and requirements.

Your output must be practical for a human to review before generation. Include:
- A concise presentation title
- A short narrative goal
- A clear section structure
- One entry for each slide/page with title, purpose, key points, and design suggestions
- Global design guidance for visual style, typography, color, and layout

Keep recommendations specific, audience-aware, and directly actionable.`,
  model: "openrouter/google/gemini-3-flash-preview",
});
