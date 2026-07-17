const VIEWPORT_FILL_MARKER = 'data-presentation-buddy-viewport-fill="v1"';

const viewportFillStyle = `<style ${VIEWPORT_FILL_MARKER}>
@media screen {
  html,
  body,
  .deck-viewport,
  .deck-stage {
    width: 100% !important;
    height: 100% !important;
    margin: 0 !important;
    overflow: hidden !important;
  }

  .deck-viewport {
    position: fixed !important;
    inset: 0 !important;
  }

  .deck-stage {
    position: absolute !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    height: 100dvh !important;
    transform: none !important;
  }

  .deck-stage > .slide,
  .slide {
    width: 100% !important;
    height: 100% !important;
  }
}
</style>`;

export function ensureFrontendSlidesViewportFill(html: string) {
  if (html.includes(VIEWPORT_FILL_MARKER)) return html;

  const headClose = html.search(/<\/head\s*>/i);
  if (headClose >= 0) {
    return `${html.slice(0, headClose)}${viewportFillStyle}\n${html.slice(headClose)}`;
  }

  return `${viewportFillStyle}\n${html}`;
}
