import { describe, expect, it } from "vitest";
import { mastra } from "@/src/mastra";

describe("frontendSlidesStyleDiscoveryWorkflow", () => {
  it("is registered and returns three previews backed by frontend-slides presets", async () => {
    const workflow = mastra.getWorkflow("frontendSlidesStyleDiscoveryWorkflow");
    const run = await workflow.createRunAsync();
    const result = await run.start({
      inputData: {
        topic: "Mastra agent framework",
        audience: "TypeScript developers",
        purpose: "teaching-tutorial",
        density: "reading-first",
      },
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.result.previews).toHaveLength(3);
      expect(result.result.previews[0].style.source).toBe("frontend-slides-preset");
    }
  });
});
