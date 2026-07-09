export function stripHtmlCodeFence(html: string) {
  return html
    .trim()
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

export function extractHtmlFromAgentResult(result: string) {
  const content = result.trim();
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

export function countGeneratedSlides(html: string) {
  const sectionCount = html.match(/<section(?:\s|>)/gi)?.length ?? 0;
  const slideClassCount = html.match(/class=["'][^"']*\bslide\b[^"']*["']/gi)?.length ?? 0;

  return Math.max(sectionCount, slideClassCount);
}

export function assertFrontendSlidesComplete(html: string, expectedSlideCount: number) {
  const slideCount = countGeneratedSlides(html);

  if (slideCount < expectedSlideCount) {
    throw new Error(`frontend-slides output only contains ${slideCount} slide(s), expected ${expectedSlideCount}`);
  }
}

export function assertFrontendSlidesDocument(html: string, expectedSlideCount: number) {
  assertFrontendSlidesComplete(html, expectedSlideCount);

  const checks = [
    {
      passed: /\bwidth\s*:\s*1920px\b/i.test(html) && /\bheight\s*:\s*1080px\b/i.test(html),
      message: "missing fixed 1920x1080 stage rules",
    },
    {
      passed: /class=["'][^"']*\bslide\b[^"']*["']/i.test(html),
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
  ];

  const failed = checks.find((check) => !check.passed);
  if (failed) {
    throw new Error(`frontend-slides output failed validation: ${failed.message}`);
  }
}
