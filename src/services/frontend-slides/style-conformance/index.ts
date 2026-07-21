import { createHash } from "node:crypto";
import { getFrontendSlideStyle } from "../style-catalog";
import type { FrontendSlidesStyleSpec } from "../style-schema";

type StyleSource = "preset" | "bold-template" | "custom";

export type ExecutableStyleContract = {
  schemaVersion: 1;
  contractVersion: string;
  sourceHash: string;
  identity: { id: string; name: string; source: StyleSource; previewAsset: string };
  tokens: {
    colors: { required: string[]; optional: string[]; forbidden: string[]; allowSupportingColors: boolean };
    fonts: { display: string; body: string; label?: string; cjkFallback?: string };
  };
  grammar: {
    patterns: Array<{ id: string; description: string; keywords: string[] }>;
    density: "sparse" | "balanced" | "dense";
    radius: { minimum: number; maximum: number };
    shadows: "allowed" | "restricted" | "forbidden";
    borders: "free" | "restricted" | "structural";
  };
  signatures: Array<{ id: string; description: string; detection: { keywords: string[] }; minimumSlideCoverage: number }>;
  prohibitions: Array<{ id: string; description: string; detection: { keywords: string[] }; severity: "error" | "warning" }>;
  flexibility: { allowLayoutVariation: boolean; allowDecorativeVariation: boolean; allowPerSlideThemeInversion: boolean };
  thresholds: { tokenUsage: number; grammar: number; signatureCoverage: number; overall: number };
};

export type StyleGenerationContext = {
  identityMarker: string;
  contractVersion: string;
  cssCustomProperties: Record<string, string>;
  fontRoles: { display: string; body: string; label?: string; cjkFallback?: string };
  requiredColors: string[];
  optionalColors: string[];
  layoutRules: string[];
  signatureElements: string[];
  forbiddenTreatments: string[];
  flexibilityStatement: string;
};

export type StyleConformanceReport = {
  styleId: string;
  contractVersion: string;
  passed: boolean;
  outcome: "pass" | "repair" | "fail" | "warning";
  scores: { tokenUsage: number; grammar: number; signatureCoverage: number; density: number; overall: number };
  violations: Array<{ ruleId: string; severity: "error" | "warning"; message: string; slideNumbers?: number[] }>;
};

function sourceFor(style: FrontendSlidesStyleSpec): StyleSource {
  if (style.source === "frontend-slides-bold-template") return "bold-template";
  if (style.source === "frontend-slides-custom") return "custom";
  return "preset";
}

function hashStyle(style: FrontendSlidesStyleSpec) {
  return createHash("sha256").update(JSON.stringify(style)).digest("hex").slice(0, 16);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cssText(html: string) {
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]).join("\n");
}

function slideHtml(html: string) {
  return [...html.matchAll(/<section\b[^>]*class\s*=\s*(["'])(?=[^"']*\bslide\b)[^"']*\1[^>]*>[\s\S]*?<\/section>/gi)].map((match) => match[0]);
}

function containsToken(haystack: string, token: string) {
  if (!token.trim()) return true;
  return new RegExp(escapeRegExp(token), "i").test(haystack);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export const styleConformanceEngine = {
  async compile(styleId: string): Promise<ExecutableStyleContract> {
    const style = getFrontendSlideStyle(styleId);
    if (!style) throw new Error(`Selected style is unavailable: ${styleId}`);
    const requiredColors = [style.palette.background, style.palette.accent, style.palette.text];
    return {
      schemaVersion: 1,
      contractVersion: `style-contract-v1-${hashStyle(style)}`,
      sourceHash: hashStyle(style),
      identity: { id: style.id, name: style.name, source: sourceFor(style), previewAsset: `/style-previews/${style.id}.svg` },
      tokens: { colors: { required: requiredColors, optional: [style.palette.surface, style.palette.secondary], forbidden: [], allowSupportingColors: true }, fonts: { ...style.typography, cjkFallback: "Noto Sans SC" } },
      grammar: { patterns: [{ id: "catalog-layout", description: style.layout, keywords: style.layout.split(/[\s,，、-]+/).filter(Boolean).slice(0, 8) }], density: "balanced", radius: { minimum: 0, maximum: 48 }, shadows: "allowed", borders: "free" },
      signatures: style.signatureElements.slice(0, 5).map((description, index) => ({ id: `signature-${index + 1}`, description, detection: { keywords: description.split(/[\s,，、-]+/).filter(Boolean).slice(0, 6) }, minimumSlideCoverage: index === 0 ? 0.35 : 0.2 })),
      prohibitions: [{ id: "fixed-canvas-scale", description: "fixed 1920x1080 stage scaling or letterboxing", detection: { keywords: ["scale(", "1920px", "1080px", "letterbox", "pillarbox"] }, severity: "error" }],
      flexibility: { allowLayoutVariation: true, allowDecorativeVariation: true, allowPerSlideThemeInversion: false },
      thresholds: { tokenUsage: 0.72, grammar: 0.3, signatureCoverage: 0.2, overall: 0.62 },
    };
  },
  buildGenerationContext(contract: ExecutableStyleContract): StyleGenerationContext {
    return {
      identityMarker: `data-presentation-style="${contract.identity.id}" data-presentation-style-contract="${contract.contractVersion}"`,
      contractVersion: contract.contractVersion,
      cssCustomProperties: {
        "--presentation-style-background": contract.tokens.colors.required[0],
        "--presentation-style-accent": contract.tokens.colors.required[1],
        "--presentation-style-text": contract.tokens.colors.required[2],
        "--presentation-style-display-font": `"${contract.tokens.fonts.display}"`,
        "--presentation-style-body-font": `"${contract.tokens.fonts.body}"`,
      },
      fontRoles: contract.tokens.fonts,
      requiredColors: contract.tokens.colors.required,
      optionalColors: contract.tokens.colors.optional,
      layoutRules: contract.grammar.patterns.map((pattern) => pattern.description),
      signatureElements: contract.signatures.map((signature) => `${signature.description} (use on at least ${Math.round(signature.minimumSlideCoverage * 100)}% of slides)`),
      forbiddenTreatments: contract.prohibitions.map((item) => item.description),
      flexibilityStatement: "Vary individual slide composition to fit content, but keep typography, core palette, layout language, and signature elements recognizably consistent.",
    };
  },
  evaluate(html: string, contract: ExecutableStyleContract): StyleConformanceReport {
    const css = cssText(html);
    const full = `${css}\n${html}`;
    const slides = slideHtml(html);
    const violations: StyleConformanceReport["violations"] = [];
    if (!new RegExp(`class=["'][^"']*\\bdeck-stage\\b[^"']*["'][^>]*data-presentation-style=["']${escapeRegExp(contract.identity.id)}["']`, "i").test(html)) violations.push({ ruleId: "style-identity", severity: "error", message: "Deck stage is missing the selected style identity." });
    if (!html.includes(`data-presentation-style-contract="${contract.contractVersion}"`) && !html.includes(`data-presentation-style-contract='${contract.contractVersion}'`)) violations.push({ ruleId: "contract-version", severity: "error", message: "Deck stage is missing the selected style contract version." });
    for (const font of [contract.tokens.fonts.display, contract.tokens.fonts.body]) if (!containsToken(full, font)) violations.push({ ruleId: `font-${font}`, severity: "error", message: `Required font ${font} was not declared or used.` });
    const colorScores = contract.tokens.colors.required.map((color) => containsToken(full, color) ? 1 : 0);
    contract.tokens.colors.required.forEach((color, index) => { if (!colorScores[index]) violations.push({ ruleId: `color-${color}`, severity: "error", message: `Required color ${color} was not used.` }); });
    const grammarScores = contract.grammar.patterns.map((pattern) => pattern.keywords.some((keyword) => containsToken(full, keyword)) ? 1 : 0);
    if (!grammarScores.some(Boolean)) violations.push({ ruleId: "layout-grammar", severity: "error", message: "No registered layout grammar pattern was detected." });
    const signatureScores = contract.signatures.map((signature) => {
      const matchedSlides = slides.filter((slide) => signature.detection.keywords.some((keyword) => containsToken(slide, keyword))).length;
      return slides.length ? Math.min(1, matchedSlides / Math.max(1, Math.ceil(slides.length * signature.minimumSlideCoverage))) : 0;
    });
    const scores = { tokenUsage: average(colorScores), grammar: average(grammarScores), signatureCoverage: average(signatureScores), density: 1, overall: 0 };
    scores.overall = scores.tokenUsage * 0.35 + scores.grammar * 0.30 + scores.signatureCoverage * 0.25 + scores.density * 0.10;
    const passed = violations.every((violation) => violation.severity !== "error") && scores.overall >= contract.thresholds.overall;
    return { styleId: contract.identity.id, contractVersion: contract.contractVersion, passed, outcome: passed ? "pass" : "repair", scores, violations };
  },
};
