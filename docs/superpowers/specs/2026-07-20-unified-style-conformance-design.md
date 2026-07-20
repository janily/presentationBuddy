# Unified Style Conformance Design

## 1. Summary

Presentation Buddy currently loads the `frontend-slides` skill during HTML generation, but the selected visual direction is represented by a mixture of style names, client state, catalog metadata, template documentation, prompt text, and a small number of validator rules. This allows a generated deck to be technically valid while visually drifting away from the style preview.

This design introduces a single server-owned `StyleConformanceEngine`. It compiles every preset, bold template, and custom style into the same executable contract, produces concise generation instructions, and evaluates the resulting HTML with both hard invariants and balanced visual-identity thresholds.

The selected policy is **balanced consistency**:

- Typography, core palette, layout language, and signature elements must remain recognizably consistent.
- The model may vary individual slide composition to fit the content.
- A deck must never silently fall back to a generic style when a selected style cannot be resolved or validated.

## 2. Goals

- Apply one conformance mechanism to every style rather than adding template-specific branches.
- Make the server, not React state or agent-produced brief data, the source of truth for the selected style.
- Preserve useful model creativity while enforcing a recognizable visual identity.
- Detect style drift before delivery and provide actionable regeneration feedback.
- Make style selection, contract compilation, prompt construction, and validation independently testable through stable interfaces.
- Allow new styles to be added primarily through data and contract generation rather than validator code changes.

## 3. Non-goals

- Pixel-perfect replication of a reference cover on every slide.
- A rigid slide-template DSL in which the model can only fill predefined layouts.
- Replacing the HTML generator or model-provider abstraction.
- Running a vision model for every generation in the first implementation phase.
- Reworking the briefing, outline approval, revision proposal, or artifact concurrency state machines beyond the fields needed for style identity.

## 4. Current Problems

### 4.1 Style identity crosses the workflow as optional client data

The client currently keeps a complete `FrontendSlidesStyleSpec` in React state and attempts to include it in the generation brief. If it is absent at a later boundary, generation continues using only a style name. The final HTML can therefore describe itself as a selected style without receiving that style's full contract or `design.md` recipe.

### 4.2 Preview and generation are separate implementations

Discovery displays static SVG assets. Final HTML is independently synthesized from catalog metadata and prompt text. The preview is a visual promise, but no shared executable contract currently guarantees that the final deck preserves that promise.

### 4.3 Validation is primarily structural

The validator proves that the HTML is complete and navigable. Style checks only run when `styleSpec` is present, and the only specialized grammar check is a Neo-Grid rule. This does not scale to all styles and does not measure whether signature elements recur across the deck.

### 4.4 The model receives a large, partly redundant context

The generator receives the main skill, HTML reference, viewport CSS, animation guide, style presets, selected template recipe, outline, and additional instructions. Important style rules compete with general guidance and legacy fixed-canvas language. A stronger model can follow this context, but the system should make essential requirements concise and explicit for every supported model.

## 5. Architecture

### 5.1 Deep module: `StyleConformanceEngine`

Create a module under `src/services/frontend-slides/style-conformance/`. Its interface is intentionally small:

```ts
interface StyleConformanceEngine {
  compile(styleId: string): Promise<ExecutableStyleContract>;
  buildGenerationContext(contract: ExecutableStyleContract): StyleGenerationContext;
  evaluate(html: string, contract: ExecutableStyleContract): StyleConformanceReport;
}
```

The module hides catalog lookup, source parsing, normalization, scoring, selector inspection, and report construction. Callers do not need to know whether a style originated from `STYLE_PRESETS.md`, a bold-template `design.md`, or a custom definition.

### 5.2 Server-owned identity

The external generation interface accepts a required `styleId` after discovery. The server resolves that ID from its own catalog and compiles the complete contract.

The client may retain the complete style object for rendering the discovery UI, but it is advisory display state. It is no longer the authority for generation.

Rules:

- New-deck generation cannot start without a valid selected `styleId`.
- The server rejects unknown or unavailable IDs before outline or HTML generation begins.
- The resolved contract identity and version are copied into the presentation artifact.
- Revisions retain the current contract unless the user explicitly selects a new style.
- A full style change resolves a new server-owned contract and regenerates the entire deck.

### 5.3 Contract sources

All style families compile into the same contract:

- **Preset:** generated manifest derived from `STYLE_PRESETS.md` plus explicit machine-readable rules.
- **Bold template:** generated manifest derived from `design.md`; `design.md` remains human-readable source material but is not parsed on every request.
- **Custom style:** checked-in machine-readable manifest authored alongside its preview asset.

Generated manifests must include a source hash. CI or local tests fail when a source document changes without regenerating its manifest and preview metadata.

## 6. Executable Contract

```ts
type ExecutableStyleContract = {
  schemaVersion: 1;
  contractVersion: string;
  sourceHash: string;
  identity: {
    id: string;
    name: string;
    source: "preset" | "bold-template" | "custom";
    previewAsset: string;
  };
  tokens: {
    colors: {
      required: string[];
      optional: string[];
      forbidden: string[];
      allowSupportingColors: boolean;
    };
    fonts: {
      display: string;
      body: string;
      label?: string;
      cjkFallback?: string;
    };
  };
  grammar: {
    patterns: LayoutPattern[];
    density: "sparse" | "balanced" | "dense";
    radius: { minimum: number; maximum: number };
    shadows: "allowed" | "restricted" | "forbidden";
    borders: "free" | "restricted" | "structural";
  };
  signatures: Array<{
    id: string;
    description: string;
    detection: SignatureDetectionRule;
    minimumSlideCoverage: number;
  }>;
  prohibitions: Array<{
    id: string;
    description: string;
    detection: ProhibitionDetectionRule;
    severity: "error" | "warning";
  }>;
  flexibility: {
    allowLayoutVariation: boolean;
    allowDecorativeVariation: boolean;
    allowPerSlideThemeInversion: boolean;
  };
  thresholds: {
    tokenUsage: number;
    grammar: number;
    signatureCoverage: number;
    overall: number;
  };
};
```

`LayoutPattern`, detection rules, and scoring details are internal discriminated unions. The first implementation should support only selectors and CSS features that existing styles actually need. New rule types are added when a second style requires them, avoiding a speculative general-purpose CSS engine.

## 7. Balanced Conformance Policy

### 7.1 Hard invariants

Any failure rejects the generated deck and triggers the existing single repair attempt:

- Style identity and contract version are present on `.deck-stage`.
- Required fonts are declared and used in their intended roles.
- Required core colors are used in rendered rules.
- Explicitly forbidden colors or visual treatments are absent.
- Full-viewport, slide count, visibility switching, navigation, and reduced-motion rules remain valid.
- At least one registered layout pattern is used on the deck.

### 7.2 Scored requirements

These preserve flexibility while measuring identity:

- Token usage across rendered selectors.
- Layout grammar usage across slide roots.
- Signature-element coverage across the deck.
- Density alignment with the chosen style and presentation density.

A representative scoring model is:

```text
overall = tokenUsage × 0.35
        + grammar × 0.30
        + signatureCoverage × 0.25
        + density × 0.10
```

Contracts may override thresholds but not weights in the first release. Keeping weights global makes scores comparable and prevents each style from inventing its own meaning of conformance.

### 7.3 Outcomes

- **Pass:** all hard invariants pass and overall score meets the contract threshold.
- **Repair:** a hard invariant fails or overall score is below threshold; regenerate once with a concise failure report.
- **Fail:** repaired output still fails; do not silently deliver it as the selected style.
- **Warning:** score passes but a non-blocking recommendation is missed. Deliver normally and retain the report for diagnostics.

## 8. Generation Context

`buildGenerationContext` produces a compact model-facing representation instead of asking the model to infer critical rules from a long document.

It contains:

- Exact identity marker and contract version.
- Required CSS custom properties.
- Font roles and CJK fallback behavior.
- Core and optional palette.
- Three to seven concrete layout rules.
- Three to five signature elements with minimum recurrence guidance.
- Explicit forbidden treatments.
- A statement of what the model may vary.

The selected `design.md` may remain available as supporting creative reference for bold templates, but the executable generation context takes priority. Legacy fixed-canvas instructions are removed during manifest generation rather than contradicted at the end of every prompt.

## 9. Validation and Reporting

`evaluate` returns data rather than throwing immediately:

```ts
type StyleConformanceReport = {
  styleId: string;
  contractVersion: string;
  passed: boolean;
  outcome: "pass" | "repair" | "fail" | "warning";
  scores: {
    tokenUsage: number;
    grammar: number;
    signatureCoverage: number;
    density: number;
    overall: number;
  };
  violations: Array<{
    ruleId: string;
    severity: "error" | "warning";
    message: string;
    slideNumbers?: number[];
  }>;
};
```

The existing HTML validator remains responsible for document integrity. Style conformance becomes a separate module called immediately afterward. This keeps structural correctness and visual identity independently understandable and testable.

Repair prompts include only failed rules and expected corrections, for example:

```text
The output used the correct palette but failed the selected style contract:
- Required label font JetBrains Mono was not used.
- Signature block-mark appeared on 1/12 slides; minimum coverage is 40%.
- A forbidden blue accent was detected on slides 3 and 8.

Regenerate the complete deck, preserving content and slide order.
```

## 10. Preview Fidelity

Static previews may remain for performance, but they must be generated from the same manifest used by `StyleConformanceEngine`.

Each preview asset records:

- `styleId`
- `contractVersion`
- `sourceHash`
- canonical fonts and palette
- preview generator version

Discovery rejects or hides previews whose metadata does not match the active contract. This does not make the final deck pixel-identical to the preview; it guarantees they originate from the same visual rules.

A later enhancement may generate topic-specific title previews, but it is not required to establish reliable all-style conformance.

## 11. Optional Visual QA

Browser screenshot analysis is a second quality seam, not part of the initial hard dependency.

```ts
interface VisualQaAdapter {
  inspect(input: {
    screenshots: SlideScreenshot[];
    contract: ExecutableStyleContract;
  }): Promise<VisualQaReport>;
}
```

The first adapter may be deterministic browser checks for overflow, overlap, and excessive empty regions. A vision-model adapter is introduced only if both deterministic checks and model-based inspection are actively supported; until then, no hypothetical adapter interface is needed in production code.

Visual QA initially samples:

- title slide;
- one representative content slide;
- one dense or code/table slide;
- closing slide;
- 16:9 and actual embedded-preview viewport sizes.

## 12. Data Flow

### 12.1 New deck

```text
Style discovery returns styleId + preview metadata
  → user selects styleId
  → generation request sends styleId
  → server compiles contract
  → artifact draft stores contract identity/version
  → outline generation retains style identity only
  → HTML prompt receives StyleGenerationContext
  → structural validation
  → style conformance evaluation
  → pass or one full repair regeneration
  → final artifact stores conformance report
```

### 12.2 Style revision

```text
User selects new styleId
  → server resolves new contract
  → revision is forced to full-deck visual restyle
  → old content/order retained
  → old visual guidance removed
  → generate and evaluate against new contract
  → artifact version advances only after pass
```

### 12.3 Content revision

```text
Existing artifact contract identity/version retained
  → affected slides regenerated
  → complete returned deck evaluated against same contract
  → artifact advances only after pass
```

## 13. Error Handling and Observability

Each generation log entry includes:

- operation ID and workflow run ID;
- model provider and model ID;
- style ID, contract version, and source hash;
- whether a bold-template recipe was loaded;
- initial and repaired conformance outcomes;
- score summary and violation rule IDs;
- generated artifact filename.

Do not log prompts, user content, API keys, or full HTML.

User-visible failures distinguish:

- selected style unavailable;
- style contract stale and requiring regeneration;
- model output structurally invalid;
- model output visually non-conforming after repair;
- generation timeout or cancellation.

The UI may show the style name and conformance result in development diagnostics, but ordinary users receive concise recovery guidance rather than internal rule IDs.

## 14. Testing Strategy

### 14.1 Contract compiler tests

- Every catalog style compiles successfully.
- IDs, source hashes, preview metadata, and contract versions agree.
- Required rules exist for every style.
- Source changes without regenerated manifests fail a drift test.

### 14.2 Conformance evaluator tests

For every style, maintain:

- a minimal passing HTML fixture;
- fixtures failing required fonts, palette, grammar, and signatures;
- a fixture that varies layout while remaining conforming;
- a fixture contaminated by another style's visual vocabulary.

Fixtures should be generated from small shared builders, not full copied presentations.

### 14.3 Workflow tests

- Selected `styleId` survives UI request preparation and API validation.
- Unknown or missing IDs fail closed.
- The server recompiles the contract instead of accepting client-provided rule data.
- The correct generation context reaches the composer.
- Initial conformance failure triggers exactly one repair.
- Persistent failure prevents artifact publication.
- Content and style revisions retain or replace contracts correctly.

### 14.4 Browser tests

- Click each representative style family, confirm generation, and inspect the `/api/analyze` request.
- Assert generated HTML carries the expected style identity and contract version.
- Render title, content, dense, and closing slides at 1280×720 and embedded-preview dimensions.
- Check overflow and overlap deterministically.

Use representative styles from preset, bold-template, and custom families in browser tests; exhaustive all-style verification belongs in compiler/evaluator tests.

## 15. Migration Plan

### Phase 1: Contract foundation

- Add contract schema, generated manifests, compiler, and drift tests.
- Convert all existing styles without changing generation behavior.
- Remove the Neo-Grid-specific branch once equivalent generic rules exist.

### Phase 2: Server-owned style selection

- Add required `styleId` to new-deck generation.
- Resolve contracts server-side.
- Store contract identity/version in artifacts.
- Add request-boundary diagnostics and integration tests.

### Phase 3: Prompt and evaluator integration

- Generate compact `StyleGenerationContext`.
- Run generic conformance evaluation after structural validation.
- Feed violations into the existing single repair attempt.
- Fail closed after persistent non-conformance.

### Phase 4: Preview and browser QA

- Regenerate preview metadata from contracts.
- Add browser-level request and rendering tests.
- Add deterministic screenshot QA where it provides reliable signal.

Each phase should leave the repository releasable and retain the single frontend-slides HTML generator invariant.

## 16. Acceptance Criteria

- Every catalog style compiles into `ExecutableStyleContract` through the same interface.
- No production validator contains a style-ID-specific conditional.
- New-deck generation after discovery requires only a trusted server-resolved `styleId`, not a client-authored contract.
- Every generated artifact records style ID, contract version, and conformance report.
- Missing or unknown selected styles fail before model generation.
- Structurally valid but visually non-conforming output receives one repair attempt and is not silently delivered after a second failure.
- Preset, bold-template, and custom representative E2E cases prove selection-to-workflow propagation.
- Preview metadata and executable contract source hashes cannot drift undetected.
- The model remains free to vary individual slide composition within the selected style's declared flexibility.

## 17. Risks and Mitigations

- **Over-constraining creativity:** keep most composition rules scored rather than hard; enforce only identity-defining invariants.
- **False positives from CSS parsing:** begin with existing style needs, use a real CSS parser if regex rules become nested or ambiguous, and keep fixture coverage per rule type.
- **Contract authoring cost:** generate manifests from existing sources, then require only small explicit additions for rules that cannot be derived safely.
- **Model differences:** use the same evaluation independent of provider; tune contracts rather than adding provider-specific prompts.
- **Longer generation after repair:** retain one repair attempt, use concise violation reports, and expose clear failure instead of repeated blind regeneration.
- **Preview mismatch remains subjective:** guarantee shared contract provenance first; add visual QA only for measurable problems or when a vision adapter proves reliable.
