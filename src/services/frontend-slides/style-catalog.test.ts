import { describe, expect, it } from "vitest";
import { discoverFrontendSlideStyles, getFrontendSlideStyle } from "./style-catalog";

describe("frontend-slides style catalog", () => {
  it("returns three distinct local static image previews for a technical tutorial", () => {
    const result = discoverFrontendSlideStyles({
      topic: "Mastra agent framework",
      audience: "TypeScript developers",
      purpose: "teaching-tutorial",
      density: "reading-first",
    });

    expect(result).toHaveLength(3);
    expect(new Set(result.map((item) => item.style.id)).size).toBe(3);
    expect(result.map((item) => item.style.id)).toContain("terminal-green");
    expect(result.some((item) => item.style.source === "frontend-slides-custom")).toBe(true);
    expect(result.every((item) => item.previewImage.startsWith("/style-previews/"))).toBe(true);
    expect(new Set(result.map((item) => item.previewImage)).size).toBe(3);
  });

  it("returns the complete preset contract by stable style id", () => {
    expect(getFrontendSlideStyle("swiss-modern")).toMatchObject({
      id: "swiss-modern",
      name: "Swiss Modern",
      source: "frontend-slides-preset",
      typography: { display: "Archivo", body: "Nunito" },
      signatureElements: expect.arrayContaining(["visible grid"]),
    });
  });
});
