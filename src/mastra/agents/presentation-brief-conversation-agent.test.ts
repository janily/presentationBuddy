import { describe, expect, it } from "vitest";
import { briefDecisionSchema } from "./presentation-brief-conversation-agent";

describe("briefDecisionSchema", () => {
  it("normalizes omitted optional requirements to an empty string", () => {
    const decision = briefDecisionSchema.parse({
      reply: "Ready to generate.",
      readyToGenerate: true,
      brief: {
        topic: "Mastra introduction",
        audience: "TypeScript developers",
        pageCount: 8,
        style: "technical tutorial",
      },
    });

    expect(decision.brief?.requirements).toBe("");
  });

  it("preserves explicitly supplied requirements", () => {
    const decision = briefDecisionSchema.parse({
      reply: "Ready to generate.",
      readyToGenerate: true,
      brief: {
        topic: "Mastra introduction",
        audience: "TypeScript developers",
        pageCount: 8,
        style: "technical tutorial",
        requirements: "Include a live coding example",
      },
    });

    expect(decision.brief?.requirements).toBe("Include a live coding example");
  });
});
