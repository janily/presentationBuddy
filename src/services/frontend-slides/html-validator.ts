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
  return [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1])
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
  return new RegExp(`${escapeRegExp(property)}\\s*:\\s*${quotedValue}(?:\\s*;|\\s*$)`, "im").test(css);
}

function cssUsesVariable(css: string, property: string) {
  return new RegExp(`var\\(\\s*${escapeRegExp(property)}\\s*\\)`, "i").test(css);
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
      passed: /\bwidth\s*:\s*1920px\b/i.test(html) && /\bheight\s*:\s*1080px\b/i.test(html),
      message: "missing fixed 1920x1080 stage rules",
    },
    {
      passed: /class=["'][^"']*\bdeck-viewport\b[^"']*["']/i.test(html)
        && /class=["'][^"']*\bdeck-stage\b[^"']*["']/i.test(html),
      message: "missing frontend-slides viewport or fixed stage elements",
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
      passed: /Math\.min\s*\(\s*window\.innerWidth\s*\/\s*1920\s*,\s*window\.innerHeight\s*\/\s*1080\s*\)/i.test(html)
        && /style\.transform\s*=/i.test(html),
      message: "missing uniform 1920x1080 stage scaling",
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
      .filter(([property, value]) => !cssDeclaresToken(css, property, value) || !cssUsesVariable(css, property))
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
