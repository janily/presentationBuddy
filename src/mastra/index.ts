import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { presentationBriefConversationAgent } from "./agents/presentation-brief-conversation-agent";
import { presentationHtmlGenerationAgent } from "./agents/presentation-html-generation-agent";
import { presentationOutlineSuggestionAgent } from "./agents/presentation-outline-suggestion-agent";
import { presentationGenerationWorkflow } from "./workflows/presentation-generation-workflow";

function createMastra() {
  return new Mastra({
    agents: {
      presentationBriefConversationAgent,
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
}

// Reuse a single instance across Next.js dev hot reloads and route entrypoints;
// re-instantiating throws "AI Tracing instance 'default' already registered"
// and would also reset the in-memory workflow run store between requests.
const globalForMastra = globalThis as unknown as { __presentationBuddyMastra?: ReturnType<typeof createMastra> };

export const mastra = globalForMastra.__presentationBuddyMastra ?? createMastra();

if (process.env.NODE_ENV !== "production") {
  globalForMastra.__presentationBuddyMastra = mastra;
}
