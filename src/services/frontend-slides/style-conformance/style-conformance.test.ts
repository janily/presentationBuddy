import { describe, expect, it } from "vitest";
import { ensureFrontendSlidesStyleContract } from "../style-contract";
import { styleConformanceEngine } from ".";

function buildHtml(styleId = "terminal-green", contractVersion?: string) {
  return `<!doctype html><html><head><style>
:root{--presentation-style-background:#0d1117;--presentation-style-accent:#39d353;--presentation-style-text:#e6edf3;--presentation-style-display-font:"JetBrains Mono";--presentation-style-body-font:"JetBrains Mono"}
.deck-viewport,.deck-stage,.slide{width:100vw;height:100vh}.deck-stage{background:#0d1117;color:#e6edf3;font-family:"JetBrains Mono"}.slide{visibility:hidden;pointer-events:none}.slide.active{visibility:visible;pointer-events:auto}/* GitHub 深色终端界面与代码层级 */.prompt{color:#39d353}.scan-lines{}.blinking-cursor{}.code-syntax-styling{}@media(prefers-reduced-motion:reduce){*{animation:none!important}}
</style></head><body><div class="deck-viewport"><main class="deck-stage" data-presentation-style="${styleId}"${contractVersion ? ` data-presentation-style-contract="${contractVersion}"` : ""}><section class="slide active"><h1>Terminal Green</h1><p class="scan-lines blinking-cursor code-syntax-styling">developer terminal system</p></section><section class="slide"><h2>Code</h2><p class="scan-lines blinking-cursor code-syntax-styling">code syntax styling</p></section></main></div><script>addEventListener("keydown",()=>{})</script></body></html>`;
}

describe("styleConformanceEngine", () => {
  it("compiles catalog styles into executable contracts and generation context", async () => {
    const contract = await styleConformanceEngine.compile("terminal-green");
    const context = styleConformanceEngine.buildGenerationContext(contract);

    expect(contract.identity).toMatchObject({ id: "terminal-green", source: "preset" });
    expect(contract.contractVersion).toContain(contract.sourceHash);
    expect(context.identityMarker).toContain('data-presentation-style="terminal-green"');
    expect(context.cssCustomProperties["--presentation-style-accent"]).toBe("#39d353");
  });

  it("passes HTML that carries the selected identity, version, palette, fonts, grammar, and signatures", async () => {
    const contract = await styleConformanceEngine.compile("terminal-green");
    const report = styleConformanceEngine.evaluate(buildHtml("terminal-green", contract.contractVersion), contract);

    expect(report.passed).toBe(true);
    expect(report.outcome).toBe("pass");
    expect(report.scores.overall).toBeGreaterThanOrEqual(contract.thresholds.overall);
  });

  it("repairs HTML that omits server-owned identity markers", async () => {
    const contract = await styleConformanceEngine.compile("terminal-green");
    const report = styleConformanceEngine.evaluate(buildHtml("terminal-green"), contract);

    expect(report.passed).toBe(false);
    expect(report.violations.map((violation) => violation.ruleId)).toContain("contract-version");
  });

  it("injects the server-resolved contract version on deck-stage", async () => {
    const contract = await styleConformanceEngine.compile("terminal-green");
    const html = ensureFrontendSlidesStyleContract(buildHtml("wrong-style"), undefined, contract);

    expect(html).toContain('data-presentation-style="terminal-green"');
    expect(html).toContain(`data-presentation-style-contract="${contract.contractVersion}"`);
  });
});
