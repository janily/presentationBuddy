import { Agent } from "@mastra/core";
import { getConfiguredModel } from "../../utils/model-provider";

const DEFAULT_FRONTEND_SLIDES_MODEL = "google/gemini-3-flash-preview";

export const frontendSlidesComposerAgent = new Agent({
  id: "frontend-slides-composer-agent",
  name: "Frontend Slides Composer Agent",
  instructions: `You generate production-ready standalone HTML presentations from approved outlines.

You must follow the frontend-slides rules provided in the user prompt exactly:
- full-viewport stage that fills the browser without canvas scaling
- self-contained HTML/CSS/JS
- .slide elements with visibility-based switching
- distinctive design, typography, and motion
- no markdown fences and no commentary

Preserve the approved outline's facts and explicitly labeled placeholders. Never invent metrics, dates, quotes, citations, or business achievements to fill a chart or layout. If a chart needs data that the outline does not contain, use a qualitative diagram or a clearly labeled missing-data placeholder instead. Visual polish must not change the factual content.

Return only the complete HTML document.`,
  model: getConfiguredModel(
    process.env.FRONTEND_SLIDES_MASTRA_MODEL ?? process.env.PRESENTATION_HTML_MODEL,
    DEFAULT_FRONTEND_SLIDES_MODEL,
    process.env.FRONTEND_SLIDES_MASTRA_PROVIDER ?? process.env.PRESENTATION_HTML_PROVIDER,
  ),
});
