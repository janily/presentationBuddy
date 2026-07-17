import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { discoverFrontendSlideStyles, getFrontendSlideStyle, listFrontendSlideStyles } from "./style-catalog";
import { getBoldPreviewFamily } from "./bold-template-preview";
import boldTemplateContracts from "./bold-template-contracts.generated.json";
import presetStyleContracts from "./preset-style-contracts.generated.json";

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
    expect(result.every((item) => item.previewImage.startsWith("/style-previews/"))).toBe(true);
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
      typography: { display: "Barlow", body: "Barlow" },
      palette: {
        background: "#1C1C1C",
        text: "#F5D200",
        accent: "#F5D200",
      },
    });
  });

  it("has a local static preview image for every bold template", () => {
    const boldTemplateStyles = listFrontendSlideStyles().filter((style) => style.source === "frontend-slides-bold-template");

    expect(boldTemplateStyles).toHaveLength(34);
    for (const style of boldTemplateStyles) {
      expect(getBoldPreviewFamily(style.boldTemplate!.slug)).toBeTruthy();
      expect(existsSync(path.join(process.cwd(), "public", "style-previews", `${style.id}.svg`))).toBe(true);
    }
  });

  it("keeps every generated bold-template cover aligned with the runtime style contract", () => {
    expect(boldTemplateContracts.contracts).toHaveLength(34);

    for (const contract of boldTemplateContracts.contracts) {
      const style = getFrontendSlideStyle(`bold-template-${contract.slug}`);
      const preview = readFileSync(
        path.join(process.cwd(), "public", "style-previews", `bold-template-${contract.slug}.svg`),
        "utf8",
      );

      expect(style).toMatchObject({
        name: contract.name,
        layout: contract.layout,
        typography: contract.typography,
        palette: contract.palette,
        signatureElements: contract.signatureElements,
      });
      expect(preview).toContain(`data-template-slug="${contract.slug}"`);
      expect(preview).toContain(`data-contract-hash="${contract.sourceHash}"`);
      expect(preview).toContain(`data-display-font="${contract.typography.display}"`);
      expect(preview).toContain(contract.palette.background);
      expect(preview).not.toContain("MAKE IT LAND");
      expect(preview).not.toContain("WITH STYLE");
      expect(preview).not.toContain('font-family="Arial Black');
    }
  });

  it("keeps every preset/custom cover aligned with the selectable style contract", () => {
    expect(presetStyleContracts.contracts).toHaveLength(13);

    for (const contract of presetStyleContracts.contracts) {
      const style = getFrontendSlideStyle(contract.id);
      const preview = readFileSync(
        path.join(process.cwd(), "public", "style-previews", `${contract.id}.svg`),
        "utf8",
      );

      expect(style).toMatchObject({
        id: contract.id,
        name: contract.name,
        source: contract.source,
        vibe: contract.vibe,
        layout: contract.layout,
        typography: contract.typography,
        palette: contract.palette,
        signatureElements: contract.signatureElements,
      });
      expect(preview).toContain(`data-style-id="${contract.id}"`);
      expect(preview).toContain(`data-preview-family="${contract.family}"`);
      expect(preview).toContain(`data-contract-hash="${contract.sourceHash}"`);
      expect(preview).toContain(`data-display-font="${contract.typography.display}"`);
      expect(preview).toContain(contract.palette.background);
      expect(preview).toContain(contract.palette.accent);
    }
  });

  it("keeps the Neo-Grid Bold preview promise aligned with its final design recipe", () => {
    const style = getFrontendSlideStyle("bold-template-neo-grid-bold");
    const previewPath = path.join(process.cwd(), "public", "style-previews", "bold-template-neo-grid-bold.svg");
    const preview = readFileSync(previewPath, "utf8");

    expect(style).toMatchObject({
      typography: { display: "Space Grotesk", body: "Space Grotesk" },
      palette: {
        background: "#ECECE8",
        surface: "#F5F4EF",
        text: "#0A0A0A",
        accent: "#E6FF3D",
      },
      layout: expect.stringContaining("12-column × 8-row"),
    });
    expect(style?.signatureElements.join(" ")).toContain("12-column × 8-row");
    expect(style?.signatureElements.join(" ")).toContain("page number");
    expect(getBoldPreviewFamily("neo-grid-bold")).toBe("modular");
    expect(preview).toContain('data-template-slug="neo-grid-bold"');
    expect(preview).toContain('data-grid="12x8"');
    expect(preview).toContain("01 / 10");
    expect(preview).toContain("#E6FF3D");
    expect(preview).toContain("#0A0A0A");
    expect(preview).toContain("Space Grotesk");
    expect(preview).not.toContain("Playfair Display");
    expect(preview).not.toContain("#1e2bfa");
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
