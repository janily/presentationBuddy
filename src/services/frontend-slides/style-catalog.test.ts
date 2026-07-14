import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { discoverFrontendSlideStyles, getFrontendSlideStyle, listFrontendSlideStyles } from "./style-catalog";

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
    expect(result.some((item) => item.style.source === "frontend-slides-bold-template")).toBe(true);
    expect(result.some((item) => item.style.source === "frontend-slides-custom")).toBe(true);
    expect(result.every((item) => item.previewImage.startsWith("/style-previews/"))).toBe(true);
    expect(new Set(result.map((item) => item.previewImage)).size).toBe(3);
  });

  it("exposes bold template metadata needed for final generation", () => {
    expect(getFrontendSlideStyle("bold-template-blue-professional")).toMatchObject({
      id: "bold-template-blue-professional",
      name: "Blue Professional",
      source: "frontend-slides-bold-template",
      boldTemplate: {
        slug: "blue-professional",
        previewMd: "bold-template-pack/templates/blue-professional/preview.md",
        designMd: "bold-template-pack/templates/blue-professional/design.md",
      },
    });
  });

  it("has static preview images for every bold template style", () => {
    const boldTemplateStyles = listFrontendSlideStyles().filter((style) => style.source === "frontend-slides-bold-template");

    expect(boldTemplateStyles).toHaveLength(34);
    for (const style of boldTemplateStyles) {
      expect(existsSync(path.join(process.cwd(), "public", "style-previews", `${style.id}.svg`))).toBe(true);
    }
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

  it("returns a non-repeating next batch when previous styles are excluded", () => {
    const input = {
      topic: "Mastra agent framework",
      audience: "TypeScript developers",
      purpose: "teaching-tutorial" as const,
      density: "reading-first" as const,
    };
    const first = discoverFrontendSlideStyles(input);
    const second = discoverFrontendSlideStyles(input, undefined, {
      excludeIds: first.map((item) => item.style.id),
    });

    expect(second).toHaveLength(3);
    expect(second.every((item) => !first.some((previous) => previous.style.id === item.style.id))).toBe(true);
  });
});
