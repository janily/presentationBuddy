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

  return slideClassCount || sectionCount;
}

type ApprovedSlideContent = {
  title: string;
  content: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export function completeMissingFrontendSlides(html: string, approvedSlides: ApprovedSlideContent[]) {
  const generatedSlideCount = countGeneratedSlides(html);
  if (generatedSlideCount >= approvedSlides.length) return html;

  const isClosedDocument = /<\/html>\s*$/i.test(html.trim());
  if (!isClosedDocument && (!/<\/style>/i.test(html) || !/<body(?:\s|>)/i.test(html))) {
    return html;
  }

  const insertionMarker = /<\/main>/i.test(html) ? "</main>" : "</body>";
  const insertionIndex = isClosedDocument
    ? html.toLowerCase().lastIndexOf(insertionMarker)
    : html.length;
  if (insertionIndex < 0) return html;

  const missingMarkup = approvedSlides
    .slice(generatedSlideCount)
    .map((slide, index) => {
      const pageNumber = generatedSlideCount + index + 1;
      return `
<section class="slide auto-completed-slide" data-slide-number="${pageNumber}">
  <div style="padding:96px 120px;max-width:1680px;margin:auto">
    <div style="font-size:24px;letter-spacing:.12em;opacity:.65;margin-bottom:32px">${String(pageNumber).padStart(2, "0")}</div>
    <h2 style="font-size:72px;line-height:1.08;margin:0 0 40px">${escapeHtml(slide.title)}</h2>
    <div style="font-size:30px;line-height:1.55;white-space:pre-line">${escapeHtml(slide.content)}</div>
  </div>
</section>`;
    })
    .join("\n");

  if (isClosedDocument) {
    return `${html.slice(0, insertionIndex)}${missingMarkup}\n${html.slice(insertionIndex)}`;
  }

  const openSections = html.match(/<section(?:\s|>)/gi)?.length ?? 0;
  const closedSections = html.match(/<\/section>/gi)?.length ?? 0;
  const closeInterruptedSection = openSections > closedSections ? "\n</section>" : "";
  const closeInterruptedMain = /<main(?:\s|>)/i.test(html) && !/<\/main>/i.test(html)
    ? "\n</main>"
    : "";

  return `${html}${closeInterruptedSection}${missingMarkup}${closeInterruptedMain}\n</body>\n</html>`;
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
