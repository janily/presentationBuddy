import type { FrontendSlidesDiscoveryInput, FrontendSlidesStyleSpec } from "./style-catalog";

export type BoldPreviewFamily =
  | "pixel"
  | "poster"
  | "brutalist"
  | "editorial"
  | "capsule"
  | "cartesian"
  | "blueprint"
  | "organic"
  | "collage"
  | "window"
  | "modular"
  | "paper";

const familyBySlug: Record<string, BoldPreviewFamily> = {
  "8-bit-orbit": "pixel",
  "biennale-yellow": "poster",
  "block-frame": "modular",
  "blue-professional": "blueprint",
  "bold-poster": "poster",
  broadside: "editorial",
  capsule: "capsule",
  cartesian: "cartesian",
  "cobalt-grid": "blueprint",
  coral: "organic",
  "creative-mode": "window",
  "daisy-days": "organic",
  "editorial-forest": "editorial",
  "editorial-tri-tone": "modular",
  "emerald-editorial": "poster",
  grove: "organic",
  "long-table": "cartesian",
  mat: "modular",
  monochrome: "paper",
  "neo-grid-bold": "modular",
  "peoples-platform": "brutalist",
  "pin-and-paper": "paper",
  "pink-script": "organic",
  playful: "capsule",
  "raw-grid": "brutalist",
  "retro-windows": "window",
  "retro-zine": "collage",
  "sakura-chroma": "collage",
  scatterbrain: "collage",
  signal: "blueprint",
  "soft-editorial": "paper",
  "stencil-tablet": "window",
  studio: "capsule",
  vellum: "paper",
};

const escapeXml = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&apos;",
  '"': "&quot;",
})[character]!);

function splitTitle(title: string) {
  const normalized = title.trim() || "Untitled Presentation";
  const hasCjk = /[\u3400-\u9fff]/.test(normalized);
  if (hasCjk || !normalized.includes(" ")) {
    const size = hasCjk ? 11 : 18;
    return [normalized.slice(0, size), normalized.slice(size, size * 2)].filter(Boolean);
  }

  const lines: string[] = [];
  for (const word of normalized.split(/\s+/)) {
    const current = lines.at(-1) ?? "";
    if (!current || current.length + word.length + 1 > 19) {
      if (lines.length === 2) break;
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }
  return lines;
}

function titleText(lines: string[], x: number, y: number, size: number, color: string, family: string, anchor = "start") {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-family="${family}" font-size="${size}" font-weight="800" letter-spacing="-1">${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : size * 1.02}">${escapeXml(line)}</tspan>`).join("")}</text>`;
}

function composition(family: BoldPreviewFamily, style: FrontendSlidesStyleSpec, lines: string[]) {
  const { background, surface, text, accent, secondary } = style.palette;
  const display = escapeXml(style.typography.display);

  switch (family) {
    case "pixel":
      return `<pattern id="pixel-grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="${accent}" stroke-opacity=".16"/></pattern><rect width="960" height="540" fill="${background}"/><rect width="960" height="540" fill="url(#pixel-grid)"/><rect x="54" y="52" width="852" height="436" fill="${surface}" stroke="${accent}" stroke-width="4"/><path d="M54 108H906M88 80h18m14 0h18m14 0h18" stroke="${secondary}" stroke-width="8"/>${titleText(lines, 92, 238, 72, text, display)}<text x="92" y="420" fill="${accent}" font-family="monospace" font-size="20">SYSTEM READY // 01</text><path d="M710 170h140v140H710zM730 190h20v20h-20zm80 80h20v20h-20z" fill="none" stroke="${secondary}" stroke-width="8"/>`;
    case "poster":
      return `<rect width="960" height="540" fill="${background}"/><circle cx="790" cy="116" r="172" fill="${accent}"/><rect x="0" y="444" width="960" height="96" fill="${surface}"/>${titleText(lines, 62, 230, 92, text, display)}<path d="M64 82H350M64 398H600" stroke="${secondary}" stroke-width="10"/><text x="888" y="485" text-anchor="end" fill="${background}" font-family="monospace" font-size="20">OPENING / 01</text>`;
    case "brutalist":
      return `<rect width="960" height="540" fill="${background}"/><rect x="62" y="58" width="590" height="366" fill="${surface}" stroke="${text}" stroke-width="5"/><rect x="76" y="72" width="590" height="366" fill="none" stroke="${text}" stroke-width="5"/><rect x="700" y="76" width="196" height="126" fill="${accent}" stroke="${text}" stroke-width="5"/><rect x="700" y="228" width="196" height="196" fill="${secondary}" stroke="${text}" stroke-width="5"/>${titleText(lines, 100, 232, 72, text, display)}<rect x="100" y="340" width="210" height="44" fill="${text}"/><text x="116" y="370" fill="${background}" font-family="monospace" font-size="18">PRESENTATION 01</text>`;
    case "editorial":
      return `<rect width="960" height="540" fill="${background}"/><rect x="54" y="42" width="852" height="456" fill="${surface}"/><path d="M86 106H874M86 430H874M650 106V430" stroke="${accent}" stroke-width="2"/>${titleText(lines, 88, 224, 76, text, display)}<text x="684" y="166" fill="${accent}" font-family="serif" font-size="84">01</text><text x="684" y="236" fill="${text}" font-family="monospace" font-size="18">A CONSIDERED</text><text x="684" y="264" fill="${text}" font-family="monospace" font-size="18">POINT OF VIEW</text><circle cx="782" cy="358" r="58" fill="${secondary}"/>`;
    case "capsule":
      return `<rect width="960" height="540" fill="${background}"/><rect x="54" y="54" width="852" height="432" rx="54" fill="${surface}" stroke="${text}" stroke-width="3"/><rect x="92" y="88" width="260" height="54" rx="27" fill="${accent}"/><rect x="678" y="82" width="176" height="64" rx="32" fill="${secondary}"/><ellipse cx="760" cy="356" rx="130" ry="74" fill="${accent}" opacity=".75"/>${titleText(lines, 96, 252, 76, text, display)}<rect x="96" y="390" width="310" height="54" rx="27" fill="none" stroke="${text}" stroke-width="3"/><text x="122" y="424" fill="${text}" font-family="sans-serif" font-size="18">IDEAS IN MOTION · 01</text>`;
    case "cartesian":
      return `<pattern id="axes-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="${accent}" stroke-opacity=".18"/></pattern><rect width="960" height="540" fill="${background}"/><rect width="960" height="540" fill="url(#axes-grid)"/><path d="M72 460H900M120 492V52" stroke="${text}" stroke-width="3"/><circle cx="744" cy="170" r="84" fill="${accent}"/><path d="M646 360l98-190 104 190z" fill="none" stroke="${secondary}" stroke-width="5"/>${titleText(lines, 154, 250, 72, text, display)}<text x="154" y="408" fill="${secondary}" font-family="monospace" font-size="20">X: IDEA  /  Y: IMPACT</text>`;
    case "blueprint":
      return `<rect width="960" height="540" fill="${background}"/><path d="M0 90H960M0 450H960M120 0V540M840 0V540" stroke="${accent}" stroke-opacity=".3"/><path d="M690 112h158v96H690zm-54 210h130v82H636zM790 326h92v78h-92zM766 208v118m-46-4-88-96" fill="none" stroke="${accent}" stroke-width="3"/><circle cx="720" cy="160" r="8" fill="${secondary}"/>${titleText(lines, 88, 252, 72, text, display)}<text x="88" y="378" fill="${accent}" font-family="monospace" font-size="20">FRAMEWORK / SIGNAL / SYSTEM</text><text x="850" y="66" text-anchor="end" fill="${secondary}" font-family="monospace" font-size="18">X.024 / Y.108</text>`;
    case "organic":
      return `<rect width="960" height="540" fill="${background}"/><path d="M690 34c150 10 244 112 210 224s-192 160-280 72-54-306 70-296z" fill="${accent}" opacity=".72"/><path d="M-30 396c120-98 262-68 326 28s-26 142-142 134S-112 462-30 396z" fill="${secondary}" opacity=".72"/><path d="M760 110c-76 82-88 170-38 260M730 188c60-12 104-42 136-88M722 258c-52-4-94-22-130-60" fill="none" stroke="${surface}" stroke-width="6" stroke-linecap="round"/>${titleText(lines, 76, 238, 78, text, display)}<text x="80" y="382" fill="${text}" font-family="serif" font-size="24">A living point of view</text>`;
    case "collage":
      return `<rect width="960" height="540" fill="${background}"/><g transform="rotate(-4 230 180)"><rect x="56" y="62" width="360" height="246" fill="${surface}" stroke="${text}" stroke-width="3"/></g><g transform="rotate(5 720 278)"><rect x="590" y="116" width="292" height="320" fill="${accent}"/></g><rect x="92" y="348" width="430" height="118" fill="${secondary}" transform="rotate(2 307 407)"/>${titleText(lines, 98, 170, 64, text, display)}<text x="622" y="188" fill="${background}" font-family="monospace" font-size="20">CUT / PASTE / 01</text><path d="M650 240h180M650 270h120M650 300h156" stroke="${background}" stroke-width="8"/>`;
    case "window":
      return `<rect width="960" height="540" fill="${background}"/><rect x="66" y="54" width="828" height="432" rx="18" fill="${surface}" stroke="${text}" stroke-width="3"/><path d="M66 112H894" stroke="${text}" stroke-width="3"/><circle cx="104" cy="83" r="10" fill="${accent}"/><circle cx="136" cy="83" r="10" fill="${secondary}"/><circle cx="168" cy="83" r="10" fill="${text}"/><rect x="632" y="148" width="214" height="286" fill="${accent}" opacity=".82"/>${titleText(lines, 108, 244, 70, text, display)}<rect x="108" y="378" width="340" height="34" fill="${background}"/><text x="124" y="401" fill="${text}" font-family="monospace" font-size="17">NEW_DECK.EXE / READY</text>`;
    case "modular":
      return `<rect width="960" height="540" fill="${background}"/><rect x="54" y="54" width="558" height="296" fill="${surface}"/><rect x="630" y="54" width="276" height="184" fill="${accent}"/><rect x="630" y="256" width="276" height="230" fill="${secondary}"/><rect x="54" y="368" width="558" height="118" fill="${text}"/>${titleText(lines, 88, 178, 70, text, display)}<text x="88" y="427" fill="${background}" font-family="monospace" font-size="20">STRUCTURE CREATES ENERGY</text><text x="864" y="206" text-anchor="end" fill="${background}" font-family="sans-serif" font-size="72" font-weight="800">01</text>`;
    case "paper":
      return `<rect width="960" height="540" fill="${background}"/><rect x="94" y="42" width="772" height="456" fill="${surface}"/><path d="M132 94H828M132 424H828" stroke="${accent}" stroke-width="2"/><text x="132" y="142" fill="${accent}" font-family="monospace" font-size="18" letter-spacing="4">FIELD NOTES · VOLUME 01</text>${titleText(lines, 132, 260, 74, text, display)}<text x="132" y="388" fill="${secondary}" font-family="serif" font-size="22">Prepared for thoughtful discussion</text><text x="808" y="392" text-anchor="end" fill="${accent}" font-family="serif" font-size="82">§</text>`;
  }
}

export function getBoldPreviewFamily(slug: string): BoldPreviewFamily {
  return familyBySlug[slug] ?? "modular";
}

export function createBoldTemplatePreviewDataUri(
  style: FrontendSlidesStyleSpec,
  input: FrontendSlidesDiscoveryInput,
) {
  const slug = style.boldTemplate?.slug ?? style.id;
  const family = getBoldPreviewFamily(slug);
  const lines = splitTitle(input.topic);
  const audience = escapeXml(input.audience || "General audience");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" role="img" aria-label="${escapeXml(input.topic)}" data-preview-family="${family}">${composition(family, style, lines)}<text x="900" y="510" text-anchor="end" fill="${style.palette.text}" fill-opacity=".55" font-family="sans-serif" font-size="15">${audience}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
