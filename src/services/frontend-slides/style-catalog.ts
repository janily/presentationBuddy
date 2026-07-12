import type { FrontendSlidesDensity, FrontendSlidesPurpose, FrontendSlidesStylePreview, FrontendSlidesStyleSpec } from "./style-schema";
export type { FrontendSlidesDensity, FrontendSlidesPurpose, FrontendSlidesStylePreview, FrontendSlidesStyleSpec } from "./style-schema";

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

const styles: FrontendSlidesStyleSpec[] = [
  { id: "bold-signal", name: "Bold Signal", source: "frontend-slides-preset", vibe: "自信、现代、高冲击力", layout: "深色渐变舞台上的高饱和焦点卡片", typography: { display: "Archivo Black", body: "Space Grotesk" }, palette: { background: "#1a1a1a", surface: "#2d2d2d", text: "#ffffff", accent: "#ff5722", secondary: "#ffd166" }, signatureElements: ["bold colored card", "large section numbers", "navigation breadcrumbs"] },
  { id: "electric-studio", name: "Electric Studio", source: "frontend-slides-preset", vibe: "大胆、干净、专业、高对比", layout: "白色与电光蓝上下分屏", typography: { display: "Manrope", body: "Manrope" }, palette: { background: "#ffffff", surface: "#4361ee", text: "#0a0a0a", accent: "#4361ee", secondary: "#ffffff" }, signatureElements: ["two-panel split", "accent edge bar", "hero quote typography"] },
  { id: "creative-voltage", name: "Creative Voltage", source: "frontend-slides-preset", vibe: "创意、活力、复古未来感", layout: "电光蓝与深靛双栏构图", typography: { display: "Syne", body: "Space Mono" }, palette: { background: "#0066ff", surface: "#1a1a2e", text: "#ffffff", accent: "#d4ff00", secondary: "#1a1a2e" }, signatureElements: ["halftone texture", "neon badges", "script accents"] },
  { id: "dark-botanical", name: "Dark Botanical", source: "frontend-slides-preset", vibe: "优雅、艺术、精致、高级", layout: "暗色居中构图与柔和抽象光晕", typography: { display: "Cormorant Garamond", body: "IBM Plex Sans" }, palette: { background: "#0f0f0f", surface: "#191919", text: "#e8e4df", accent: "#d4a574", secondary: "#e8b4b8" }, signatureElements: ["soft gradient circles", "warm accents", "thin vertical lines"] },
  { id: "notebook-tabs", name: "Notebook Tabs", source: "frontend-slides-preset", vibe: "编辑感、井然有序、优雅、触感", layout: "深色背景上的奶油纸张与彩色索引", typography: { display: "Bodoni Moda", body: "DM Sans" }, palette: { background: "#2d2d2d", surface: "#f8f6f1", text: "#1a1a1a", accent: "#98d4bb", secondary: "#c7b8ea" }, signatureElements: ["paper container", "colorful section tabs", "binder holes"] },
  { id: "pastel-geometry", name: "Pastel Geometry", source: "frontend-slides-preset", vibe: "友好、有序、现代、亲和", layout: "粉彩背景上的白色卡片与竖向胶囊", typography: { display: "Plus Jakarta Sans", body: "Plus Jakarta Sans" }, palette: { background: "#c8d9e6", surface: "#faf9f7", text: "#1a1a1a", accent: "#f0b4d4", secondary: "#7c6aad" }, signatureElements: ["soft card", "vertical pills", "subtle shadow"] },
  { id: "split-pastel", name: "Split Pastel", source: "frontend-slides-preset", vibe: "轻松、现代、友好、富有创意", layout: "桃色与薰衣草双色分屏", typography: { display: "Outfit", body: "Outfit" }, palette: { background: "#f5e6dc", surface: "#e4dff0", text: "#1a1a1a", accent: "#c8f0d8", secondary: "#f0d4e0" }, signatureElements: ["split background", "playful badges", "grid overlay"] },
  { id: "vintage-editorial", name: "Vintage Editorial", source: "frontend-slides-preset", vibe: "机智、自信、编辑感、个性鲜明", layout: "暖白画布上的大标题与几何装饰", typography: { display: "Fraunces", body: "Work Sans" }, palette: { background: "#f5f3ee", surface: "#ffffff", text: "#1a1a1a", accent: "#c45b3c", secondary: "#e8d4c0" }, signatureElements: ["abstract geometry", "bordered callouts", "editorial rhythm"] },
  { id: "neon-cyber", name: "Neon Cyber", source: "frontend-slides-preset", vibe: "未来、科技、自信", layout: "深海军蓝空间中的霓虹网格", typography: { display: "Clash Display", body: "Satoshi" }, palette: { background: "#0a0f1c", surface: "#111a2d", text: "#f4ffff", accent: "#00ffcc", secondary: "#ff00aa" }, signatureElements: ["particle background", "neon glow", "grid patterns"] },
  { id: "terminal-green", name: "Terminal Green", source: "frontend-slides-preset", vibe: "开发者、黑客终端、硬核技术", layout: "GitHub 深色终端界面与代码层级", typography: { display: "JetBrains Mono", body: "JetBrains Mono" }, palette: { background: "#0d1117", surface: "#161b22", text: "#e6edf3", accent: "#39d353", secondary: "#58a6ff" }, signatureElements: ["scan lines", "blinking cursor", "code syntax styling"] },
  { id: "swiss-modern", name: "Swiss Modern", source: "frontend-slides-preset", vibe: "干净、精确、包豪斯理性", layout: "可见网格上的非对称黑白红构图", typography: { display: "Archivo", body: "Nunito" }, palette: { background: "#ffffff", surface: "#f2f2f2", text: "#000000", accent: "#ff3300", secondary: "#111111" }, signatureElements: ["visible grid", "asymmetric layouts", "geometric shapes"] },
  { id: "paper-ink", name: "Paper & Ink", source: "frontend-slides-preset", vibe: "文学、克制、深思熟虑", layout: "温暖纸张上的衬线排版与细线", typography: { display: "Cormorant Garamond", body: "Source Serif 4" }, palette: { background: "#faf9f7", surface: "#fffdf9", text: "#1a1a1a", accent: "#c41e3a", secondary: "#6b625b" }, signatureElements: ["drop caps", "pull quotes", "elegant rules"] },
  { id: "circuit-blueprint", name: "Circuit Blueprint", source: "frontend-slides-custom", vibe: "为当前技术主题定制的工程蓝图语言", layout: "非对称技术图纸、坐标标记与模块连线", typography: { display: "Chakra Petch", body: "IBM Plex Mono" }, palette: { background: "#071a2b", surface: "#0d2942", text: "#e8f5ff", accent: "#4de3ff", secondary: "#ffb84d" }, signatureElements: ["circuit traces", "coordinate labels", "blueprint annotations"] },
];

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

export function discoverFrontendSlideStyles(
  input: FrontendSlidesDiscoveryInput,
  catalogSource?: string,
  options: FrontendSlidesDiscoveryOptions = {},
): FrontendSlidesStylePreview[] {
  const technical = /developer|typescript|javascript|agent|framework|api|开发|技术|框架|代码/i.test(`${input.topic} ${input.audience}`);
  const preferredIds = technical
    ? ["terminal-green", "swiss-modern", "circuit-blueprint"]
    : input.purpose === "pitch-deck"
      ? ["bold-signal", "dark-botanical", "circuit-blueprint"]
      : input.purpose === "conference-talk"
        ? ["creative-voltage", "vintage-editorial", "circuit-blueprint"]
        : ["notebook-tabs", "paper-ink", "circuit-blueprint"];

  const excludeIds = new Set(options.excludeIds ?? []);
  const rankedIds = [...preferredIds, ...styles.map((style) => style.id)]
    .filter((id, index, all) => all.indexOf(id) === index)
    .filter((id) => !excludeIds.has(id))
    .slice(0, options.limit ?? 3);

  return rankedIds.map((id) => {
    const style = getFrontendSlideStyle(id)!;
    if (style.source === "frontend-slides-preset" && catalogSource) {
      const requiredTokens = [style.name, style.typography.display, style.typography.body];
      const missingTokens = requiredTokens.filter((token) => !catalogSource.includes(token));
      if (missingTokens.length > 0) {
        throw new Error(`frontend-slides preset ${style.name} drifted from STYLE_PRESETS.md; missing: ${missingTokens.join(", ")}`);
      }
    }
    return { style, previewImage: `/style-previews/${style.id}.svg` };
  });
}
