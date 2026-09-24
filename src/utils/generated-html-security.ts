// Generated decks are executable documents, never trusted application code.
// Keep inline navigation and external fonts/images, but no network API calls,
// external scripts, forms, plugins, origin storage or parent-window access.
export const GENERATED_HTML_CONTENT_POLICY = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' https:",
  "img-src data: blob: https:",
  "font-src data: https:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

export const GENERATED_HTML_HEADERS = {
  "Content-Security-Policy": `sandbox allow-scripts; ${GENERATED_HTML_CONTENT_POLICY}`,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "private, no-store",
};

export function buildPreviewDocument(html: string) {
  // Put policy before ANY generated markup/scripts. An additional doctype/head
  // in the generated document is ignored by the HTML parser; the leading
  // doctype preserves standards mode. sandbox itself must be an iframe/header
  // policy because browsers do not enforce that directive from a meta tag.
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${GENERATED_HTML_CONTENT_POLICY}">${html}`;
}
