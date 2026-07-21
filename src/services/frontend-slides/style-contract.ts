import type { ExecutableStyleContract } from "./style-conformance";
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

function buildStyleContractStyle(styleSpec?: FrontendSlidesStyleSpec, contract?: ExecutableStyleContract) {
  const background = contract?.tokens.colors.required[0] ?? styleSpec!.palette.background;
  const accent = contract?.tokens.colors.required[1] ?? styleSpec!.palette.accent;
  const text = contract?.tokens.colors.required[2] ?? styleSpec?.palette.text;
  const displayFont = contract?.tokens.fonts.display ?? styleSpec!.typography.display;
  const bodyFont = contract?.tokens.fonts.body ?? styleSpec!.typography.body;
  return `<style ${STYLE_CONTRACT_MARKER}>
:root {
  --presentation-style-background: ${background};
  --presentation-style-accent: ${accent};
  ${text ? `--presentation-style-text: ${text};` : ""}
  --presentation-style-display-font: "${escapeCssString(displayFont)}";
  --presentation-style-body-font: "${escapeCssString(bodyFont)}";
}
</style>`;
}

function ensureDeckStageStyleIdentity(html: string, styleId: string, contractVersion?: string) {
  let updated = false;
  const escapedStyleId = escapeHtmlAttribute(styleId);

  return html.replace(/<[^>]+>/g, (tag) => {
    if (updated) return tag;

    const classValue = tag.match(/\bclass\s*=\s*(["'])(.*?)\1/i)?.[2] ?? "";
    if (!classValue.split(/\s+/).includes("deck-stage")) return tag;

    updated = true;
    const styleIdentity = `data-presentation-style="${escapedStyleId}"`;
    const contractIdentity = contractVersion ? ` data-presentation-style-contract="${escapeHtmlAttribute(contractVersion)}"` : "";
    const existingIdentity = /\sdata-presentation-style(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/i;
    if (existingIdentity.test(tag)) {
      const withStyle = tag.replace(existingIdentity, ` ${styleIdentity}`);
      if (!contractVersion) return withStyle;
      const existingContract = /\sdata-presentation-style-contract(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/i;
      if (existingContract.test(withStyle)) return withStyle.replace(existingContract, contractIdentity);
      return withStyle.replace(/\s*(\/?)>$/, `${contractIdentity}$1>`);
    }

    return tag.replace(/\s*(\/?)>$/, ` ${styleIdentity}${contractIdentity}$1>`);
  });
}

export function ensureFrontendSlidesStyleContract(
  html: string,
  styleSpec?: FrontendSlidesStyleSpec,
  contract?: ExecutableStyleContract,
) {
  if (!styleSpec && !contract) return html;

  const styleId = contract?.identity.id ?? styleSpec!.id;
  const documentWithIdentity = ensureDeckStageStyleIdentity(html, styleId, contract?.contractVersion);
  const styleContract = buildStyleContractStyle(styleSpec, contract);
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
