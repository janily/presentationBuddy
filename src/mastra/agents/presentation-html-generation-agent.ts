import { Agent } from "@mastra/core";
import { getConfiguredModel } from "../../utils/model-provider";

const DEFAULT_PRESENTATION_HTML_MODEL = "google/gemini-3-flash-preview";

export const presentationHtmlGenerationAgent = new Agent({
  id: "presentation-html-generation-agent",
  name: "Presentation HTML Generation Agent",
  instructions: `You are an expert front-end presentation generator. Convert an approved presentation outline into a complete, polished, self-contained HTML presentation.

Requirements:
- Return only valid HTML in the html field when structured output is requested.
- Use semantic HTML and embedded CSS in a <style> tag.
- Create one full-screen slide section for each approved outline slide.
- Include speaker-friendly hierarchy, concise copy, and visual layout details that match the requested style.
- Do not reference external assets unless the user explicitly requires them.
- Make the result suitable to save as a standalone .html file.`,
  model: getConfiguredModel(
    process.env.PRESENTATION_HTML_MODEL,
    DEFAULT_PRESENTATION_HTML_MODEL,
    process.env.PRESENTATION_HTML_PROVIDER,
  ),
});
