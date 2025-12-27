import { Mastra } from "@mastra/core/mastra";
import { interiorImprovementSuggestionAgent } from "./agents/interior-improvement-suggestion-agent";
import { interiorImageImprovementAgent } from "./agents/interior-image-improvement-agent";
import { testImageAgent } from "./agents/test-image-agent";
import { testWorkflow } from "./workflows/test-workflow";

export const mastra = new Mastra({
  agents: {
    interiorImprovementSuggestionAgent,
    interiorImageImprovementAgent,
    testImageAgent,
  },
  workflows: {
    testWorkflow,
  },

  observability: {
    // Enables DefaultExporter and CloudExporter for AI tracing
    default: { enabled: true },
  },
});
