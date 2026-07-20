# Unified Style Conformance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every frontend-slides style use one server-owned, executable contract that guides generation and rejects visually drifting HTML while preserving per-slide layout freedom.

**Architecture:** Add a deep `style-conformance` module that resolves a trusted `styleId`, compiles existing catalog/manifest data into an executable contract, creates concise model instructions, and evaluates generated HTML independently from structural validation. The workflow stores contract identity and reports in artifacts, uses one repair attempt for non-conformance, and never falls back to a style name when a selected contract is missing.

**Tech Stack:** TypeScript 5, Next.js 16, React 19, Mastra workflows, Zod 4, Vitest 4, existing frontend-slides generated JSON manifests.

## Global Constraints

- Keep `frontendSlidesComposerAgent` as the only HTML generator.
- New-deck generation after style discovery must fail closed when `styleId` is absent or unknown.
- Resolve contract rules on the server; never trust client-submitted contract rules.
- Preserve balanced consistency: identity-defining rules are hard requirements, composition coverage is scored.
- Keep exactly one complete repair regeneration attempt.
- Do not add production conditionals keyed to a specific style ID.
- Keep full-viewport, slide-count, visibility, keyboard-navigation, and reduced-motion validation unchanged.
- Do not add a mandatory vision-model dependency in this implementation.
- Run `pnpm test` and `pnpm lint` before completion.

---

## File Structure

### New files

- `src/services/frontend-slides/style-conformance/schema.ts` — Zod schemas and inferred contract/report types.
- `src/services/frontend-slides/style-conformance/compiler.ts` — trusted style lookup and executable contract compilation.
- `src/services/frontend-slides/style-conformance/generation-context.ts` — compact model-facing contract text.
- `src/services/frontend-slides/style-conformance/evaluator.ts` — generic token, marker, coverage, and score evaluation.
- `src/services/frontend-slides/style-conformance/index.ts` — the small public interface.
- `src/services/frontend-slides/style-conformance/compiler.test.ts` — exhaustive catalog compilation and drift tests.
- `src/services/frontend-slides/style-conformance/generation-context.test.ts` — prompt-context tests.
- `src/services/frontend-slides/style-conformance/evaluator.test.ts` — pass, repair, and contamination fixtures.
- `src/components/presentation-studio/style-selection-request.test.ts` — client request projection tests.

### Modified files

- `src/types/presentation-workflow.ts` — add trusted style identity and conformance result fields.
- `src/mastra/workflows/presentation-generation-schemas.ts` — require/validate `styleId` for styled generation and revision.
- `src/components/presentation-studio/presentation-studio.tsx` — send `styleId`; retain full style object only for UI rendering.
- `src/app/api/analyze/request-validation.ts` — fail closed on missing/unknown styles and normalize server-owned style metadata.
- `src/app/api/analyze/request-validation.test.ts` — request-boundary regression coverage.
- `src/app/api/analyze/revision-workflow-plan.ts` — retain or replace `styleId` correctly.
- `src/app/api/analyze/revision-workflow-plan.test.ts` — style/content revision coverage.
- `src/services/frontend-slides/skill-loader.ts` — load bold-template design from compiled contract identity.
- `src/services/frontend-slides/prompt-builder.ts` — consume compact style generation context.
- `src/services/frontend-slides/prompt-builder.test.ts` — assert all-style contract instructions and flexibility language.
- `src/services/frontend-slides/html-validator.ts` — remove style-specific validation; retain structural validation only.
- `src/services/frontend-slides/html-validator.test.ts` — delete Neo-Grid-only expectations and retain structural assertions.
- `src/mastra/workflows/presentation-generation-workflow.ts` — compile, prompt, evaluate, repair, log, and persist reports.
- `src/mastra/workflows/presentation-generation-workflow.test.ts` — conformance repair behavior.
- `src/services/presentation-artifacts/artifact-store.ts` — persist contract snapshot identity and report.
- `src/services/presentation-artifacts/artifact-store.test.ts` — artifact metadata tests.
- `scripts/generate-bold-template-previews.mjs` — emit contract-version metadata into bold previews.
- `scripts/generate-preset-style-previews.mjs` — emit contract-version metadata into preset previews.
- `src/services/frontend-slides/style-catalog.test.ts` — preview/contract source-hash drift coverage.
- `llmdoc/architecture/frontend-slides-contract.md` — document the new runtime invariant.

---

### Task 1: Define the executable contract and report interface

**Files:**
- Create: `src/services/frontend-slides/style-conformance/schema.ts`
- Create: `src/services/frontend-slides/style-conformance/compiler.test.ts`
- Create: `src/services/frontend-slides/style-conformance/compiler.ts`
- Create: `src/services/frontend-slides/style-conformance/index.ts`

**Interfaces:**
- Consumes: `getFrontendSlideStyle(styleId)` and `listFrontendSlideStyles()` from `style-catalog.ts`.
- Produces: `compileStyleContract(styleId): ExecutableStyleContract` and exported contract/report types.

- [ ] **Step 1: Write failing compiler tests**

Add tests that iterate over `listFrontendSlideStyles()` and assert every style compiles with identity, two required colors, display/body fonts, at least one layout marker, at least one signature, thresholds, source hash, and stable contract version. Add explicit unknown-style and determinism tests:

```ts
it("compiles every catalog style through one interface", () => {
  for (const style of listFrontendSlideStyles()) {
    const contract = compileStyleContract(style.id);
    expect(contract.identity.id).toBe(style.id);
    expect(contract.tokens.colors.required).toEqual([
      style.palette.background,
      style.palette.accent,
    ]);
    expect(contract.grammar.patterns).not.toHaveLength(0);
    expect(contract.signatures).not.toHaveLength(0);
    expect(contract.contractVersion).toMatch(/^v1-[a-f0-9]{12}$/);
  }
});

it("fails closed for an unknown style", () => {
  expect(() => compileStyleContract("missing-style")).toThrow(
    "Unknown frontend-slides style: missing-style",
  );
});
```

- [ ] **Step 2: Run the compiler test and verify red**

Run: `pnpm test -- src/services/frontend-slides/style-conformance/compiler.test.ts`

Expected: FAIL because `compileStyleContract` and its module do not exist.

- [ ] **Step 3: Implement schemas and compiler**

Define these Zod-backed types in `schema.ts`:

```ts
export const executableStyleContractSchema = z.object({
  schemaVersion: z.literal(1),
  contractVersion: z.string().regex(/^v1-[a-f0-9]{12}$/),
  sourceHash: z.string().min(12),
  identity: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.enum(["preset", "bold-template", "custom"]),
    previewAsset: z.string().min(1),
  }),
  tokens: z.object({
    colors: z.object({
      required: z.array(z.string()).min(2),
      optional: z.array(z.string()),
      forbidden: z.array(z.string()),
      allowSupportingColors: z.boolean(),
    }),
    fonts: z.object({
      display: z.string().min(1),
      body: z.string().min(1),
      label: z.string().min(1).optional(),
      cjkFallback: z.string().min(1).optional(),
    }),
  }),
  grammar: z.object({
    patterns: z.array(z.object({
      id: z.string().min(1),
      marker: z.string().min(1),
      minimumSlideCoverage: z.number().min(0).max(1),
    })).min(1),
    density: z.enum(["sparse", "balanced", "dense"]),
    radius: z.object({ minimum: z.number().nonnegative(), maximum: z.number().nonnegative() }),
    shadows: z.enum(["allowed", "restricted", "forbidden"]),
    borders: z.enum(["free", "restricted", "structural"]),
  }),
  signatures: z.array(z.object({
    id: z.string().min(1),
    description: z.string().min(1),
    marker: z.string().min(1),
    minimumSlideCoverage: z.number().min(0).max(1),
  })).min(1),
  prohibitions: z.array(z.object({
    id: z.string().min(1),
    description: z.string().min(1),
    cssPattern: z.string().min(1),
    severity: z.enum(["error", "warning"]),
  })),
  flexibility: z.object({
    allowLayoutVariation: z.boolean(),
    allowDecorativeVariation: z.boolean(),
    allowPerSlideThemeInversion: z.boolean(),
  }),
  thresholds: z.object({
    tokenUsage: z.number().min(0).max(1),
    grammar: z.number().min(0).max(1),
    signatureCoverage: z.number().min(0).max(1),
    overall: z.number().min(0).max(1),
  }),
  recipe: z.object({ designMd: z.string().min(1), slug: z.string().min(1) }).optional(),
});
```

In `compiler.ts`, use catalog data as the trusted source. Normalize source names, derive a source hash from the existing bold/preset generated manifests when available and otherwise from a SHA-256 hash of the canonical style JSON. Convert existing signature descriptions into stable `signature-1` through `signature-3` markers. Use one common layout marker `data-style-layout="<styleId>"`, balanced defaults, and no style-specific branches:

```ts
export function compileStyleContract(styleId: string): ExecutableStyleContract {
  const style = getFrontendSlideStyle(styleId);
  if (!style) throw new Error(`Unknown frontend-slides style: ${styleId}`);

  const sourceHash = resolveGeneratedSourceHash(style) ?? hashCanonicalStyle(style);
  const draft = {
    schemaVersion: 1 as const,
    sourceHash,
    identity: {
      id: style.id,
      name: style.name,
      source: normalizeSource(style.source),
      previewAsset: `/style-previews/${style.id}.svg`,
    },
    tokens: {
      colors: {
        required: [style.palette.background, style.palette.accent],
        optional: [style.palette.surface, style.palette.text, style.palette.secondary],
        forbidden: [],
        allowSupportingColors: true,
      },
      fonts: resolveFontRoles(style),
    },
    grammar: {
      patterns: [{ id: "primary-layout", marker: style.id, minimumSlideCoverage: 0.6 }],
      density: normalizeDensity(style),
      radius: { minimum: 0, maximum: 32 },
      shadows: "restricted" as const,
      borders: "free" as const,
    },
    signatures: style.signatureElements.slice(0, 3).map((description, index) => ({
      id: `signature-${index + 1}`,
      description,
      marker: `signature-${index + 1}`,
      minimumSlideCoverage: index === 0 ? 0.4 : 0.2,
    })),
    prohibitions: [],
    flexibility: {
      allowLayoutVariation: true,
      allowDecorativeVariation: true,
      allowPerSlideThemeInversion: true,
    },
    thresholds: { tokenUsage: 0.9, grammar: 0.6, signatureCoverage: 0.5, overall: 0.75 },
    recipe: style.boldTemplate ? { slug: style.boldTemplate.slug, designMd: style.boldTemplate.designMd } : undefined,
  };

  const contractVersion = `v1-${hashCanonicalStyle(draft).slice(0, 12)}`;
  return executableStyleContractSchema.parse({ ...draft, contractVersion });
}
```

- [ ] **Step 4: Run compiler tests and verify green**

Run: `pnpm test -- src/services/frontend-slides/style-conformance/compiler.test.ts`

Expected: PASS for every catalog style, unknown style, and deterministic version tests.

- [ ] **Step 5: Commit contract foundation**

```powershell
git add src/services/frontend-slides/style-conformance
git commit -m "feat: compile executable style contracts"
```

---

### Task 2: Build concise generation context for every style

**Files:**
- Create: `src/services/frontend-slides/style-conformance/generation-context.ts`
- Create: `src/services/frontend-slides/style-conformance/generation-context.test.ts`
- Modify: `src/services/frontend-slides/style-conformance/index.ts`
- Modify: `src/services/frontend-slides/prompt-builder.ts`
- Modify: `src/services/frontend-slides/prompt-builder.test.ts`

**Interfaces:**
- Consumes: `ExecutableStyleContract` from Task 1.
- Produces: `buildStyleGenerationContext(contract): string`; updated `buildFrontendSlidesMastraPrompt(input, context, styleContext)`.

- [ ] **Step 1: Write failing context tests**

Assert the output includes identity/version, exact colors and fonts, layout/signature markers, forbidden treatments, and explicit flexibility. Assert it does not include the entire `design.md` content twice.

```ts
expect(text).toContain(`data-presentation-style="${contract.identity.id}"`);
expect(text).toContain(`data-style-contract="${contract.contractVersion}"`);
expect(text).toContain(`data-style-layout="${contract.identity.id}"`);
expect(text).toContain('data-style-signature="signature-1"');
expect(text).toContain("You may vary individual slide composition");
```

- [ ] **Step 2: Run tests and verify red**

Run: `pnpm test -- src/services/frontend-slides/style-conformance/generation-context.test.ts src/services/frontend-slides/prompt-builder.test.ts`

Expected: FAIL because the context builder and prompt argument do not exist.

- [ ] **Step 3: Implement compact context**

Render deterministic sections: identity, required tokens, role fonts, layout marker, signatures with coverage percentages, prohibitions, and flexibility. Require markers on real slide roots or real visible descendants; prohibit metadata-only hidden marker elements.

Update the prompt builder to replace the serialized client `styleSpec` block with the compiled context. Keep `design.md` once as optional creative reference, after the executable contract, and state that the executable contract wins on conflict.

- [ ] **Step 4: Run focused prompt tests**

Run: `pnpm test -- src/services/frontend-slides/style-conformance/generation-context.test.ts src/services/frontend-slides/prompt-builder.test.ts`

Expected: PASS; existing viewport and exact-slide-count assertions remain present.

- [ ] **Step 5: Commit generation context**

```powershell
git add src/services/frontend-slides/style-conformance src/services/frontend-slides/prompt-builder.ts src/services/frontend-slides/prompt-builder.test.ts
git commit -m "feat: build model context from style contracts"
```

---

### Task 3: Add generic style conformance evaluation

**Files:**
- Create: `src/services/frontend-slides/style-conformance/evaluator.ts`
- Create: `src/services/frontend-slides/style-conformance/evaluator.test.ts`
- Modify: `src/services/frontend-slides/style-conformance/index.ts`
- Modify: `src/services/frontend-slides/html-validator.ts`
- Modify: `src/services/frontend-slides/html-validator.test.ts`

**Interfaces:**
- Consumes: complete HTML and `ExecutableStyleContract`.
- Produces: `evaluateStyleConformance(html, contract): StyleConformanceReport`.

- [ ] **Step 1: Write failing evaluator fixtures**

Create a two-slide passing fixture that uses canonical variables, expected font roles, layout markers on both slides, and signature markers at required coverage. Add fixtures for missing identity, missing required color/font use, insufficient grammar/signature coverage, forbidden CSS, and another style's markers.

```ts
const report = evaluateStyleConformance(validHtml, contract);
expect(report.outcome).toBe("pass");
expect(report.scores.overall).toBeGreaterThanOrEqual(contract.thresholds.overall);

const drift = evaluateStyleConformance(contaminatedHtml, contract);
expect(drift.passed).toBe(false);
expect(drift.violations.map((item) => item.ruleId)).toContain("style-identity");
```

- [ ] **Step 2: Run tests and verify red**

Run: `pnpm test -- src/services/frontend-slides/style-conformance/evaluator.test.ts`

Expected: FAIL because the evaluator does not exist.

- [ ] **Step 3: Implement generic evaluation**

Parse slide start tags and visible slide fragments. Reuse color/font equivalence helpers currently inside `html-validator.ts` by moving them into private evaluator helpers. Calculate:

```ts
const overall = tokenUsage * 0.35
  + grammar * 0.30
  + signatureCoverage * 0.25
  + density * 0.10;
```

Hard failures are missing identity/version, unused required colors/fonts, no layout pattern, or error-level prohibition matches. Scored failures below thresholds produce `repair`; warnings above thresholds produce `warning`; all-clear produces `pass`.

Remove `getMissingStyleGrammar` and all `styleSpec` handling from `assertFrontendSlidesDocument`. Its final interface becomes:

```ts
assertFrontendSlidesDocument(html: string, expectedSlideCount: number): void
```

- [ ] **Step 4: Run evaluator and structural validator tests**

Run: `pnpm test -- src/services/frontend-slides/style-conformance/evaluator.test.ts src/services/frontend-slides/html-validator.test.ts`

Expected: PASS with no production style-ID conditional remaining.

- [ ] **Step 5: Commit evaluator**

```powershell
git add src/services/frontend-slides/style-conformance src/services/frontend-slides/html-validator.ts src/services/frontend-slides/html-validator.test.ts
git commit -m "feat: evaluate all styles with one conformance engine"
```

---

### Task 4: Make `styleId` the server-owned generation identity

**Files:**
- Modify: `src/types/presentation-workflow.ts`
- Modify: `src/mastra/workflows/presentation-generation-schemas.ts`
- Create: `src/components/presentation-studio/style-selection-request.test.ts`
- Modify: `src/components/presentation-studio/presentation-studio.tsx`
- Modify: `src/app/api/analyze/request-validation.ts`
- Modify: `src/app/api/analyze/request-validation.test.ts`
- Modify: `src/app/api/analyze/revision-workflow-plan.ts`
- Modify: `src/app/api/analyze/revision-workflow-plan.test.ts`

**Interfaces:**
- Consumes: selected UI style and `compileStyleContract(styleId)`.
- Produces: `PresentationBriefData.styleId: string`, `RevisionSpec.styleId?: string`, validated server-owned style name/identity.

- [ ] **Step 1: Write failing request-boundary tests**

Cover:

```ts
expect(validatePresentationWorkflowRequest({
  presentationBrief: { ...brief, styleId: undefined },
}).success).toBe(false);
expect(validatePresentationWorkflowRequest({
  presentationBrief: { ...brief, styleId: "missing" },
}).success).toBe(false);
expect(validatePresentationWorkflowRequest({
  presentationBrief: { ...brief, styleId: "bold-template-neo-grid-bold", styleSpec: forged },
}).data)
  .toMatchObject({ styleId: "bold-template-neo-grid-bold", style: "Neo-Grid Bold" });
```

Add a pure client projection helper test proving selection produces `styleId` even if the complete UI style object is later discarded.

- [ ] **Step 2: Run request tests and verify red**

Run: `pnpm test -- src/components/presentation-studio/style-selection-request.test.ts src/app/api/analyze/request-validation.test.ts src/app/api/analyze/revision-workflow-plan.test.ts`

Expected: FAIL because `styleId` is optional or absent.

- [ ] **Step 3: Implement trusted identity flow**

Add `styleId` to brief/revision schemas. Replace `styleSpec` in network-facing types with `styleId`; keep `FrontendSlidesStyleSpec` only in UI/catalog types. Extract `buildSelectedStyleBrief(style, agentBrief)` as a pure helper used by `presentation-studio.tsx`.

After Zod shape validation, call `compileStyleContract(styleId)` in request normalization. Convert unknown-style errors into a Zod custom issue on `styleId`. Set the presentation display name from the compiled contract, ignoring a forged client name or rules.

Revision rules:

- content/palette/structure revisions retain `presentationBrief.styleId`;
- style revisions require `revision.styleId` and replace the brief identity;
- missing style identity fails before a workflow starts.

- [ ] **Step 4: Run request and revision tests**

Run: `pnpm test -- src/components/presentation-studio/style-selection-request.test.ts src/app/api/analyze/request-validation.test.ts src/app/api/analyze/revision-workflow-plan.test.ts`

Expected: PASS for new, retained, replaced, unknown, and forged style cases.

- [ ] **Step 5: Commit server-owned style identity**

```powershell
git add src/types/presentation-workflow.ts src/mastra/workflows/presentation-generation-schemas.ts src/components/presentation-studio src/app/api/analyze
git commit -m "feat: resolve selected styles on the server"
```

---

### Task 5: Integrate contract compilation, evaluation, and repair into generation

**Files:**
- Modify: `src/services/frontend-slides/skill-loader.ts`
- Modify: `src/mastra/workflows/presentation-generation-workflow.ts`
- Modify: `src/mastra/workflows/presentation-generation-workflow.test.ts`
- Modify: `src/utils/outline-to-slides-mapper.ts`
- Modify: `src/utils/outline-to-slides-mapper.test.ts`

**Interfaces:**
- Consumes: `inputData.styleId`, compiler, generation-context builder, evaluator.
- Produces: validated HTML plus `StyleConformanceReport` in the HTML-generation step result.

- [ ] **Step 1: Write failing workflow repair tests**

Extend the existing injectable repair helper or extract `runWithStyleConformanceRepair`. Verify:

- a conforming initial result calls no repair;
- structural or style `repair` outcome calls repair exactly once;
- persistent non-conformance throws with violation summaries;
- `warning` is deliverable;
- the selected bold recipe loads through `contract.recipe`, not client `styleSpec`.

- [ ] **Step 2: Run workflow tests and verify red**

Run: `pnpm test -- src/mastra/workflows/presentation-generation-workflow.test.ts src/utils/outline-to-slides-mapper.test.ts`

Expected: FAIL because workflow input and repair logic still use `styleSpec`.

- [ ] **Step 3: Integrate the engine**

At the start of the HTML step:

```ts
const styleContract = compileStyleContract(inputData.styleId);
const styleContext = buildStyleGenerationContext(styleContract);
const frontendSlidesContext = await loadFrontendSlidesFinalContext(styleContract);
```

For each generation attempt:

```ts
const document = extractHtmlFromAgentResult(stripHtmlCodeFence(result));
const normalized = ensureFrontendSlidesViewportFill(document);
assertFrontendSlidesDocument(normalized, expectedSlides);
const report = evaluateStyleConformance(normalized, styleContract);
if (report.outcome === "repair" || report.outcome === "fail") {
  throw new StyleConformanceError(report);
}
return { html: normalized, report };
```

Build the repair prompt from `report.violations`, not a generic validation string. Remove `ensureFrontendSlidesStyleContract`; identity/tokens must be generated and evaluated rather than injected after generation. Keep viewport normalization because it enforces a separate structural invariant.

- [ ] **Step 4: Run workflow tests**

Run: `pnpm test -- src/mastra/workflows/presentation-generation-workflow.test.ts src/utils/outline-to-slides-mapper.test.ts src/services/frontend-slides/prompt-builder.test.ts`

Expected: PASS with exactly one repair and no `styleSpec` in workflow input.

- [ ] **Step 5: Commit workflow integration**

```powershell
git add src/mastra/workflows src/services/frontend-slides src/utils/outline-to-slides-mapper.ts src/utils/outline-to-slides-mapper.test.ts
git commit -m "feat: enforce style conformance during generation"
```

---

### Task 6: Persist reports and add safe observability

**Files:**
- Modify: `src/types/presentation-workflow.ts`
- Modify: `src/services/presentation-artifacts/artifact-store.ts`
- Modify: `src/services/presentation-artifacts/artifact-store.test.ts`
- Modify: `src/mastra/workflows/presentation-generation-workflow.ts`
- Modify: `src/mastra/agents/frontend-slides-composer-agent.ts`
- Modify: `src/components/presentation-studio/agent-message-model.ts`
- Modify: `src/components/presentation-studio/presentation-preview-pane.tsx`

**Interfaces:**
- Consumes: compiled contract identity and `StyleConformanceReport`.
- Produces: artifact `styleContract` snapshot, stored report, safe log fields, optional development diagnostics.

- [ ] **Step 1: Write failing artifact tests**

Assert saved artifacts retain:

```ts
styleContract: { styleId, contractVersion, sourceHash }
styleConformance: report
```

and that version advancement preserves the prior contract for content revisions.

- [ ] **Step 2: Run artifact tests and verify red**

Run: `pnpm test -- src/services/presentation-artifacts/artifact-store.test.ts`

Expected: FAIL because artifact metadata fields do not exist.

- [ ] **Step 3: Persist and log metadata**

Add contract snapshot/report to workflow step output and artifact save input. Export a safe `frontendSlidesModelMetadata` object from `frontend-slides-composer-agent.ts`, built from the same provider/model environment precedence used to create the agent, containing only `{ provider, modelId }`. Log only operation ID, run ID, that safe provider/model metadata, style ID, contract version, source hash, recipe-loaded boolean, outcome, numeric scores, violation IDs, and filename. Do not log HTML, prompts, user content, base URLs, or secrets.

Show a development-only conformance badge in the preview details when `process.env.NODE_ENV !== "production"`; ordinary completion copy remains unchanged.

- [ ] **Step 4: Run artifact and message tests**

Run: `pnpm test -- src/services/presentation-artifacts/artifact-store.test.ts src/components/presentation-studio/agent-message-model.test.ts`

Expected: PASS and artifact reports survive version updates.

- [ ] **Step 5: Commit persistence and diagnostics**

```powershell
git add src/types/presentation-workflow.ts src/services/presentation-artifacts src/mastra/workflows/presentation-generation-workflow.ts src/components/presentation-studio
git commit -m "feat: persist style conformance reports"
```

---

### Task 7: Bind previews to contract versions and source hashes

**Files:**
- Modify: `scripts/generate-bold-template-previews.mjs`
- Modify: `scripts/generate-preset-style-previews.mjs`
- Modify: `scripts/generate-style-previews.mjs`
- Modify: `src/services/frontend-slides/style-catalog.test.ts`
- Regenerate: `public/style-previews/*.svg`

**Interfaces:**
- Consumes: compiled contract version/source hash conventions.
- Produces: SVG attributes `data-style-id`, `data-contract-version`, and `data-contract-hash` for every preview.

- [ ] **Step 1: Write failing catalog drift test**

For every style, read its SVG and assert:

```ts
expect(svg).toContain(`data-style-id="${contract.identity.id}"`);
expect(svg).toContain(`data-contract-version="${contract.contractVersion}"`);
expect(svg).toContain(`data-contract-hash="${contract.sourceHash}"`);
```

- [ ] **Step 2: Run test and verify red**

Run: `pnpm test -- src/services/frontend-slides/style-catalog.test.ts`

Expected: FAIL because current SVGs do not consistently contain all three attributes.

- [ ] **Step 3: Update generators and regenerate assets**

Import or reproduce the stable contract-version hashing algorithm in the Node scripts. Emit the metadata on the root `<svg>` for presets, bold templates, and custom styles. Run:

```powershell
node scripts/generate-style-previews.mjs
```

- [ ] **Step 4: Verify preview drift protection**

Run: `pnpm test -- src/services/frontend-slides/style-catalog.test.ts src/services/frontend-slides/style-conformance/compiler.test.ts`

Expected: PASS for every preview asset and catalog style.

- [ ] **Step 5: Commit generated previews**

```powershell
git add scripts public/style-previews src/services/frontend-slides/style-catalog.test.ts
git commit -m "feat: version style previews with contracts"
```

---

### Task 8: Add representative request-to-generation integration coverage

**Files:**
- Modify: `src/app/api/analyze/request-validation.test.ts`
- Modify: `src/mastra/workflows/presentation-generation-workflow.test.ts`
- Modify: `src/mastra/workflows/frontend-slides-style-discovery-workflow.test.ts`
- Modify: `src/components/presentation-studio/style-selection-request.test.ts`

**Interfaces:**
- Consumes: completed styleId, compiler, generation context, evaluator, workflow repair.
- Produces: regression proof for one preset, one bold template, and one custom style.

- [ ] **Step 1: Add three family integration cases**

Use `terminal-green`, `bold-template-neo-grid-bold`, and `circuit-blueprint`. For each case assert:

- discovery returns the style ID and matching preview metadata;
- client request projection includes the style ID;
- API validation resolves the trusted style name;
- generation context includes the matching contract version;
- a conforming fixture passes evaluation;
- cross-style fixture contamination fails or repairs.

- [ ] **Step 2: Run integration cases**

Run: `pnpm test -- src/app/api/analyze/request-validation.test.ts src/mastra/workflows/presentation-generation-workflow.test.ts src/mastra/workflows/frontend-slides-style-discovery-workflow.test.ts src/components/presentation-studio/style-selection-request.test.ts`

Expected: PASS for all three style families.

- [ ] **Step 3: Run the complete unit suite**

Run: `pnpm test`

Expected: all test files pass with zero failures.

- [ ] **Step 4: Commit integration coverage**

```powershell
git add src/app/api/analyze src/mastra/workflows src/components/presentation-studio
git commit -m "test: cover style selection through generation"
```

---

### Task 9: Update architecture documentation and run release verification

**Files:**
- Modify: `llmdoc/architecture/frontend-slides-contract.md`
- Modify if runtime facts changed: `llmdoc/architecture/request-lifecycle-and-workflows.md`

**Interfaces:**
- Consumes: final implemented behavior.
- Produces: accurate architecture documentation and release evidence.

- [ ] **Step 1: Update current-state documentation**

Document:

- `styleId` as the server-owned identity;
- compiler/generation-context/evaluator responsibilities;
- structural validation versus style evaluation;
- balanced scoring and hard invariants;
- exactly one repair attempt;
- artifact contract/report persistence;
- preview source-hash/version drift protection;
- no style-ID-specific production conditionals.

- [ ] **Step 2: Run placeholder and style-specific-branch scans**

Run:

```powershell
rg -n "TBD|TODO|FIXME" src/services/frontend-slides/style-conformance llmdoc/architecture
rg -n "neo-grid-bold|terminal-green|circuit-blueprint" src/services/frontend-slides/style-conformance src/services/frontend-slides/html-validator.ts
```

Expected: first command finds no new placeholders; second command finds style IDs only in tests/fixtures, never production evaluator/compiler branches.

- [ ] **Step 3: Run complete verification**

Run:

```powershell
pnpm test
pnpm lint
pnpm build
git diff --check
```

Expected: all commands exit 0; test output has zero failures; ESLint has zero errors; Next build succeeds; diff check prints nothing.

- [ ] **Step 4: Inspect the final diff**

Run:

```powershell
git status --short
git diff --stat HEAD~8..HEAD
```

Expected: only files in this plan and regenerated preview assets changed; no `.env`, generated presentations, logs, or unrelated user files are included.

- [ ] **Step 5: Commit documentation**

```powershell
git add llmdoc/architecture
git commit -m "docs: document unified style conformance"
```

---

## Execution Checkpoints

- After Task 3: review the contract interface and generic evaluator before changing request schemas.
- After Task 5: generate representative fixtures with the configured Gemini model and inspect the conformance reports before tightening thresholds.
- After Task 8: review all-style compiler results and the three representative family cases before regenerating or publishing decks.

## Completion Evidence

Do not claim completion unless the final turn includes fresh output from `pnpm test`, `pnpm lint`, `pnpm build`, and `git diff --check`, plus a concise statement of the model/style IDs used for representative manual generation.
