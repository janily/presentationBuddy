import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { presentationHtmlAgent } from "./agents/presentation-html-agent";
import { presentationOutlineAgent } from "./agents/presentation-outline-agent";
import { interiorImprovementSuggestionWorkflow } from "./workflows/interior-improvement-suggestion-workflow";

export const mastra = new Mastra({
  agents: {
    presentationOutlineAgent,
    presentationHtmlAgent,
  },
  workflows: {
    interiorImprovementSuggestionWorkflow,
  },

  observability: {
    // Enables DefaultExporter and CloudExporter for AI tracing
    default: { enabled: true },
  },

  storage: new LibSQLStore({
    url: ":memory:",
  }),
});
