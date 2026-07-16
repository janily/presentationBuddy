import { describe, expect, it } from "vitest";
import { ensureFrontendSlidesStyleContract } from "./style-contract";

const studioStyle = {
  id: "bold-template-studio",
  name: "Studio",
  source: "frontend-slides-bold-template" as const,
  vibe: "electric",
  layout: "black and acid yellow",
  typography: { display: "Barlow", body: "IBM Plex Mono" },
  palette: { background: "#1C1C1C", surface: "#242422", text: "#F5D200", accent: "#F5D200", secondary: "#2E2E2C" },
  signatureElements: ["type-as-graphic-mass"],
};

describe("ensureFrontendSlidesStyleContract", () => {
  it("adds canonical style metadata without changing the generated visual rules", () => {
    const original = `<!doctype html><html><head><style>.deck-stage{--accent:#F5D200;color:var(--accent)}</style></head><body><main class="deck-stage"></main></body></html>`;
    const result = ensureFrontendSlidesStyleContract(original, studioStyle);

    expect(result).toContain('data-presentation-style="bold-template-studio"');
    expect(result).toContain('data-presentation-buddy-style-contract="v1"');
    expect(result).toContain("--presentation-style-accent: #F5D200;");
    expect(result).toContain(".deck-stage{--accent:#F5D200;color:var(--accent)}");
  });

  it("is idempotent and replaces stale style metadata", () => {
    const original = `<!doctype html><html><head></head><body><main class="deck-stage" data-presentation-style="old-style"></main></body></html>`;
    const once = ensureFrontendSlidesStyleContract(original, studioStyle);
    const twice = ensureFrontendSlidesStyleContract(once, studioStyle);

    expect(twice).toBe(once);
    expect(twice.match(/data-presentation-buddy-style-contract/g)).toHaveLength(1);
    expect(twice).not.toContain('data-presentation-style="old-style"');
  });

  it("does nothing when no style was selected", () => {
    const original = "<html><head></head><body></body></html>";
    expect(ensureFrontendSlidesStyleContract(original)).toBe(original);
  });
});
