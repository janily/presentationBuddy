import type { FrontendSlidesDensity, FrontendSlidesPurpose, FrontendSlidesStylePreview, FrontendSlidesStyleSpec } from "./style-schema";
export type { FrontendSlidesDensity, FrontendSlidesPurpose, FrontendSlidesStylePreview, FrontendSlidesStyleSpec } from "./style-schema";
import boldTemplateSelectionIndex from "../../../.claude/skills/frontend-slides/bold-template-pack/selection-index.json";
import boldTemplateContracts from "./bold-template-contracts.generated.json";
import { getBoldPreviewFamily } from "./bold-template-preview";

export type FrontendSlidesDiscoveryInput = {
  topic: string;
  audience: string;
  purpose: FrontendSlidesPurpose;
  density: FrontendSlidesDensity;
};

export type FrontendSlidesDiscoveryOptions = {
  limit?: number;
  excludeIds?: string[];
};

type BoldTemplateIndexItem = {
  slug: string;
  name: string;
  tagline: string;
  mood: string[];
  tone: string[];
  formality: string;
  density: string;
  scheme: string;
  best_for: string;
  avoid_for: string;
  preview_md: string;
  design_md: string;
};

type BoldTemplateGeneratedContract = {
  slug: string;
  layout: string;
  typography: FrontendSlidesStyleSpec["typography"];
  palette: FrontendSlidesStyleSpec["palette"];
  signatureElements: string[];
};

const boldTemplateContractBySlug = new Map(
  (boldTemplateContracts.contracts as BoldTemplateGeneratedContract[]).map((contract) => [contract.slug, contract]),
);

const presetAndCustomStyles: FrontendSlidesStyleSpec[] = [
  { id: "bold-signal", name: "Bold Signal", source: "frontend-slides-preset", vibe: "自信、现代、高冲击力", layout: "深色渐变舞台上的高饱和焦点卡片", typography: { display: "Archivo Black", body: "Space Grotesk" }, palette: { background: "#1a1a1a", surface: "#2d2d2d", text: "#ffffff", accent: "#ff5722", secondary: "#ffd166" }, signatureElements: ["bold colored card", "large section numbers", "navigation breadcrumbs"] },
  { id: "electric-studio", name: "Electric Studio", source: "frontend-slides-preset", vibe: "大胆、干净、专业、高对比", layout: "白色与电光蓝上下分屏", typography: { display: "Manrope", body: "Manrope" }, palette: { background: "#ffffff", surface: "#4361ee", text: "#0a0a0a", accent: "#4361ee", secondary: "#ffffff" }, signatureElements: ["two-panel split", "accent edge bar", "hero quote typography"] },
  { id: "creative-voltage", name: "Creative Voltage", source: "frontend-slides-preset", vibe: "创意、活力、复古未来感", layout: "电光蓝与深靛双栏构图", typography: { display: "Syne", body: "Space Mono" }, palette: { background: "#0066ff", surface: "#1a1a2e", text: "#ffffff", accent: "#d4ff00", secondary: "#1a1a2e" }, signatureElements: ["halftone texture", "neon badges", "script accents"] },
  { id: "dark-botanical", name: "Dark Botanical", source: "frontend-slides-preset", vibe: "优雅、艺术、精致、高级", layout: "暗色居中构图与柔和抽象光晕", typography: { display: "Cormorant Garamond", body: "IBM Plex Sans" }, palette: { background: "#0f0f0f", surface: "#191919", text: "#e8e4df", accent: "#d4a574", secondary: "#e8b4b8" }, signatureElements: ["soft gradient circles", "warm accents", "thin vertical lines"] },
  { id: "notebook-tabs", name: "Notebook Tabs", source: "frontend-slides-preset", vibe: "编辑感、井然有序、优雅、触感", layout: "深色背景上的奶油纸张与彩色索引", typography: { display: "Bodoni Moda", body: "DM Sans" }, palette: { background: "#2d2d2d", surface: "#f8f6f1", text: "#1a1a1a", accent: "#98d4bb", secondary: "#c7b8ea" }, signatureElements: ["paper container", "colorful section tabs", "binder holes"] },
  { id: "pastel-geometry", name: "Pastel Geometry", source: "frontend-slides-preset", vibe: "友好、有序、现代、亲和", layout: "粉彩背景上的白色卡片与右缘竖向胶囊", typography: { display: "Plus Jakarta Sans", body: "Plus Jakarta Sans" }, palette: { background: "#c8d9e6", surface: "#faf9f7", text: "#1a1a1a", accent: "#f0b4d4", secondary: "#7c6aad" }, signatureElements: ["soft card", "vertical pills", "subtle shadow"] },
  { id: "split-pastel", name: "Split Pastel", source: "frontend-slides-preset", vibe: "轻松、现代、友好、富有创意", layout: "桃色与薰衣草双色分屏", typography: { display: "Outfit", body: "Outfit" }, palette: { background: "#f5e6dc", surface: "#e4dff0", text: "#1a1a1a", accent: "#c8f0d8", secondary: "#f0d4e0" }, signatureElements: ["split background", "playful badges", "grid overlay"] },
  { id: "vintage-editorial", name: "Vintage Editorial", source: "frontend-slides-preset", vibe: "机智、自信、编辑感、个性鲜明", layout: "暖白画布上的大标题与几何装饰", typography: { display: "Fraunces", body: "Work Sans" }, palette: { background: "#f5f3ee", surface: "#ffffff", text: "#1a1a1a", accent: "#c45b3c", secondary: "#e8d4c0" }, signatureElements: ["abstract geometry", "bordered callouts", "editorial rhythm"] },
  { id: "neon-cyber", name: "Neon Cyber", source: "frontend-slides-preset", vibe: "未来、科技、自信", layout: "深海军蓝空间中的霓虹网格", typography: { display: "Clash Display", body: "Satoshi" }, palette: { background: "#0a0f1c", surface: "#111a2d", text: "#f4ffff", accent: "#00ffcc", secondary: "#ff00aa" }, signatureElements: ["particle background", "neon glow", "grid patterns"] },
  { id: "terminal-green", name: "Terminal Green", source: "frontend-slides-preset", vibe: "开发者、黑客终端、硬核技术", layout: "GitHub 深色终端界面与代码层级", typography: { display: "JetBrains Mono", body: "JetBrains Mono" }, palette: { background: "#0d1117", surface: "#161b22", text: "#e6edf3", accent: "#39d353", secondary: "#58a6ff" }, signatureElements: ["scan lines", "blinking cursor", "code syntax styling"] },
  { id: "swiss-modern", name: "Swiss Modern", source: "frontend-slides-preset", vibe: "干净、精确、包豪斯理性", layout: "可见网格上的非对称黑白红构图", typography: { display: "Archivo", body: "Nunito" }, palette: { background: "#ffffff", surface: "#f2f2f2", text: "#000000", accent: "#ff3300", secondary: "#111111" }, signatureElements: ["visible grid", "asymmetric layouts", "geometric shapes"] },
  { id: "paper-ink", name: "Paper & Ink", source: "frontend-slides-preset", vibe: "文学、克制、深思熟虑", layout: "温暖纸张上的衬线排版与细线", typography: { display: "Cormorant Garamond", body: "Source Serif 4" }, palette: { background: "#faf9f7", surface: "#fffdf9", text: "#1a1a1a", accent: "#c41e3a", secondary: "#6b625b" }, signatureElements: ["drop caps", "pull quotes", "elegant rules"] },
  { id: "circuit-blueprint", name: "Circuit Blueprint", source: "frontend-slides-custom", vibe: "为当前技术主题定制的工程蓝图语言", layout: "非对称技术图纸、坐标标记与模块连线", typography: { display: "Chakra Petch", body: "IBM Plex Mono" }, palette: { background: "#071a2b", surface: "#0d2942", text: "#e8f5ff", accent: "#4de3ff", secondary: "#ffb84d" }, signatureElements: ["circuit traces", "coordinate labels", "blueprint annotations"] },
];

const boldTemplatePalettes: Record<string, FrontendSlidesStyleSpec["palette"]> = {
  dark: { background: "#0a0e27", surface: "#111827", text: "#ffffff", accent: "#5edcf4", secondary: "#f0a6ca" },
  light: { background: "#fdfae7", surface: "#ffffff", text: "#111111", accent: "#1e2bfa", secondary: "#6b6b6b" },
  mixed: { background: "#111111", surface: "#f7f1e1", text: "#fff8e8", accent: "#ff5b2e", secondary: "#99e885" },
};

const boldTemplatePaletteOverrides: Record<string, FrontendSlidesStyleSpec["palette"]> = {
  "8-bit-orbit": { background: "#0A0E27", surface: "#0F1B3D", text: "#FFFFFF", accent: "#5EDCF4", secondary: "#F0A6CA" },
  "biennale-yellow": { background: "#E9E5DB", surface: "#F8F39B", text: "#1B2566", accent: "#F1EE2E", secondary: "#E26B4A" },
  "block-frame": { background: "#FFFDF5", surface: "#FFFFFF", text: "#000000", accent: "#FE90E8", secondary: "#99E885" },
  "blue-professional": { background: "#FDFAE7", surface: "#FFFFFF", text: "#111111", accent: "#1E2BFA", secondary: "#6B6B6B" },
  "bold-poster": { background: "#FFFFFF", surface: "#1C1410", text: "#1C1410", accent: "#D8000F", secondary: "#F5F2EF" },
  broadside: { background: "#111111", surface: "#1A1A18", text: "#F0ECE5", accent: "#E85D26", secondary: "#888880" },
  capsule: { background: "#F5F5F0", surface: "#FFFFFF", text: "#1A1A1A", accent: "#E85D4E", secondary: "#C5B5E0" },
  cartesian: { background: "#EDE8E0", surface: "#E2DBD1", text: "#1A1A1A", accent: "#8A8178", secondary: "#5A5A5A" },
  "cobalt-grid": { background: "#F0EBDE", surface: "#E6E0CE", text: "#1F2BE0", accent: "#1F2BE0", secondary: "#5560E5" },
  coral: { background: "#F5F0E8", surface: "#FFFFFF", text: "#1A1A1A", accent: "#E85D5D", secondary: "#6B6B6B" },
  "creative-mode": { background: "#EFE9D9", surface: "#E4DCC4", text: "#0F0F0F", accent: "#1F8A4C", secondary: "#F06CA8" },
  "daisy-days": { background: "#F5F0E6", surface: "#FDE68A", text: "#1A1A1A", accent: "#7ECDC0", secondary: "#F7C8D4" },
  "editorial-forest": { background: "#EFE7D4", surface: "#2E4A2A", text: "#1A1A17", accent: "#E89CB1", secondary: "#D27E96" },
  "editorial-tri-tone": { background: "#F2B6C6", surface: "#F2D86A", text: "#7A1F35", accent: "#7A1F35", secondary: "#F2D86A" },
  "emerald-editorial": { background: "#3CD896", surface: "#F1E9D6", text: "#0F1A5C", accent: "#25B377", secondary: "#3A4593" },
  grove: { background: "#192B1B", surface: "#E8E4D6", text: "#D4CFBF", accent: "#C8524A", secondary: "#DEDAD0" },
  "long-table": { background: "#FAF1E2", surface: "#F2E5CF", text: "#8E2D1F", accent: "#B53D2A", secondary: "#E8D7B6" },
  mat: { background: "#232E26", surface: "#EDE6D0", text: "#F0E8D2", accent: "#C07030", secondary: "#7A4E24" },
  monochrome: { background: "#FAFADF", surface: "#F5F0E4", text: "#1A1A16", accent: "#5E5E54", secondary: "#8A8A80" },
  "neo-grid-bold": { background: "#ECECE8", surface: "#F5F4EF", text: "#0A0A0A", accent: "#E6FF3D", secondary: "#8A8A85" },
  "peoples-platform": { background: "#F4E9D6", surface: "#2C2CDC", text: "#1B1BB0", accent: "#F2A03A", secondary: "#E83A2A" },
  "pin-and-paper": { background: "#EFE56A", surface: "#F8F1D6", text: "#1F3A8A", accent: "#C9A66B", secondary: "#FBE6A4" },
  "pink-script": { background: "#F5EDF1", surface: "#0F0D11", text: "#060507", accent: "#ED3D8C", secondary: "#FF66A8" },
  playful: { background: "#F0C8A0", surface: "#F7DEC6", text: "#1A1A1A", accent: "#E8B88E", secondary: "#F7DEC6" },
  "raw-grid": { background: "#FFFFFF", surface: "#F5F5F5", text: "#0A0A0A", accent: "#F2D4CF", secondary: "#E5EDD6" },
  "retro-windows": { background: "#C0C0C0", surface: "#FFFFFF", text: "#000000", accent: "#000080", secondary: "#808080" },
  "retro-zine": { background: "#C8B99A", surface: "#F4EFE6", text: "#1A1A1A", accent: "#008F4D", secondary: "#00A85D" },
  "sakura-chroma": { background: "#F1E6CB", surface: "#E5D6B0", text: "#3A2516", accent: "#E54489", secondary: "#F09131" },
  scatterbrain: { background: "#FFE066", surface: "#A5D8FF", text: "#1A1A1A", accent: "#FF9F9F", secondary: "#8CE99A" },
  signal: { background: "#1C2644", surface: "#232F55", text: "#F0ECE3", accent: "#8A96A8", secondary: "#4E5A6E" },
  "soft-editorial": { background: "#F2EEDF", surface: "#ECE6D2", text: "#2A241B", accent: "#E1A4C2", secondary: "#D6DD63" },
  "stencil-tablet": { background: "#E2DCC9", surface: "#F4EFE0", text: "#000000", accent: "#C73B7A", secondary: "#2D7E73" },
  studio: { background: "#1C1C1C", surface: "#242422", text: "#F5D200", accent: "#F5D200", secondary: "#2E2E2C" },
  vellum: { background: "#2A3870", surface: "#F4EFE0", text: "#E8D85C", accent: "#3A7878", secondary: "#F5E168" },
};

const boldTemplateTypographyByMood: Array<{ tokens: string[]; typography: FrontendSlidesStyleSpec["typography"] }> = [
  { tokens: ["retro-tech", "cyberpunk", "geeky", "tech-print"], typography: { display: "Tektur", body: "Chakra Petch" } },
  { tokens: ["editorial", "literary", "archival", "scholarly"], typography: { display: "Playfair Display", body: "Source Serif 4" } },
  { tokens: ["professional", "institutional", "trustworthy"], typography: { display: "Space Grotesk", body: "Inter" } },
  { tokens: ["playful", "graphic", "bold", "pop"], typography: { display: "Inter", body: "Space Grotesk" } },
  { tokens: ["crafted", "handmade", "tactile"], typography: { display: "Fraunces", body: "DM Sans" } },
];

const boldTemplateTypographyOverrides: Record<string, FrontendSlidesStyleSpec["typography"]> = {
  "neo-grid-bold": { display: "Space Grotesk", body: "Space Grotesk" },
  studio: { display: "Barlow", body: "IBM Plex Mono" },
};

const boldTemplateLayoutOverrides: Record<string, string> = {
  "neo-grid-bold": "Dense 12-column by 8-row editorial panel grid with a 40px putty frame and square lemon, ink, and paper blocks.",
};

const boldTemplateSignatureOverrides: Record<string, string[]> = {
  "neo-grid-bold": [
    "dense 12-column by 8-row panel grid",
    "lemon, ink, and paper color-block adjacency",
    "heavy uppercase grotesk display type with mono metadata",
    "square blockmarks and persistent page-number tags",
  ],
};

function getBoldTemplateTypography(template: BoldTemplateIndexItem) {
  const override = boldTemplateTypographyOverrides[template.slug];
  if (override) return override;
  const tokens = [...template.mood, ...template.tone].map((token) => token.toLowerCase());
  return boldTemplateTypographyByMood.find((candidate) => candidate.tokens.some((token) => tokens.includes(token)))?.typography
    ?? { display: "Space Grotesk", body: "Inter" };
}

function getBoldTemplatePalette(template: BoldTemplateIndexItem) {
  const override = boldTemplatePaletteOverrides[template.slug];
  if (override) return override;
  if (template.slug === "block-frame" || template.slug === "raw-grid") {
    return { background: "#fffdf5", surface: "#ffffff", text: "#000000", accent: "#fe90e8", secondary: "#f7cb46" };
  }
  if (template.slug === "blue-professional" || template.slug === "signal") {
    return { background: "#fdfae7", surface: "#f4f1e8", text: "#111111", accent: "#1e2bfa", secondary: "#6b6b6b" };
  }
  if (template.slug === "8-bit-orbit") {
    return { background: "#0a0e27", surface: "#0f1b3d", text: "#ffffff", accent: "#5edcf4", secondary: "#f4d03f" };
  }
  if (template.slug === "bold-poster" || template.slug === "broadside") {
    return { background: "#f8f3e8", surface: "#111111", text: "#111111", accent: "#f0442f", secondary: "#222222" };
  }
  return boldTemplatePalettes[template.scheme] ?? boldTemplatePalettes.light;
}

function getBoldTemplateSignatureElements(template: BoldTemplateIndexItem) {
  const override = boldTemplateSignatureOverrides[template.slug];
  if (override) return override;

  const signatures = new Set<string>();
  const haystack = `${template.tagline} ${template.mood.join(" ")} ${template.tone.join(" ")}`.toLowerCase();

  if (/grid|graph|ledger/.test(haystack)) signatures.add("grid-led composition");
  if (/poster|broadside|editorial|zine|literary/.test(haystack)) signatures.add("editorial type hierarchy");
  if (/pixel|crt|retro|windows|8-bit/.test(haystack)) signatures.add("retro digital chrome");
  if (/brutalist|border|block|raw/.test(haystack)) signatures.add("hard borders and offsets");
  if (/warm|paper|parchment|vellum|crafted|tactile/.test(haystack)) signatures.add("paper texture rhythm");
  if (/professional|institutional|trustworthy|consulting/.test(haystack)) signatures.add("executive report structure");

  signatures.add(template.tagline);
  return [...signatures].slice(0, 4);
}

const boldTemplateStyles: FrontendSlidesStyleSpec[] = (boldTemplateSelectionIndex.templates as BoldTemplateIndexItem[]).map((template) => ({
  id: `bold-template-${template.slug}`,
  name: template.name,
  source: "frontend-slides-bold-template",
  vibe: [...template.mood.slice(0, 3), ...template.tone.slice(0, 2)].join("、"),
  layout: boldTemplateContractBySlug.get(template.slug)?.layout ?? boldTemplateLayoutOverrides[template.slug] ?? template.tagline,
  typography: boldTemplateContractBySlug.get(template.slug)?.typography ?? getBoldTemplateTypography(template),
  palette: boldTemplateContractBySlug.get(template.slug)?.palette ?? getBoldTemplatePalette(template),
  signatureElements: boldTemplateContractBySlug.get(template.slug)?.signatureElements ?? getBoldTemplateSignatureElements(template),
  boldTemplate: {
    slug: template.slug,
    tagline: template.tagline,
    mood: template.mood,
    tone: template.tone,
    formality: template.formality,
    density: template.density,
    scheme: template.scheme,
    bestFor: template.best_for,
    avoidFor: template.avoid_for,
    previewMd: template.preview_md,
    designMd: template.design_md,
  },
}));

const styles: FrontendSlidesStyleSpec[] = [...presetAndCustomStyles, ...boldTemplateStyles];

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

// Retained only as a server-side diagnostic fixture; interactive preview uses static local images.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createPreviewHtml(style: FrontendSlidesStyleSpec, input: FrontendSlidesDiscoveryInput) {
  const topic = escapeHtml(input.topic);
  const terminal = style.id === "terminal-green";
  const editorial = ["notebook-tabs", "paper-ink", "vintage-editorial"].includes(style.id);
  const blueprint = style.id === "circuit-blueprint";
  const composition = terminal
    ? `<div class="terminal"><div class="terminal-bar"><i></i><i></i><i></i></div><div class="prompt">$ npx create-mastra</div><h1>${topic}<span class="cursor">_</span></h1><div class="code"><b>agent</b>.define({ tools, memory, workflow })</div></div>`
    : editorial
      ? `<div class="issue">01 / FIELD GUIDE</div><div class="editorial-rule"></div><h1>${topic}</h1><p class="dek">从核心概念到第一个可运行的智能体</p><div class="folio">A PRACTICAL INTRODUCTION <b>2026</b></div>`
      : blueprint
        ? `<div class="coordinates">X.024 / Y.108</div><div class="node n1">AGENT</div><div class="node n2">TOOLS</div><div class="node n3">WORKFLOW</div><div class="trace t1"></div><div class="trace t2"></div><h1>${topic}</h1><p class="dek">构建、连接、运行 TypeScript 原生智能体</p>`
        : `<div class="index">01</div><div class="color-block"></div><div class="kicker">A PRACTICAL GUIDE</div><h1>${topic}</h1><p class="dek">从设计思路到生产级工作流</p><div class="footer">FOUNDATIONS · AGENTS · TOOLS · WORKFLOWS</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${style.palette.background}}.viewport{width:100vw;height:100vh;display:grid;place-items:center;overflow:hidden}.stage{position:relative;width:1920px;height:1080px;transform:scale(.2);transform-origin:center;background:${style.palette.background};color:${style.palette.text};font-family:'${style.typography.body}',sans-serif;overflow:hidden}.slide{position:absolute;inset:0;visibility:hidden;opacity:0;pointer-events:none}.slide.active{visibility:visible;opacity:1;pointer-events:auto}.slide:before{content:"";position:absolute;inset:0;background-image:linear-gradient(${style.palette.accent}18 1px,transparent 1px),linear-gradient(90deg,${style.palette.accent}18 1px,transparent 1px);background-size:96px 96px}.content{position:absolute;inset:100px 130px}h1{position:relative;z-index:2;max-width:1480px;margin:0;font-family:'${style.typography.display}',serif;font-size:124px;line-height:.98;letter-spacing:-.045em;animation:rise .8s cubic-bezier(.2,.8,.2,1) both}.dek{position:relative;z-index:2;max-width:780px;font-size:34px;line-height:1.5;color:${style.palette.secondary};animation:rise .8s .18s both}.kicker,.issue,.coordinates{position:relative;z-index:2;font-size:24px;letter-spacing:.24em;color:${style.palette.accent};margin-bottom:150px}.index{position:absolute;right:10px;top:-70px;font:900 360px/1 '${style.typography.display}';color:${style.palette.accent};opacity:.16}.color-block{position:absolute;width:520px;height:1080px;right:-130px;top:-100px;background:${style.palette.accent};opacity:.82}.footer,.folio{position:absolute;left:0;right:0;bottom:0;border-top:2px solid ${style.palette.accent};padding-top:24px;font-size:24px;letter-spacing:.14em;display:flex;justify-content:space-between}.editorial-rule{width:180px;height:12px;background:${style.palette.accent};margin-bottom:90px}.terminal{position:absolute;inset:70px;border:3px solid ${style.palette.accent};background:${style.palette.surface};padding:110px 90px}.terminal-bar{position:absolute;left:0;right:0;top:0;height:62px;border-bottom:2px solid ${style.palette.accent};display:flex;gap:14px;align-items:center;padding-left:24px}.terminal-bar i{width:18px;height:18px;border-radius:50%;background:${style.palette.accent}}.terminal .prompt,.terminal .code{font-size:30px;color:${style.palette.accent};margin:55px 0}.terminal h1{font-size:104px}.cursor{animation:blink .8s steps(1) infinite}.node{position:absolute;z-index:3;border:2px solid ${style.palette.accent};background:${style.palette.surface};padding:22px 34px;font:700 24px '${style.typography.body}'}.n1{right:160px;top:140px}.n2{right:420px;top:390px}.n3{right:100px;bottom:170px}.trace{position:absolute;border-top:3px solid ${style.palette.accent};transform-origin:left}.t1{width:360px;right:190px;top:310px;transform:rotate(38deg)}.t2{width:310px;right:380px;top:520px;transform:rotate(52deg)}.coordinates{margin-bottom:250px}.content>*{animation-fill-mode:both}@keyframes rise{from{opacity:0;transform:translateY(34px)}to{opacity:1;transform:none}}@keyframes blink{50%{opacity:0}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}
</style></head><body><div class="viewport"><main class="stage"><section class="slide active"><div class="content">${composition}</div></section></main></div><script>const stage=document.querySelector('.stage');function fit(){stage.style.transform='scale('+Math.min(innerWidth/1920,innerHeight/1080)+')'}addEventListener('resize',fit);fit();</script></body></html>`;
}

export function getFrontendSlideStyle(id: string) {
  return styles.find((style) => style.id === id);
}

export function listFrontendSlideStyles() {
  return [...styles];
}

function getPreferredPresetIds(input: FrontendSlidesDiscoveryInput) {
  const technical = /developer|typescript|javascript|agent|framework|api|开发|技术|框架|代码/i.test(`${input.topic} ${input.audience}`);

  if (technical) return ["terminal-green", "swiss-modern"];
  if (input.purpose === "pitch-deck") return ["bold-signal", "electric-studio"];
  if (input.purpose === "conference-talk") return ["creative-voltage", "vintage-editorial"];
  if (input.purpose === "internal-presentation") return ["notebook-tabs", "paper-ink", "swiss-modern"];
  return ["notebook-tabs", "paper-ink"];
}

function getPreferredBoldTemplateIds(input: FrontendSlidesDiscoveryInput) {
  const haystack = `${input.topic} ${input.audience}`.toLowerCase();
  const formal = /board|investor|legal|regulatory|healthcare|finance|executive|cfo|ceo|董事会|投资人|法务|合规|医疗|金融|高管/.test(haystack)
    || input.purpose === "internal-presentation";
  const technical = /developer|typescript|javascript|agent|framework|api|开发|技术|框架|代码/.test(haystack);

  const slugs = technical
    ? ["8-bit-orbit", "cobalt-grid", "blue-professional", "neo-grid-bold", "studio"]
    : formal
      ? ["blue-professional", "signal", "cartesian", "monochrome", "cobalt-grid"]
      : input.purpose === "pitch-deck"
        ? ["bold-poster", "block-frame", "blue-professional", "coral", "neo-grid-bold"]
        : input.purpose === "conference-talk"
          ? ["broadside", "bold-poster", "8-bit-orbit", "studio", "biennale-yellow"]
          : ["blue-professional", "cartesian", "cobalt-grid", "block-frame", "signal"];

  const densitySlugs = input.density === "reading-first"
    ? ["signal", "monochrome", "neo-grid-bold", "raw-grid", "block-frame"]
    : ["bold-poster", "cartesian", "soft-editorial", "vellum"];

  return [...slugs, ...densitySlugs].map((slug) => `bold-template-${slug}`);
}

function getWildcardIds(input: FrontendSlidesDiscoveryInput) {
  const technical = /developer|typescript|javascript|agent|framework|api|开发|技术|框架|代码/i.test(`${input.topic} ${input.audience}`);
  if (technical) return ["circuit-blueprint", "creative-voltage", "bold-template-cobalt-grid"];
  if (input.purpose === "pitch-deck") return ["dark-botanical", "circuit-blueprint", "bold-template-block-frame"];
  if (input.purpose === "conference-talk") return ["circuit-blueprint", "neon-cyber", "bold-template-studio"];
  return ["swiss-modern", "dark-botanical", "bold-template-cartesian"];
}

function pushFirstAvailable(target: string[], ids: string[], excludeIds: Set<string>) {
  const candidate = ids.find((id) => !excludeIds.has(id) && !target.includes(id) && getFrontendSlideStyle(id));
  if (candidate) target.push(candidate);
}

function buildRankedStyleIds(input: FrontendSlidesDiscoveryInput, excludeIds: Set<string>, limit: number) {
  const selectedIds: string[] = [];
  const presetIds = getPreferredPresetIds(input);
  const boldIds = getPreferredBoldTemplateIds(input);
  const wildcardIds = getWildcardIds(input);

  if (excludeIds.size === 0) {
    pushFirstAvailable(selectedIds, presetIds, excludeIds);
    pushFirstAvailable(selectedIds, boldIds, excludeIds);
    pushFirstAvailable(selectedIds, wildcardIds, excludeIds);
  }

  const rankedIds = [
    ...selectedIds,
    ...presetIds,
    ...boldIds,
    ...wildcardIds,
    ...styles.map((style) => style.id),
  ].filter((id, index, all) => all.indexOf(id) === index);

  const availableIds = rankedIds.filter((id) => !excludeIds.has(id));
  const selected: string[] = [];
  const previewFamilies = new Set<string>();

  for (const id of availableIds) {
    const style = getFrontendSlideStyle(id)!;
    const family = style.source === "frontend-slides-bold-template"
      ? `bold:${getBoldPreviewFamily(style.boldTemplate!.slug)}`
      : `style:${style.id}`;
    if (previewFamilies.has(family)) continue;
    selected.push(id);
    previewFamilies.add(family);
    if (selected.length === limit) return selected;
  }

  for (const id of availableIds) {
    if (!selected.includes(id)) selected.push(id);
    if (selected.length === limit) break;
  }
  return selected;
}

export function discoverFrontendSlideStyles(
  input: FrontendSlidesDiscoveryInput,
  catalogSource?: string,
  options: FrontendSlidesDiscoveryOptions = {},
): FrontendSlidesStylePreview[] {
  const excludeIds = new Set(options.excludeIds ?? []);
  const rankedIds = buildRankedStyleIds(input, excludeIds, options.limit ?? 3);

  return rankedIds.map((id) => {
    const style = getFrontendSlideStyle(id)!;
    if (style.source === "frontend-slides-preset" && catalogSource) {
      const requiredTokens = [style.name, style.typography.display, style.typography.body];
      const missingTokens = requiredTokens.filter((token) => !catalogSource.includes(token));
      if (missingTokens.length > 0) {
        throw new Error(`frontend-slides preset ${style.name} drifted from STYLE_PRESETS.md; missing: ${missingTokens.join(", ")}`);
      }
    }
    return {
      style,
      previewImage: `/style-previews/${style.id}.svg`,
    };
  });
}
