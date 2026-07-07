import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { presentationHtmlGenerationAgent } from "./agents/presentation-html-generation-agent";
import { presentationOutlineSuggestionAgent } from "./agents/presentation-outline-suggestion-agent";
import { presentationGenerationWorkflow } from "./workflows/presentation-generation-workflow";

export const mastra = new Mastra({
  agents: {
    presentationOutlineSuggestionAgent,
    presentationHtmlGenerationAgent,
  },
  workflows: {
    presentationGenerationWorkflow,
  },

  observability: {
    // Enables DefaultExporter and CloudExporter for AI tracing
    default: { enabled: true },
  },

  storage: new LibSQLStore({
    url: ":memory:",
  }),
});
