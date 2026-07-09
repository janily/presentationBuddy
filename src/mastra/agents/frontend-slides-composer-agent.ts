import { Agent } from "@mastra/core";
import { getConfiguredModel } from "../../utils/model-provider";

const DEFAULT_FRONTEND_SLIDES_MODEL = "google/gemini-3-flash-preview";

export const frontendSlidesComposerAgent = new Agent({
  id: "frontend-slides-composer-agent",
  name: "Frontend Slides Composer Agent",
  instructions: `You generate production-ready standalone HTML presentations from approved outlines.

You must follow the frontend-slides rules provided in the user prompt exactly:
- fixed 1920x1080 stage
- self-contained HTML/CSS/JS
- .slide elements with visibility-based switching
- distinctive design, typography, and motion
- no markdown fences and no commentary

Return only the complete HTML document.`,
  model: getConfiguredModel(
    process.env.FRONTEND_SLIDES_MASTRA_MODEL ?? process.env.PRESENTATION_HTML_MODEL,
    DEFAULT_FRONTEND_SLIDES_MODEL,
    process.env.FRONTEND_SLIDES_MASTRA_PROVIDER ?? process.env.PRESENTATION_HTML_PROVIDER,
  ),
});
