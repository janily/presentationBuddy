import { describe, expect, it } from "vitest";
import { ensureFrontendSlidesViewportFill } from "./viewport-fill";

describe("ensureFrontendSlidesViewportFill", () => {
  it("injects an idempotent full-viewport override without fixed-stage scaling", () => {
    const original = `<!doctype html><html><head><style>
      .deck-stage { width: 1920px; height: 1080px; transform: scale(.5); }
    </style></head><body></body></html>`;
    const result = ensureFrontendSlidesViewportFill(original);

    expect(result).toContain('data-presentation-buddy-viewport-fill="v1"');
    expect(result).toContain("width: 100vw !important");
    expect(result).toContain("height: 100dvh !important");
    expect(result).toContain("transform: none !important");
    expect(result.indexOf('data-presentation-buddy-viewport-fill="v1"')).toBeLessThan(
      result.indexOf("</head>"),
    );
    expect(ensureFrontendSlidesViewportFill(result)).toBe(result);
  });
});
