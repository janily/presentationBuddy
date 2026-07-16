import type { FrontendSlidesStyleSpec } from "./style-schema";

export function stripHtmlCodeFence(html: string) {
  return html
    .trim()
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

export function extractHtmlFromAgentResult(result: string) {
  const content = result.trim();
  if (!content) {
    throw new Error("frontend-slides agent returned empty output (stream may have been aborted or truncated)");
  }

  const fencedMatch = content.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const htmlMatch = content.match(/(?:<!doctype html>|<html[\s>])[\s\S]*<\/html>/i);
  if (htmlMatch?.[0]) {
    return htmlMatch[0].trim();
  }

  throw new Error("Failed to extract HTML from frontend-slides agent result");
}

function countExactClassToken(html: string, token: string) {
  return [...html.matchAll(/(?:^|[\s<])class\s*=\s*(["'])(.*?)\1/gi)]
    .filter((match) => match[2].split(/\s+/).includes(token))
    .length;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getStyleSheets(html: string) {
  const styleBlocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1])
    .join("\n");
  const inlineStyles = [...html.matchAll(/\bstyle\s*=\s*(["'])(.*?)\1/gi)]
    .map((match) => match[2])
    .join(";\n");
  const presentationAttributes = [...html.matchAll(/\b(fill|stroke|stop-color|color|font-family)\s*=\s*(["'])(.*?)\2/gi)]
    .map((match) => `${match[1]}: ${match[3]};`)
    .join("\n");

  return [styleBlocks, inlineStyles, presentationAttributes]
    .filter(Boolean)
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function deckStageHasStyleIdentity(html: string, styleId: string) {
  return [...html.matchAll(/<[^>]+>/g)].some((match) => {
    const tag = match[0];
    const classValue = tag.match(/\bclass\s*=\s*(["'])(.*?)\1/i)?.[2] ?? "";
    const styleValue = tag.match(/\bdata-presentation-style\s*=\s*(["'])(.*?)\1/i)?.[2];
    return classValue.split(/\s+/).includes("deck-stage") && styleValue === styleId;
  });
}

function cssDeclaresToken(css: string, property: string, value: string) {
  const quotedValue = value.startsWith("#")
    ? escapeRegExp(value)
    : `["']?${escapeRegExp(value)}["']?`;
  return new RegExp(
    `${escapeRegExp(property)}\\s*:\\s*${quotedValue}(?=\\s*(?:!important\\s*)?(?:;|}|$))`,
    "im",
  ).test(css);
}

function cssUsesVariable(css: string, property: string) {
  return new RegExp(`var\\(\\s*${escapeRegExp(property)}(?=\\s*[,\\)])`, "i").test(css);
}

type CssDeclaration = {
  property: string;
  value: string;
};

function getCssDeclarations(css: string): CssDeclaration[] {
  return [...css.matchAll(/(?:^|[;{])\s*([-\w]+)\s*:\s*([^;{}]*?)(?=\s*(?:;|}))/gim)]
    .map((match) => ({ property: match[1], value: match[2].trim() }));
}

function cssValueContainsToken(value: string, token: string) {
  const normalizedToken = token.trim();
  const hexMatch = normalizedToken.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);

  if (hexMatch) {
    const [, redHex, greenHex, blueHex] = hexMatch;
    const [red, green, blue] = [redHex, greenHex, blueHex].map((channel) => Number.parseInt(channel, 16));
    const hexPattern = `${escapeRegExp(normalizedToken)}(?:[0-9a-f]{2})?(?![0-9a-f])`;
    const rgbPattern = `rgba?\\(\\s*${red}\\s*(?:,\\s*|\\s+)${green}\\s*(?:,\\s*|\\s+)${blue}(?:\\s*(?:,|/)\\s*[\\d.]+%?)?\\s*\\)`;
    return new RegExp(`(?:${hexPattern}|${rgbPattern})`, "i").test(value);
  }

  const escapedToken = escapeRegExp(normalizedToken);
  return new RegExp(`(?:^|[^a-z0-9_-])["']?${escapedToken}["']?(?![a-z0-9_-])`, "i").test(value);
}

function declarationFeedsRenderedStyle(
  declarations: CssDeclaration[],
  property: string,
  visited = new Set<string>(),
): boolean {
  if (visited.has(property)) return false;
  visited.add(property);

  return declarations.some((declaration) => {
    if (!cssUsesVariable(declaration.value, property)) return false;
    if (!declaration.property.startsWith("--")) return true;
    return declarationFeedsRenderedStyle(declarations, declaration.property, new Set(visited));
  });
}

function cssUsesEquivalentToken(css: string, token: string) {
  const declarations = getCssDeclarations(css).filter(
    (declaration) => !declaration.property.startsWith("--presentation-style-"),
  );

  return declarations.some((declaration) => {
    if (!cssValueContainsToken(declaration.value, token)) return false;
    if (!declaration.property.startsWith("--")) return true;
    return declarationFeedsRenderedStyle(declarations, declaration.property);
  });
}

export function countGeneratedSlides(html: string) {
  const sectionCount = html.match(/<section(?:\s|>)/gi)?.length ?? 0;
  const slideClassCount = countExactClassToken(html, "slide");

  return slideClassCount || sectionCount;
}

export function assertFrontendSlidesComplete(html: string, expectedSlideCount: number) {
  const slideCount = countGeneratedSlides(html);

  if (slideCount !== expectedSlideCount) {
    throw new Error(`frontend-slides output contains ${slideCount} slide(s), expected exactly ${expectedSlideCount}`);
  }
}

export function assertFrontendSlidesDocument(
  html: string,
  expectedSlideCount: number,
  styleSpec?: FrontendSlidesStyleSpec,
) {
  assertFrontendSlidesComplete(html, expectedSlideCount);

  const checks = [
    {
      passed: /(?:<!doctype html>|<html[\s>])[\s\S]*<\/html>\s*$/i.test(html.trim()),
      message: "document is truncated or missing a closing html tag",
    },
    {
      passed: /class=["'][^"']*\bdeck-viewport\b[^"']*["']/i.test(html)
        && /class=["'][^"']*\bdeck-stage\b[^"']*["']/i.test(html),
      message: "missing frontend-slides viewport or stage elements",
    },
    {
      passed: countExactClassToken(html, "slide") > 0,
      message: "missing frontend-slides .slide elements",
    },
    {
      passed: /visibility\s*:\s*hidden/i.test(html)
        && /visibility\s*:\s*visible/i.test(html)
        && /pointer-events\s*:\s*none/i.test(html)
        && /pointer-events\s*:\s*auto/i.test(html),
      message: "missing viewport-base visibility and pointer-events rules",
    },
    {
      passed: !/\.slide\s*\{[^}]*display\s*:\s*none/gi.test(html)
        && !/\.slide\.active\s*\{[^}]*display\s*:\s*block/gi.test(html),
      message: "uses display none/block for slide switching instead of viewport-base visibility rules",
    },
    {
      passed: /prefers-reduced-motion\s*:\s*reduce/i.test(html),
      message: "missing prefers-reduced-motion support",
    },
    {
      passed: /addEventListener\s*\(\s*["']keydown["']/i.test(html),
      message: "missing keyboard navigation",
    },
    {
      passed: !/<script\b[^>]*\bsrc\s*=/i.test(html),
      message: "uses an external script instead of a zero-dependency inline controller",
    },
  ];

  const failed = checks.find((check) => !check.passed);
  if (failed) {
    throw new Error(`frontend-slides output failed validation: ${failed.message}`);
  }

  if (styleSpec) {
    const css = getStyleSheets(html);
    const requiredProperties = [
      ["--presentation-style-background", styleSpec.palette.background],
      ["--presentation-style-accent", styleSpec.palette.accent],
      ["--presentation-style-display-font", styleSpec.typography.display],
      ["--presentation-style-body-font", styleSpec.typography.body],
    ] as const;
    const missingProperties = requiredProperties
      .filter(([property, value]) => {
        if (!cssDeclaresToken(css, property, value)) return true;
        return !cssUsesVariable(css, property) && !cssUsesEquivalentToken(css, value);
      })
      .map(([property]) => property);
    const hasStyleIdentity = deckStageHasStyleIdentity(html, styleSpec.id);

    if (!hasStyleIdentity || missingProperties.length > 0) {
      throw new Error(
        `frontend-slides output failed selected style contract: ${[
          !hasStyleIdentity ? `missing deck style identity ${styleSpec.id}` : "",
          missingProperties.length > 0 ? `missing or unused ${missingProperties.join(", ")}` : "",
        ].filter(Boolean).join("; ")}`,
      );
    }
  }
}
