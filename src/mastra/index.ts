import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { interiorImprovementSuggestionAgent } from "./agents/interior-improvement-suggestion-agent";
import { interiorImageImprovementAgent } from "./agents/interior-image-improvement-agent";
import { interiorImprovementSuggestionWorkflow } from "./workflows/interior-improvement-suggestion-workflow";
import { presentationGenerationWorkflow } from "./workflows/presentation-generation-workflow";

export const mastra = new Mastra({
  agents: {
    interiorImprovementSuggestionAgent,
    interiorImageImprovementAgent,
  },
  workflows: {
    interiorImprovementSuggestionWorkflow,
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
