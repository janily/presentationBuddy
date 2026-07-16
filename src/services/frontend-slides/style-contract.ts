import type { FrontendSlidesStyleSpec } from "./style-schema";

const STYLE_CONTRACT_MARKER = 'data-presentation-buddy-style-contract="v1"';

function escapeHtmlAttribute(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character]!);
}

function escapeCssString(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildStyleContractStyle(styleSpec: FrontendSlidesStyleSpec) {
  return `<style ${STYLE_CONTRACT_MARKER}>
:root {
  --presentation-style-background: ${styleSpec.palette.background};
  --presentation-style-accent: ${styleSpec.palette.accent};
  --presentation-style-display-font: "${escapeCssString(styleSpec.typography.display)}";
  --presentation-style-body-font: "${escapeCssString(styleSpec.typography.body)}";
}
</style>`;
}

function ensureDeckStageStyleIdentity(html: string, styleId: string) {
  let updated = false;
  const escapedStyleId = escapeHtmlAttribute(styleId);

  return html.replace(/<[^>]+>/g, (tag) => {
    if (updated) return tag;

    const classValue = tag.match(/\bclass\s*=\s*(["'])(.*?)\1/i)?.[2] ?? "";
    if (!classValue.split(/\s+/).includes("deck-stage")) return tag;

    updated = true;
    const styleIdentity = `data-presentation-style="${escapedStyleId}"`;
    const existingIdentity = /\sdata-presentation-style(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/i;
    if (existingIdentity.test(tag)) {
      return tag.replace(existingIdentity, ` ${styleIdentity}`);
    }

    return tag.replace(/\s*(\/?)>$/, ` ${styleIdentity}$1>`);
  });
}

export function ensureFrontendSlidesStyleContract(
  html: string,
  styleSpec?: FrontendSlidesStyleSpec,
) {
  if (!styleSpec) return html;

  const documentWithIdentity = ensureDeckStageStyleIdentity(html, styleSpec.id);
  const styleContract = buildStyleContractStyle(styleSpec);
  const existingContract = /<style\b[^>]*\bdata-presentation-buddy-style-contract\s*=\s*(["'])v1\1[^>]*>[\s\S]*?<\/style>/i;

  if (existingContract.test(documentWithIdentity)) {
    return documentWithIdentity.replace(existingContract, styleContract);
  }

  const headClose = documentWithIdentity.search(/<\/head\s*>/i);
  if (headClose >= 0) {
    return `${documentWithIdentity.slice(0, headClose)}${styleContract}\n${documentWithIdentity.slice(headClose)}`;
  }

  return `${styleContract}\n${documentWithIdentity}`;
}
