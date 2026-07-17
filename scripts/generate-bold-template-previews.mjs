import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packRoot = path.join(projectRoot, ".claude", "skills", "frontend-slides", "bold-template-pack");
const previewRoot = path.join(projectRoot, "public", "style-previews");
const generatedContractPath = path.join(projectRoot, "src", "services", "frontend-slides", "bold-template-contracts.generated.json");

const palettes = {
  "8-bit-orbit": ["#0A0E27", "#0F1B3D", "#FFFFFF", "#5EDCF4", "#F0A6CA"],
  "biennale-yellow": ["#E9E5DB", "#F8F39B", "#1B2566", "#F1EE2E", "#E26B4A"],
  "block-frame": ["#FFFDF5", "#FFFFFF", "#000000", "#FE90E8", "#99E885"],
  "blue-professional": ["#FDFAE7", "#FDFAE7", "#111111", "#1E2BFA", "#6B6B6B"],
  "bold-poster": ["#FFFFFF", "#1C1410", "#1C1410", "#D8000F", "#F5F2EF"],
  broadside: ["#111111", "#E85D26", "#F0ECE5", "#E85D26", "#888880"],
  capsule: ["#F5F5F0", "#FFFFFF", "#1A1A1A", "#E85D4E", "#C5B5E0"],
  cartesian: ["#EDE8E0", "#E2DBD1", "#1A1A1A", "#8A8178", "#5A5A5A"],
  "cobalt-grid": ["#F0EBDE", "#E6E0CE", "#1F2BE0", "#1F2BE0", "#5560E5"],
  coral: ["#F5F0E8", "#E85D5D", "#1A1A1A", "#D44A4A", "#FFFFFF"],
  "creative-mode": ["#EFE9D9", "#E4DCC4", "#0F0F0F", "#1F8A4C", "#F06CA8"],
  "daisy-days": ["#F5F0E6", "#FDE68A", "#2D2D2D", "#7ECDC0", "#F7C8D4"],
  "editorial-forest": ["#EFE7D4", "#2E4A2A", "#1A1A17", "#E89CB1", "#D27E96"],
  "editorial-tri-tone": ["#F2B6C6", "#F2D86A", "#7A1F35", "#7A1F35", "#F2D86A"],
  "emerald-editorial": ["#3CD896", "#F1E9D6", "#0F1A5C", "#0F1A5C", "#F1E9D6"],
  grove: ["#192B1B", "#E8E4D6", "#D4CFBF", "#C8524A", "#DEDAD0"],
  "long-table": ["#FAF1E2", "#F2E5CF", "#8E2D1F", "#B53D2A", "#E8D7B6"],
  mat: ["#232E26", "#EDE6D0", "#F0E8D2", "#C07030", "#7A4E24"],
  monochrome: ["#FAFADF", "#F5F0E4", "#1A1A16", "#1A1A16", "#8A8A80"],
  "neo-grid-bold": ["#ECECE8", "#F5F4EF", "#0A0A0A", "#E6FF3D", "#8A8A85"],
  "peoples-platform": ["#F5F2EA", "#2C2CDC", "#0E0E14", "#F2A03A", "#E83A2A"],
  "pin-and-paper": ["#EFE56A", "#F8F1D6", "#1F3A8A", "#2D4FB8", "#C9A66B"],
  "pink-script": ["#0F0D11", "#060507", "#F5EDF1", "#ED3D8C", "#FF66A8"],
  playful: ["#F0C8A0", "#F7DEC6", "#1A1A1A", "#1A1A1A", "#F7DEC6"],
  "raw-grid": ["#FFFFFF", "#F5F5F5", "#0A0A0A", "#F2D4CF", "#E5EDD6"],
  "retro-windows": ["#C0C0C0", "#FFFFFF", "#000000", "#000080", "#808080"],
  "retro-zine": ["#C8B99A", "#F4EFE6", "#1A1A1A", "#008F4D", "#00A85D"],
  "sakura-chroma": ["#F1E6CB", "#E5D6B0", "#3A2516", "#E5392A", "#E54489"],
  scatterbrain: ["#FAF8F3", "#FFE066", "#2D2A26", "#FF9F9F", "#74C0FC"],
  signal: ["#1C2644", "#F0ECE3", "#E2DCD0", "#C8A870", "#8A96A8"],
  "soft-editorial": ["#F2EEDF", "#ECE6D2", "#2A241B", "#E1A4C2", "#D6DD63"],
  "stencil-tablet": ["#E2DCC9", "#F4EFE0", "#000000", "#C73B7A", "#2D7E73"],
  studio: ["#1C1C1C", "#242422", "#F5D200", "#F5D200", "#2E2E2C"],
  vellum: ["#2A3870", "#343F80", "#E8D85C", "#F5E168", "#3A7878"],
};

const fonts = {
  "8-bit-orbit": ["Tektur", "Chakra Petch", "Space Mono"],
  "biennale-yellow": ["Instrument Serif", "Archivo", "JetBrains Mono"],
  "block-frame": ["Inter", "Inter", "Space Grotesk"],
  "blue-professional": ["Space Grotesk", "Inter", "Space Grotesk"],
  "bold-poster": ["Shrikhand", "Libre Baskerville", "Space Grotesk"],
  broadside: ["Barlow", "Barlow", "IBM Plex Mono"],
  capsule: ["Bodoni Moda", "Space Grotesk", "Space Grotesk"],
  cartesian: ["Playfair Display", "Inter", "Inter"],
  "cobalt-grid": ["Newsreader", "Hanken Grotesk", "DM Mono"],
  coral: ["Bebas Neue", "Inter", "Inter"],
  "creative-mode": ["Archivo Black", "Space Grotesk", "JetBrains Mono"],
  "daisy-days": ["Fredoka One", "Quicksand", "Quicksand"],
  "editorial-forest": ["Source Serif 4", "Source Serif 4", "JetBrains Mono"],
  "editorial-tri-tone": ["Bricolage Grotesque", "Bricolage Grotesque", "JetBrains Mono"],
  "emerald-editorial": ["Bodoni Moda", "Manrope", "Manrope"],
  grove: ["Playfair Display", "Jost", "JetBrains Mono"],
  "long-table": ["Bricolage Grotesque", "Fraunces", "Fraunces"],
  mat: ["Bricolage Grotesque", "DM Sans", "DM Mono"],
  monochrome: ["Jost", "Jost", "JetBrains Mono"],
  "neo-grid-bold": ["Space Grotesk", "Space Grotesk", "JetBrains Mono"],
  "peoples-platform": ["Alfa Slab One", "Archivo Narrow", "DM Mono"],
  "pin-and-paper": ["Space Grotesk", "Caveat", "DM Mono"],
  "pink-script": ["DM Serif Display", "Inter", "JetBrains Mono"],
  playful: ["Syne", "Space Grotesk", "Space Grotesk"],
  "raw-grid": ["Segoe UI", "Segoe UI", "Segoe UI"],
  "retro-windows": ["MS Sans Serif", "MS Sans Serif", "MS Sans Serif"],
  "retro-zine": ["Bebas Neue", "Space Grotesk", "Caveat"],
  "sakura-chroma": ["Big Shoulders Display", "Albert Sans", "JetBrains Mono"],
  scatterbrain: ["Shrikhand", "Zilla Slab", "Caveat"],
  signal: ["Source Serif 4", "DM Sans", "IBM Plex Mono"],
  "soft-editorial": ["Cormorant Garamond", "Work Sans", "Work Sans"],
  "stencil-tablet": ["Stardos Stencil", "Inter", "Barlow Condensed"],
  studio: ["Barlow", "Barlow", "IBM Plex Mono"],
  vellum: ["Cormorant Garamond", "DM Sans", "Courier Prime"],
};

const families = {
  "8-bit-orbit": "pixel", "biennale-yellow": "solar", "block-frame": "block", "blue-professional": "corporate",
  "bold-poster": "poster", broadside: "broadside", capsule: "capsule", cartesian: "cartesian", "cobalt-grid": "blueprint",
  coral: "split", "creative-mode": "creative", "daisy-days": "playful", "editorial-forest": "editorial", "editorial-tri-tone": "tritone",
  "emerald-editorial": "emerald", grove: "grove", "long-table": "table", mat: "mat", monochrome: "monochrome",
  "neo-grid-bold": "neo-grid", "peoples-platform": "platform", "pin-and-paper": "pin", "pink-script": "script",
  playful: "blob", "raw-grid": "raw-grid", "retro-windows": "window", "retro-zine": "zine", "sakura-chroma": "sakura",
  scatterbrain: "sticky", signal: "signal", "soft-editorial": "soft", "stencil-tablet": "stencil", studio: "studio", vellum: "vellum",
};

const esc = (value) => String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" })[char]);
const clean = (value) => value.replace(/\{[^}]+\}/g, "the canonical token").replace(/\s+/g, " ").trim();
const hash = (value) => createHash("sha256").update(value).digest("hex");

function parsePreview(preview) {
  const snapshotBlock = preview.match(/## Visual Snapshot\s*\n([\s\S]*?)(?=\n## )/)?.[1] ?? "";
  const layout = clean(snapshotBlock.split(/\n\s*\n/).find((paragraph) => paragraph.trim()) ?? "Template-specific title composition.");
  const signatureElements = [...preview.matchAll(/^- Signature move:\s*(.+)$/gm)].map((match) => clean(match[1])).slice(0, 5);
  return { layout, signatureElements };
}

function title(x, y, size, color, font, lines = ["AGENT", "SKILLS"], extra = "") {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="${esc(font)},Noto Sans SC,sans-serif" font-size="${size}" font-weight="800" letter-spacing="-2" ${extra}>${lines.map((line, index) => `<tspan x="${x}" dy="${index ? size * .9 : 0}">${esc(line)}</tspan>`).join("")}</text>`;
}

function label(x, y, color, font, value = "AGENT SKILLS / 创作教程", extra = "") {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="${esc(font)},Noto Sans SC,monospace" font-size="15" letter-spacing="2" ${extra}>${esc(value)}</text>`;
}

function composition(slug, contract) {
  const { background: bg, surface, text, accent, secondary } = contract.palette;
  const { display, body, label: mono } = contract.fonts;
  switch (slug) {
    case "8-bit-orbit": return `<defs><pattern id="g" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="${accent}" stroke-opacity=".16"/></pattern></defs><rect width="960" height="540" fill="${bg}"/><rect x="38" y="38" width="884" height="464" fill="url(#g)" stroke="${accent}" stroke-width="4"/><rect x="630" y="80" width="246" height="150" fill="${secondary}"/><path d="M655 108h32v32h-32zm64 32h32v32h-32zm64-32h32v32h-32z" fill="${bg}"/>${label(72,92,accent,mono,"SYSTEM / MODULE 01")}${title(72,226,82,text,display)}<text x="72" y="430" fill="${secondary}" font-family="${body}" font-size="24">BUILD · CONNECT · REUSE</text>`;
    case "biennale-yellow": return `<defs><radialGradient id="sun"><stop stop-color="${accent}"/><stop offset="1" stop-color="${surface}"/></radialGradient></defs><rect width="960" height="540" fill="${bg}"/><circle cx="780" cy="120" r="210" fill="url(#sun)"/><path d="M54 82H520M54 448H906" stroke="${text}" stroke-width="2"/>${label(56,68,text,mono,"BIENNALE / SESSION 01")}${title(58,246,90,text,display,["AGENT", "SKILLS"],"font-weight=\"400\"")}<text x="590" y="432" fill="${text}" font-family="${body}" font-size="22">Ideas in a solar field</text>`;
    case "block-frame": return `<rect width="960" height="540" fill="${bg}"/><rect x="52" y="46" width="568" height="390" fill="${surface}" stroke="${text}" stroke-width="4"/><rect x="64" y="58" width="568" height="390" fill="none" stroke="${text}" stroke-width="4"/><rect x="660" y="46" width="246" height="180" fill="${accent}" stroke="${text}" stroke-width="4"/><rect x="660" y="246" width="246" height="202" fill="${secondary}" stroke="${text}" stroke-width="4"/>${label(94,104,text,mono,"FRAME / 01")}${title(92,230,76,text,display)}<rect x="92" y="376" width="250" height="44" fill="${text}"/><text x="112" y="405" fill="${bg}" font-family="${body}" font-size="18" font-weight="800">BUILD THE SYSTEM</text>`;
    case "blue-professional": return `<rect width="960" height="540" fill="${bg}"/><rect x="54" y="48" width="852" height="444" rx="14" fill="${surface}" stroke="${accent}" stroke-opacity=".22" stroke-width="2"/><rect x="54" y="48" width="18" height="444" rx="9" fill="${accent}"/>${label(104,96,accent,mono,"FIELD GUIDE / DEVELOPERS")}${title(104,238,78,text,display)}<rect x="650" y="112" width="188" height="188" rx="94" fill="${accent}" fill-opacity=".08"/><path d="M690 246l52-94 56 94z" fill="none" stroke="${accent}" stroke-width="6"/><text x="104" y="430" fill="${secondary}" font-family="${body}" font-size="22">A practical, trusted framework</text>`;
    case "bold-poster": return `<rect width="960" height="540" fill="${bg}"/><rect x="608" width="352" height="540" fill="${accent}"/><rect x="646" y="52" width="256" height="436" fill="${surface}"/>${label(52,68,accent,mono,"LIVE / POSTER 01")}${title(52,228,88,text,display,["MAKE", "AGENTS"],"transform=\"rotate(-2 52 228)\"")}<text x="52" y="444" fill="${text}" font-family="${body}" font-size="23">Bold ideas. Clear outcomes.</text>`;
    case "broadside": return `<rect width="960" height="540" fill="${bg}"/><rect y="402" width="960" height="138" fill="${surface}"/>${label(54,68,accent,mono,"BROADSIDE / 01")}${title(50,238,112,text,display,["agent", "skills"],"font-weight=\"900\" letter-spacing=\"-5\"")}<path d="M650 54V360M682 54V360" stroke="${accent}" stroke-width="8"/><text x="54" y="476" fill="${bg}" font-family="${body}" font-size="26" font-weight="700">FROM IDEA TO IMPACT</text>`;
    case "capsule": return `<rect width="960" height="540" fill="${bg}"/><rect x="50" y="48" width="860" height="444" rx="58" fill="${surface}" stroke="${text}" stroke-width="3"/><rect x="88" y="82" width="254" height="54" rx="27" fill="${accent}"/><ellipse cx="772" cy="350" rx="110" ry="76" fill="${secondary}" stroke="${text}" stroke-width="3"/>${label(110,116,text,mono,"CREATION CAPSULE")}${title(102,260,78,text,display)}<rect x="102" y="390" width="318" height="54" rx="27" fill="none" stroke="${text}" stroke-width="3"/><text x="132" y="424" fill="${text}" font-family="${body}" font-size="18">IDEAS IN MOTION · 01</text>`;
    case "cartesian": return `<rect width="960" height="540" fill="${bg}"/><path d="M70 448H900M116 486V54" stroke="${secondary}"/><circle cx="756" cy="164" r="104" fill="none" stroke="${accent}" stroke-width="2"/><circle cx="756" cy="164" r="72" fill="none" stroke="${accent}" stroke-dasharray="8 8"/>${label(150,90,secondary,mono,"X: IDEA / Y: IMPACT")}${title(150,252,76,text,display,["Agent", "Skills"],"font-weight=\"400\" letter-spacing=\"-1\"")}<text x="150" y="412" fill="${secondary}" font-family="${body}" font-size="22">A measured point of view</text>`;
    case "cobalt-grid": return `<defs><pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="${accent}" stroke-opacity=".12"/></pattern></defs><rect width="960" height="540" fill="${bg}"/><rect width="960" height="540" fill="url(#grid)"/><path d="M0 46H960M0 494H960" stroke="${accent}" stroke-width="3"/>${label(54,86,accent,mono,"X.024 / Y.108")}${title(54,246,78,text,display)}<path d="M674 112h174v108H674zm-56 232h142v90H618zM760 344h112v90H760z" fill="none" stroke="${accent}" stroke-width="3"/><text x="54" y="430" fill="${secondary}" font-family="${body}" font-size="22">GRID / SIGNAL / SYSTEM</text>`;
    case "coral": return `<rect width="960" height="540" fill="${bg}"/><path d="M0 0H620V540H0z" fill="${surface}"/><path d="M620 0H960V318H620z" fill="${text}"/><path d="M620 318H960V540H620z" fill="${bg}"/><defs><pattern id="h" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V16" stroke="${text}" stroke-opacity=".12" stroke-width="5"/></pattern></defs><rect width="620" height="540" fill="url(#h)"/>${label(48,72,text,mono,"CREATIVE SYSTEM / 01")}${title(48,230,88,text,display)}<text x="650" y="92" fill="${secondary}" font-family="${body}" font-size="23">HARD EDGES</text><text x="650" y="374" fill="${text}" font-family="${body}" font-size="22">FROM ZERO TO ONE</text>`;
    case "creative-mode": return `<rect width="960" height="540" fill="${bg}"/><rect x="58" y="54" width="548" height="330" fill="${surface}" stroke="${text}" stroke-width="4"/><rect x="76" y="72" width="548" height="330" fill="${accent}" stroke="${text}" stroke-width="4"/><rect x="654" y="54" width="250" height="180" fill="${secondary}" stroke="${text}" stroke-width="4"/><rect x="654" y="254" width="250" height="194" fill="${bg}" stroke="${text}" stroke-width="4"/>${label(106,116,text,mono,"CREATIVE MODE / ON")}${title(106,232,70,text,display)}<text x="106" y="350" fill="${text}" font-family="${body}" font-size="20">MAKE · TEST · REFINE</text>`;
    case "daisy-days": return `<rect width="960" height="540" fill="${bg}"/><rect x="54" y="48" width="852" height="444" rx="30" fill="${surface}" stroke="${text}" stroke-width="3"/><circle cx="788" cy="154" r="72" fill="${secondary}" stroke="${text}" stroke-width="3"/><g fill="${bg}" stroke="${text}" stroke-width="2"><circle cx="788" cy="104" r="24"/><circle cx="838" cy="154" r="24"/><circle cx="788" cy="204" r="24"/><circle cx="738" cy="154" r="24"/></g>${label(92,96,text,mono,"DAISY SESSION / 01")}${title(92,246,78,text,display)}<text x="92" y="420" fill="${text}" font-family="${body}" font-size="22" font-weight="600">GROW IDEAS TOGETHER</text>`;
    case "editorial-forest": return `<rect width="960" height="540" fill="${bg}"/><rect width="376" height="540" fill="${surface}"/><rect x="388" y="42" width="520" height="170" fill="${accent}"/><rect x="388" y="224" width="520" height="274" fill="${bg}" stroke="${surface}" stroke-width="2"/>${label(36,68,bg,mono,"FIELD NOTES / 01")}${title(36,210,68,bg,display,["AGENT", "SKILLS"],"font-weight=\"500\"")}<text x="424" y="118" fill="${text}" font-family="${display}" font-size="32">A considered framework</text><text x="424" y="284" fill="${text}" font-family="${body}" font-size="22">From concept to reusable capability</text>`;
    case "editorial-tri-tone": return `<rect width="960" height="540" fill="${bg}"/><rect x="46" y="44" width="868" height="452" rx="28" fill="${surface}"/><rect x="72" y="70" width="816" height="74" rx="37" fill="${accent}"/>${label(104,116,bg,mono,"EDITORIAL / SESSION 01")}${title(92,272,76,text,display)}<text x="92" y="416" fill="${text}" font-family="Instrument Serif,serif" font-size="38" font-style="italic">ideas, systems, impact</text>`;
    case "emerald-editorial": return `<rect width="960" height="540" fill="${bg}"/><path d="M54 72H906M54 88H906M54 448H906" stroke="${text}" stroke-width="4"/>${label(58,58,text,mono,"EMERALD EDITION / 01")}${title(58,250,92,text,display)}<rect x="666" y="126" width="190" height="190" fill="${text}"/><text x="761" y="242" text-anchor="middle" fill="${surface}" font-family="${display}" font-size="92" font-weight="900">01</text><text x="58" y="414" fill="${text}" font-family="${body}" font-size="22" font-weight="700">DESIGN-LED INTELLIGENCE</text>`;
    case "grove": return `<defs><radialGradient id="glow" cx="80%" cy="80%"><stop stop-color="${accent}" stop-opacity=".18"/><stop offset="1" stop-color="${bg}" stop-opacity="0"/></radialGradient></defs><rect width="960" height="540" fill="${bg}"/><rect width="960" height="540" fill="url(#glow)"/>${label(62,72,secondary,mono,"GROVE / CHAPTER 01")}${title(60,252,88,text,display,["Agent", "Skills"],"font-weight=\"400\" letter-spacing=\"-1\"")}<text x="60" y="410" fill="${accent}" font-family="${display}" font-size="30" font-style="italic">cultivating capability</text><path d="M754 106c-54 70-78 146-64 232m16-112c46-10 82-36 112-80m-116 140c-38-4-70-20-98-52" fill="none" stroke="${secondary}" stroke-width="3"/>`;
    case "long-table": return `<defs><pattern id="dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${accent}" fill-opacity=".12"/></pattern></defs><rect width="960" height="540" fill="${bg}"/><rect width="960" height="540" fill="url(#dots)"/><path d="M48 92H912M48 448H912M640 92V448" stroke="${accent}" stroke-width="2"/>${label(54,72,accent,mono,"LONG TABLE / EDITION 01")}${title(54,246,72,text,display)}<text x="674" y="156" fill="${text}" font-family="${body}" font-size="26" font-style="italic">A shared framework</text><text x="674" y="204" fill="${text}" font-family="${body}" font-size="20">for reusable skills</text>`;
    case "mat": return `<defs><radialGradient id="wood" cx="88%" cy="92%"><stop stop-color="${secondary}" stop-opacity=".45"/><stop offset="1" stop-color="${bg}" stop-opacity="0"/></radialGradient></defs><rect width="960" height="540" fill="${bg}"/><rect width="960" height="540" fill="url(#wood)"/>${label(58,72,accent,mono,"MAT / SESSION 01")}${title(56,250,82,text,display,["Agent", "Skills"],"letter-spacing=\"-1\"")}<rect x="646" y="92" width="246" height="330" fill="${surface}"/><text x="676" y="148" fill="${bg}" font-family="${mono}" font-size="15" letter-spacing="2">PRACTICE</text><text x="676" y="206" fill="${bg}" font-family="${body}" font-size="26">Build on a</text><text x="676" y="240" fill="${bg}" font-family="${body}" font-size="26">steady surface.</text>`;
    case "monochrome": return `<rect width="960" height="540" fill="${bg}"/><path d="M70 94H890M70 446H890M676 94V446" stroke="${secondary}" stroke-width="1"/>${label(74,76,text,mono,"MONO / FIELD GUIDE 01")}${title(72,248,82,text,display,["Agent", "Skills"],"font-weight=\"200\" letter-spacing=\"2\"")}<text x="710" y="164" fill="${text}" font-family="Lora,serif" font-size="34" font-style="italic">Less, clearly.</text><text x="72" y="412" fill="${secondary}" font-family="${body}" font-size="21" font-weight="300">STRUCTURE WITHOUT NOISE</text>`;
    case "neo-grid-bold": return `<rect width="960" height="540" fill="${bg}"/><g transform="translate(20 20)"><rect width="614" height="336" fill="${accent}"/><rect x="626" width="294" height="336" fill="${text}"/><rect y="348" width="920" height="172" fill="${surface}"/>${label(20,34,text,mono)}${title(20,132,82,text,display,["BUILD", "AGENT", "SKILLS"])}<text x="646" y="78" fill="${surface}" font-family="${body},Noto Sans SC,sans-serif" font-size="16" font-weight="700">从零构建可复用的智能体能力模块</text><g transform="translate(870 22)" fill="${accent}"><rect width="14" height="14"/><rect x="18" width="14" height="14"/><rect y="18" width="14" height="14"/></g>${label(20,386,text,mono,"SESSION FRAME / DEVELOPERS")}<text x="20" y="432" fill="${text}" font-family="${body},Noto Sans SC,sans-serif" font-size="22" font-weight="700">设定基调，带开发者走完创作全流程</text></g>`;
    case "peoples-platform": return `<rect width="960" height="540" fill="${bg}"/><rect x="42" y="42" width="876" height="456" fill="${surface}" stroke="${text}" stroke-width="6"/><rect x="62" y="62" width="360" height="116" fill="${accent}" stroke="${text}" stroke-width="6"/>${label(86,112,text,mono,"PEOPLE / PLATFORM 01")}${title(86,286,80,bg,display,["BUILD", "TOGETHER"],"style=\"paint-order:stroke;stroke:${secondary};stroke-width:10px\"")}<rect x="646" y="220" width="220" height="220" fill="${accent}" stroke="${text}" stroke-width="6"/><text x="756" y="350" text-anchor="middle" fill="${text}" font-family="${display}" font-size="72">01</text>`;
    case "pin-and-paper": return `<defs><pattern id="paper" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="${text}" fill-opacity=".08"/></pattern></defs><rect width="960" height="540" fill="${bg}"/><rect width="960" height="540" fill="url(#paper)"/><rect x="70" y="62" width="620" height="386" rx="4" fill="${surface}" stroke="${text}" stroke-width="2"/><rect x="78" y="70" width="620" height="386" rx="4" fill="none" stroke="${accent}" stroke-width="5"/>${label(110,112,text,mono,"ARCHIVE / PIN 01")}${title(108,254,76,text,display)}<path d="M778 106c64 0 92 58 56 108l-96 134c-22 30-68 14-62-22 2-12 8-22 18-30l90-84c18-18 6-48-20-48-14 0-26 8-34 20" fill="none" stroke="${text}" stroke-width="9" stroke-linecap="round"/>`;
    case "pink-script": return `<defs><radialGradient id="halo" cx="28%" cy="22%"><stop stop-color="${accent}" stop-opacity=".22"/><stop offset="1" stop-color="${bg}" stop-opacity="0"/></radialGradient></defs><rect width="960" height="540" fill="${bg}"/><rect width="960" height="540" fill="url(#halo)"/><rect x="36" y="36" width="888" height="468" fill="none" stroke="${text}" stroke-opacity=".18"/>${label(62,74,accent,mono,"AFTER HOURS / 01")}${title(58,246,86,text,display,["Agent", "Skills"],"font-weight=\"400\" font-style=\"italic\"")}<path d="M60 354c210-42 410-42 612 0" fill="none" stroke="${accent}" stroke-width="5"/><text x="60" y="420" fill="${secondary}" font-family="${body}" font-size="21">Ideas illuminated after dark</text>`;
    case "playful": return `<rect width="960" height="540" fill="${bg}"/><path d="M590 52c150-28 300 64 292 186s-120 186-246 156-184-314-46-342z" fill="${surface}" stroke="${text}" stroke-width="3"/><rect x="64" y="72" width="510" height="344" rx="78 28 88 34" fill="none" stroke="${text}" stroke-width="3" transform="rotate(-2 320 244)"/><rect x="76" y="84" width="510" height="344" rx="78 28 88 34" fill="none" stroke="${text}" stroke-width="3" transform="rotate(-2 332 256)"/>${label(108,126,text,mono,"PLAY / BUILD / 01")}${title(106,252,76,text,display)}<text x="108" y="386" fill="${text}" font-family="${body}" font-size="22">SERIOUS IDEAS, LOOSE EDGES</text>`;
    case "raw-grid": return `<rect width="960" height="540" fill="${bg}"/><rect x="40" y="40" width="880" height="460" fill="none" stroke="${text}" stroke-width="3"/><path d="M40 142H920M650 40V500M40 392H920" stroke="${text}" stroke-width="3"/><rect x="650" y="142" width="270" height="250" fill="${accent}"/><rect x="40" y="392" width="610" height="108" fill="${secondary}"/>${label(62,104,bg,mono,"RAW GRID / 01","style=\"paint-order:stroke;stroke:${text};stroke-width:24px\"")} ${title(66,246,82,text,display)}<text x="680" y="210" fill="${text}" font-family="${body}" font-size="22" font-weight="900">NO GAPS.</text>`;
    case "retro-windows": return `<rect width="960" height="540" fill="${bg}"/><rect x="54" y="44" width="852" height="452" fill="${surface}" stroke="${text}" stroke-width="3"/><rect x="58" y="48" width="844" height="48" fill="${accent}"/><text x="76" y="79" fill="${surface}" font-family="${body}" font-size="18">AGENT_SKILLS.EXE</text><g fill="${bg}" stroke="${text}" stroke-width="2"><rect x="796" y="58" width="28" height="28"/><rect x="830" y="58" width="28" height="28"/><rect x="864" y="58" width="28" height="28"/></g>${title(92,252,76,text,display)}<rect x="92" y="374" width="420" height="54" fill="${bg}" stroke="${text}" stroke-width="3"/><text x="112" y="409" fill="${text}" font-family="${body}" font-size="20">Status: READY TO CREATE</text>`;
    case "retro-zine": return `<defs><pattern id="grain" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="2" cy="3" r="1" fill="${text}" fill-opacity=".11"/><circle cx="8" cy="7" r="1" fill="${accent}" fill-opacity=".13"/></pattern></defs><rect width="960" height="540" fill="${bg}"/><rect width="960" height="540" fill="url(#grain)"/><rect x="72" y="56" width="548" height="380" fill="${accent}" stroke="${text}" stroke-width="3"/><rect x="86" y="70" width="548" height="380" fill="${surface}" stroke="${text}" stroke-width="3" transform="rotate(-2 360 260)"/>${label(116,116,accent,mono,"ISSUE 01 / ZINE")}${title(112,250,80,text,display)}<text x="680" y="124" fill="${text}" font-family="${body}" font-size="24">CUT</text><text x="680" y="164" fill="${accent}" font-family="${body}" font-size="24">PASTE</text><text x="680" y="204" fill="${text}" font-family="${body}" font-size="24">SHIP</text>`;
    case "sakura-chroma": return `<rect width="960" height="540" fill="${bg}"/><g transform="rotate(-22 760 160)"><rect x="610" y="40" width="420" height="24" fill="${accent}"/><rect x="610" y="70" width="420" height="24" fill="${secondary}"/><rect x="610" y="100" width="420" height="24" fill="#F09131"/><rect x="610" y="130" width="420" height="24" fill="#3D9F47"/><rect x="610" y="160" width="420" height="24" fill="#3F8BC4"/></g>${label(58,78,text,mono,"SAKURA / CHROMA 01")}${title(56,252,78,text,display)}<g transform="translate(760 374)"><circle cx="0" cy="-34" r="30" fill="${accent}"/><circle cx="32" cy="-10" r="30" fill="${secondary}"/><circle cx="20" cy="28" r="30" fill="#F09131"/><circle cx="-20" cy="28" r="30" fill="#3D9F47"/><circle cx="-32" cy="-10" r="30" fill="#3F8BC4"/></g><text x="58" y="426" fill="${text}" font-family="${body}" font-size="22">MULTICOLOR CREATION SYSTEM</text>`;
    case "scatterbrain": return `<rect width="960" height="540" fill="${bg}"/><rect x="62" y="52" width="360" height="250" fill="${surface}" transform="rotate(-4 242 177)"/><rect x="390" y="86" width="300" height="210" fill="${secondary}" transform="rotate(3 540 191)"/><rect x="626" y="250" width="270" height="218" fill="${accent}" transform="rotate(-2 761 359)"/><rect x="108" y="314" width="394" height="160" fill="#B2F2BB" transform="rotate(2 305 394)"/><g fill="#C43B35"><circle cx="240" cy="72" r="10"/><circle cx="540" cy="104" r="10"/><circle cx="760" cy="270" r="10"/></g>${label(92,104,text,mono,"IDEA BOARD / 01")}${title(94,188,62,text,display,["AGENT", "SKILLS"],"transform=\"rotate(-4 94 188)\"")}<text x="430" y="178" fill="${text}" font-family="${body}" font-size="25">Connect the notes.</text>`;
    case "signal": return `<rect width="960" height="540" fill="${bg}"/><rect x="626" width="334" height="540" fill="${surface}"/><path d="M54 88H572M54 448H572" stroke="${accent}"/>${label(56,70,accent,mono,"SIGNAL / 01")}${title(54,246,78,text,display,["Agent", "Skills"],"font-weight=\"500\" letter-spacing=\"-1\"")}<text x="660" y="124" fill="#1A2030" font-family="${display}" font-size="34">A clear</text><text x="660" y="166" fill="${accent}" font-family="${display}" font-size="34" font-style="italic">signal</text><text x="660" y="208" fill="#1A2030" font-family="${display}" font-size="34">through noise.</text><text x="56" y="414" fill="${secondary}" font-family="${body}" font-size="22">STRUCTURED FOR DEVELOPERS</text>`;
    case "soft-editorial": return `<rect width="960" height="540" fill="${bg}"/><rect x="52" y="48" width="856" height="444" rx="34" fill="${surface}"/><rect x="590" y="86" width="266" height="170" rx="30" fill="${accent}"/><rect x="590" y="274" width="266" height="170" rx="30" fill="${secondary}"/>${label(92,96,text,mono,"SOFT EDITION / 01")}${title(90,252,76,text,display,["Agent", "Skills"],"font-weight=\"500\"")}<text x="92" y="408" fill="${text}" font-family="${display}" font-size="28" font-style="italic">thoughtfully composed</text>`;
    case "stencil-tablet": return `<rect width="960" height="540" fill="${bg}"/><rect x="42" y="42" width="876" height="456" fill="${surface}" stroke="${text}" stroke-width="4"/><rect x="616" y="42" width="302" height="456" fill="${text}"/><rect x="650" y="78" width="234" height="98" fill="${accent}"/><rect x="650" y="194" width="234" height="98" fill="${secondary}"/>${label(76,92,text,mono,"STENCIL / TABLET 01")}${title(72,246,78,text,display)}<text x="650" y="372" fill="${bg}" font-family="${mono}" font-size="22" letter-spacing="3">MAKE / MARK</text>`;
    case "studio": return `<rect width="960" height="540" fill="${bg}"/><rect x="618" width="342" height="540" fill="${accent}"/>${label(52,72,accent,mono,"STUDIO / SESSION 01")}${title(48,250,108,text,display,["AGENT", "SKILLS"],"font-weight=\"900\" letter-spacing=\"-4\"")}<text x="650" y="118" fill="${bg}" font-family="${body}" font-size="28" font-weight="900">BUILD</text><text x="650" y="154" fill="${bg}" font-family="${body}" font-size="28" font-weight="900">CONNECT</text><text x="650" y="190" fill="${bg}" font-family="${body}" font-size="28" font-weight="900">SHIP</text><path d="M650 430H886" stroke="${bg}" stroke-width="4"/>`;
    case "vellum": return `<rect width="960" height="540" fill="${bg}"/><rect x="56" y="52" width="848" height="436" fill="none" stroke="${text}" stroke-opacity=".22"/><text x="770" y="214" fill="${secondary}" font-family="${display}" font-size="210" font-style="italic" opacity=".72">“</text>${label(82,92,secondary,mono,"VELLUM / NOTE 01")}${title(78,250,82,text,display,["Agent", "Skills"],"font-weight=\"400\" font-style=\"italic\" letter-spacing=\"-1\"")}<path d="M80 344H410" stroke="${accent}" stroke-width="28"/><text x="80" y="424" fill="${text}" font-family="${body}" font-size="22">A reusable capability system</text>`;
    default: throw new Error(`Missing preview composition for ${slug}`);
  }
}

function renderSvg(contract) {
  const meta = `data-template-slug="${contract.slug}" data-preview-family="${contract.family}" data-contract-hash="${contract.sourceHash}" data-display-font="${esc(contract.fonts.display)}" data-body-font="${esc(contract.fonts.body)}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" role="img" aria-label="${esc(contract.name)} title slide preview" ${meta}>\n<title>${esc(contract.name)} title slide preview</title>\n${composition(contract.slug, contract)}\n</svg>\n`;
}

async function main() {
  const selectionIndex = JSON.parse(await readFile(path.join(packRoot, "selection-index.json"), "utf8"));
  await mkdir(previewRoot, { recursive: true });
  const contracts = [];

  for (const template of selectionIndex.templates) {
    const slug = template.slug;
    if (!palettes[slug] || !fonts[slug] || !families[slug]) throw new Error(`Missing generator contract for ${slug}`);
    const templateDir = path.join(packRoot, "templates", slug);
    const [preview, design] = await Promise.all([
      readFile(path.join(templateDir, "preview.md"), "utf8"),
      readFile(path.join(templateDir, "design.md"), "utf8"),
    ]);
    const [background, surface, text, accent, secondary] = palettes[slug];
    for (const color of new Set([background, surface, text, accent, secondary])) {
      if (!design.toLowerCase().includes(color.toLowerCase())) throw new Error(`${slug} uses ${color}, which is absent from design.md`);
    }
    for (const font of fonts[slug]) {
      if (!`${preview}\n${design}`.toLowerCase().includes(font.toLowerCase())) throw new Error(`${slug} uses ${font}, which is absent from its source contract`);
    }
    const parsed = parsePreview(preview);
    const contract = {
      slug,
      name: template.name,
      family: families[slug],
      palette: { background, surface, text, accent, secondary },
      typography: { display: fonts[slug][0], body: fonts[slug][1] },
      fonts: { display: fonts[slug][0], body: fonts[slug][1], label: fonts[slug][2] },
      layout: parsed.layout,
      signatureElements: parsed.signatureElements,
      sourceHash: hash(`${preview}\n---DESIGN---\n${design}`),
      previewMd: template.preview_md,
      designMd: template.design_md,
    };
    contracts.push(contract);
    await writeFile(path.join(previewRoot, `bold-template-${slug}.svg`), renderSvg(contract), "utf8");
  }

  await writeFile(generatedContractPath, `${JSON.stringify({ generatedFrom: "bold-template-pack/templates/*/{preview,design}.md", contracts }, null, 2)}\n`, "utf8");
  process.stdout.write(`Generated ${contracts.length} bold-template preview contracts and SVG covers.\n`);
}

await main();
