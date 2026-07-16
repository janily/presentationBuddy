import { describe, expect, it } from "vitest";
import { discoverFrontendSlideStyles, getFrontendSlideStyle, listFrontendSlideStyles } from "./style-catalog";
import { getBoldPreviewFamily } from "./bold-template-preview";

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
    expect(new Set(result.map((item) => item.previewImage)).size).toBe(3);
    expect(result.every((item) => item.previewImage.startsWith("/style-previews/") || item.previewImage.startsWith("data:image/svg+xml"))).toBe(true);
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

  it("uses the Studio design recipe typography in the selectable style contract", () => {
    expect(getFrontendSlideStyle("bold-template-studio")).toMatchObject({
      typography: { display: "Barlow", body: "IBM Plex Mono" },
      palette: {
        background: "#1C1C1C",
        text: "#F5D200",
        accent: "#F5D200",
      },
    });
  });

  it("assigns every bold template a generated preview family", () => {
    const boldTemplateStyles = listFrontendSlideStyles().filter((style) => style.source === "frontend-slides-bold-template");

    expect(boldTemplateStyles).toHaveLength(34);
    for (const style of boldTemplateStyles) {
      expect(getBoldPreviewFamily(style.boldTemplate!.slug)).toBeTruthy();
    }
  });

  it("renders bold previews from the real topic with visually distinct composition families", () => {
    const boldIds = ["bold-template-raw-grid", "bold-template-capsule", "bold-template-editorial-forest"];
    const result = discoverFrontendSlideStyles({
      topic: "Mastra Agent 开发框架入门",
      audience: "TypeScript 开发者",
      purpose: "teaching-tutorial",
      density: "reading-first",
    }, undefined, { limit: listFrontendSlideStyles().length })
      .filter((item) => boldIds.includes(item.style.id));

    const decoded = result.map((item) => decodeURIComponent(item.previewImage.split(",")[1]));
    expect(decoded).toHaveLength(3);
    expect(decoded.every((svg) => svg.includes("Mastra Agent"))).toBe(true);
    expect(new Set(decoded.map((svg) => svg.match(/data-preview-family="([^"]+)"/)?.[1])).size).toBe(3);
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
    const boldFamilies = second
      .filter((item) => item.style.boldTemplate)
      .map((item) => getBoldPreviewFamily(item.style.boldTemplate!.slug));
    expect(new Set(boldFamilies).size).toBe(boldFamilies.length);
  });
});
