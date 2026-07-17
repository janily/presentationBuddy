import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const previewRoot = path.join(projectRoot, "public", "style-previews");
const presetSourcePath = path.join(projectRoot, ".claude", "skills", "frontend-slides", "STYLE_PRESETS.md");
const generatedContractPath = path.join(
  projectRoot,
  "src",
  "services",
  "frontend-slides",
  "preset-style-contracts.generated.json",
);

const styles = [
  {
    id: "bold-signal",
    name: "Bold Signal",
    source: "frontend-slides-preset",
    vibe: "自信、现代、高冲击力",
    layout: "深色渐变舞台上的高饱和焦点卡片",
    family: "signal-card",
    typography: { display: "Archivo Black", body: "Space Grotesk" },
    palette: { background: "#1a1a1a", surface: "#2d2d2d", text: "#ffffff", accent: "#ff5722", secondary: "#ffd166" },
    signatureElements: ["bold colored card", "large section numbers", "navigation breadcrumbs"],
  },
  {
    id: "electric-studio",
    name: "Electric Studio",
    source: "frontend-slides-preset",
    vibe: "大胆、干净、专业、高对比",
    layout: "白色与电光蓝上下分屏",
    family: "vertical-split",
    typography: { display: "Manrope", body: "Manrope" },
    palette: { background: "#ffffff", surface: "#4361ee", text: "#0a0a0a", accent: "#4361ee", secondary: "#ffffff" },
    signatureElements: ["two-panel split", "accent edge bar", "hero quote typography"],
  },
  {
    id: "creative-voltage",
    name: "Creative Voltage",
    source: "frontend-slides-preset",
    vibe: "创意、活力、复古未来感",
    layout: "电光蓝与深靛双栏构图",
    family: "halftone-split",
    typography: { display: "Syne", body: "Space Mono" },
    palette: { background: "#0066ff", surface: "#1a1a2e", text: "#ffffff", accent: "#d4ff00", secondary: "#1a1a2e" },
    signatureElements: ["halftone texture", "neon badges", "script accents"],
  },
  {
    id: "dark-botanical",
    name: "Dark Botanical",
    source: "frontend-slides-preset",
    vibe: "优雅、艺术、精致、高级",
    layout: "暗色居中构图与柔和抽象光晕",
    family: "soft-botanical",
    typography: { display: "Cormorant Garamond", body: "IBM Plex Sans" },
    palette: { background: "#0f0f0f", surface: "#191919", text: "#e8e4df", accent: "#d4a574", secondary: "#e8b4b8" },
    signatureElements: ["soft gradient circles", "warm accents", "thin vertical lines"],
  },
  {
    id: "notebook-tabs",
    name: "Notebook Tabs",
    source: "frontend-slides-preset",
    vibe: "编辑感、井然有序、优雅、触感",
    layout: "深色背景上的奶油纸张与彩色索引",
    family: "tabbed-paper",
    typography: { display: "Bodoni Moda", body: "DM Sans" },
    palette: { background: "#2d2d2d", surface: "#f8f6f1", text: "#1a1a1a", accent: "#98d4bb", secondary: "#c7b8ea" },
    signatureElements: ["paper container", "colorful section tabs", "binder holes"],
  },
  {
    id: "pastel-geometry",
    name: "Pastel Geometry",
    source: "frontend-slides-preset",
    vibe: "友好、有序、现代、亲和",
    layout: "粉彩背景上的白色卡片与右缘竖向胶囊",
    family: "edge-pills",
    typography: { display: "Plus Jakarta Sans", body: "Plus Jakarta Sans" },
    palette: { background: "#c8d9e6", surface: "#faf9f7", text: "#1a1a1a", accent: "#f0b4d4", secondary: "#7c6aad" },
    signatureElements: ["soft card", "vertical pills", "subtle shadow"],
  },
  {
    id: "split-pastel",
    name: "Split Pastel",
    source: "frontend-slides-preset",
    vibe: "轻松、现代、友好、富有创意",
    layout: "桃色与薰衣草双色分屏",
    family: "pastel-split",
    typography: { display: "Outfit", body: "Outfit" },
    palette: { background: "#f5e6dc", surface: "#e4dff0", text: "#1a1a1a", accent: "#c8f0d8", secondary: "#f0d4e0" },
    signatureElements: ["split background", "playful badges", "grid overlay"],
  },
  {
    id: "vintage-editorial",
    name: "Vintage Editorial",
    source: "frontend-slides-preset",
    vibe: "机智、自信、编辑感、个性鲜明",
    layout: "暖白画布上的大标题与几何装饰",
    family: "vintage-geometry",
    typography: { display: "Fraunces", body: "Work Sans" },
    palette: { background: "#f5f3ee", surface: "#ffffff", text: "#1a1a1a", accent: "#c45b3c", secondary: "#e8d4c0" },
    signatureElements: ["abstract geometry", "bordered callouts", "editorial rhythm"],
  },
  {
    id: "neon-cyber",
    name: "Neon Cyber",
    source: "frontend-slides-preset",
    vibe: "未来、科技、自信",
    layout: "深海军蓝空间中的霓虹网格",
    family: "neon-grid",
    typography: { display: "Clash Display", body: "Satoshi" },
    palette: { background: "#0a0f1c", surface: "#111a2d", text: "#f4ffff", accent: "#00ffcc", secondary: "#ff00aa" },
    signatureElements: ["particle background", "neon glow", "grid patterns"],
  },
  {
    id: "terminal-green",
    name: "Terminal Green",
    source: "frontend-slides-preset",
    vibe: "开发者、黑客终端、硬核技术",
    layout: "GitHub 深色终端界面与代码层级",
    family: "terminal",
    typography: { display: "JetBrains Mono", body: "JetBrains Mono" },
    palette: { background: "#0d1117", surface: "#161b22", text: "#e6edf3", accent: "#39d353", secondary: "#58a6ff" },
    signatureElements: ["scan lines", "blinking cursor", "code syntax styling"],
  },
  {
    id: "swiss-modern",
    name: "Swiss Modern",
    source: "frontend-slides-preset",
    vibe: "干净、精确、包豪斯理性",
    layout: "可见网格上的非对称黑白红构图",
    family: "swiss-grid",
    typography: { display: "Archivo", body: "Nunito" },
    palette: { background: "#ffffff", surface: "#f2f2f2", text: "#000000", accent: "#ff3300", secondary: "#111111" },
    signatureElements: ["visible grid", "asymmetric layouts", "geometric shapes"],
  },
  {
    id: "paper-ink",
    name: "Paper & Ink",
    source: "frontend-slides-preset",
    vibe: "文学、克制、深思熟虑",
    layout: "温暖纸张上的衬线排版与细线",
    family: "literary-paper",
    typography: { display: "Cormorant Garamond", body: "Source Serif 4" },
    palette: { background: "#faf9f7", surface: "#fffdf9", text: "#1a1a1a", accent: "#c41e3a", secondary: "#6b625b" },
    signatureElements: ["drop caps", "pull quotes", "elegant rules"],
  },
  {
    id: "circuit-blueprint",
    name: "Circuit Blueprint",
    source: "frontend-slides-custom",
    vibe: "为当前技术主题定制的工程蓝图语言",
    layout: "非对称技术图纸、坐标标记与模块连线",
    family: "circuit-blueprint",
    typography: { display: "Chakra Petch", body: "IBM Plex Mono" },
    palette: { background: "#071a2b", surface: "#0d2942", text: "#e8f5ff", accent: "#4de3ff", secondary: "#ffb84d" },
    signatureElements: ["circuit traces", "coordinate labels", "blueprint annotations"],
  },
];

const esc = (value) => String(value).replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "'": "&apos;",
  '"': "&quot;",
})[character]);

const hash = (value) => createHash("sha256").update(value).digest("hex");

function composition(style) {
  const { id, palette, typography } = style;
  const { background: bg, surface, text, accent, secondary } = palette;
  const { display, body } = typography;

  switch (id) {
    case "bold-signal":
      return `<defs><linearGradient id="signal-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${bg}"/><stop offset=".52" stop-color="${surface}"/><stop offset="1" stop-color="${bg}"/></linearGradient></defs><rect width="960" height="540" fill="url(#signal-bg)"/><text x="52" y="92" fill="${text}" font-family="${body},sans-serif" font-size="17" letter-spacing="2">01 / 04</text><text x="52" y="482" fill="${text}" fill-opacity=".62" font-family="${body},sans-serif" font-size="14" letter-spacing="2">BOLD SIGNAL</text><rect x="252" y="38" width="670" height="464" fill="${accent}"/><text x="286" y="86" fill="${bg}" font-family="${body},sans-serif" font-size="15" font-weight="600">01</text><text x="888" y="86" text-anchor="end" fill="${bg}" font-family="${body},sans-serif" font-size="13" letter-spacing="1.5">VISION  /  SYSTEM  /  IMPACT</text><text x="286" y="365" fill="${bg}" font-family="${display},sans-serif" font-size="82" font-weight="900" letter-spacing="-4"><tspan x="286">MAKE THE</tspan><tspan x="286" dy="76">SIGNAL LAND.</tspan></text><rect x="286" y="466" width="92" height="5" fill="${secondary}"/>`;
    case "electric-studio":
      return `<rect width="960" height="300" fill="${bg}"/><rect y="300" width="960" height="240" fill="${surface}"/><rect x="0" y="300" width="18" height="240" fill="${text}"/><text x="46" y="58" fill="${text}" font-family="${body},sans-serif" font-size="15" font-weight="700" letter-spacing="2">E/STUDIO</text><text x="914" y="58" text-anchor="end" fill="${text}" font-family="${body},sans-serif" font-size="14">01—2026</text><text x="48" y="166" fill="${text}" font-family="${display},sans-serif" font-size="69" font-weight="800" letter-spacing="-3">CLARITY IS A</text><text x="48" y="242" fill="${text}" font-family="${display},sans-serif" font-size="69" font-weight="800" letter-spacing="-3">DESIGN DECISION.</text><text x="48" y="383" fill="${secondary}" font-family="${body},sans-serif" font-size="23" font-weight="500">A clean system for ambitious ideas</text><path d="M48 430H912" stroke="${secondary}" stroke-opacity=".48"/><text x="48" y="478" fill="${secondary}" font-family="${body},sans-serif" font-size="14" letter-spacing="1.5">STRATEGY / DIRECTION / DELIVERY</text><rect x="858" y="326" width="54" height="54" fill="none" stroke="${secondary}" stroke-width="3"/>`;
    case "creative-voltage":
      return `<defs><pattern id="voltage-dots" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="2.2" fill="${text}" fill-opacity=".22"/></pattern></defs><rect width="596" height="540" fill="${bg}"/><rect x="596" width="364" height="540" fill="${surface}"/><rect x="596" width="364" height="540" fill="url(#voltage-dots)"/><rect x="54" y="46" width="194" height="38" rx="19" fill="${accent}"/><text x="151" y="71" text-anchor="middle" fill="${surface}" font-family="${body},monospace" font-size="13" font-weight="700">CREATIVE MODE / ON</text><text x="54" y="220" fill="${text}" font-family="${display},sans-serif" font-size="92" font-weight="800" letter-spacing="-5"><tspan x="54">IDEAS</tspan><tspan x="54" dy="82">NEED</tspan><tspan x="54" dy="82">VOLTAGE.</tspan></text><text x="650" y="154" fill="${accent}" font-family="cursive" font-size="48" font-style="italic" transform="rotate(-7 650 154)">make it move</text><circle cx="778" cy="344" r="92" fill="none" stroke="${accent}" stroke-width="5"/><path d="M742 344h72M778 308v72" stroke="${accent}" stroke-width="5"/><text x="778" y="476" text-anchor="middle" fill="${text}" font-family="${body},monospace" font-size="14" letter-spacing="2">BUILD / TEST / SHIP</text>`;
    case "dark-botanical":
      return `<defs><radialGradient id="botanical-pink"><stop stop-color="${secondary}" stop-opacity=".58"/><stop offset="1" stop-color="${secondary}" stop-opacity="0"/></radialGradient><radialGradient id="botanical-gold"><stop stop-color="${accent}" stop-opacity=".48"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs><rect width="960" height="540" fill="${bg}"/><circle cx="58" cy="80" r="210" fill="url(#botanical-pink)"/><circle cx="900" cy="490" r="250" fill="url(#botanical-gold)"/><path d="M176 0V540M784 0V540" stroke="${accent}" stroke-opacity=".38"/><path d="M782 96c-70 72-96 150-78 236m10-104c48-8 88-34 120-78m-128 134c-44-2-82-20-112-50" fill="none" stroke="${secondary}" stroke-opacity=".52" stroke-width="3"/><text x="480" y="88" text-anchor="middle" fill="${accent}" font-family="${body},sans-serif" font-size="14" letter-spacing="4">A QUIET STUDY / 01</text><text x="480" y="252" text-anchor="middle" fill="${text}" font-family="${display},serif" font-size="86" font-weight="400"><tspan x="480">A Quieter</tspan><tspan x="480" dy="78" font-style="italic">Kind of Bold</tspan></text><path d="M420 382H540" stroke="${accent}" stroke-width="3"/><text x="480" y="430" text-anchor="middle" fill="${text}" fill-opacity=".62" font-family="${body},sans-serif" font-size="18">FORM · FEELING · RESTRAINT</text>`;
    case "notebook-tabs":
      return `<defs><filter id="paper-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#000000" flood-opacity=".24"/></filter></defs><rect width="960" height="540" fill="${bg}"/><rect x="86" y="38" width="776" height="464" rx="5" fill="${surface}" filter="url(#paper-shadow)"/><g fill="${bg}"><circle cx="112" cy="110" r="8"/><circle cx="112" cy="174" r="8"/><circle cx="112" cy="238" r="8"/><circle cx="112" cy="302" r="8"/><circle cx="112" cy="366" r="8"/><circle cx="112" cy="430" r="8"/></g><g font-family="${body},sans-serif" font-size="11" font-weight="700" fill="${text}"><rect x="862" y="76" width="50" height="72" fill="${accent}"/><text x="894" y="136" transform="rotate(-90 894 136)">IDEAS</text><rect x="862" y="158" width="50" height="72" fill="${secondary}"/><text x="894" y="220" transform="rotate(-90 894 220)">NOTES</text><rect x="862" y="240" width="50" height="72" fill="#f4b8c5"/><text x="894" y="302" transform="rotate(-90 894 302)">DRAFT</text><rect x="862" y="322" width="50" height="72" fill="#a8d8ea"/><text x="894" y="384" transform="rotate(-90 894 384)">BUILD</text><rect x="862" y="404" width="50" height="72" fill="#ffe6a7"/><text x="894" y="466" transform="rotate(-90 894 466)">SHARE</text></g><text x="158" y="112" fill="${text}" font-family="${body},sans-serif" font-size="14" letter-spacing="2">FIELD NOTES / 01</text><path d="M158 138H814" stroke="${text}" stroke-opacity=".22"/><text x="158" y="258" fill="${text}" font-family="${display},serif" font-size="78" font-weight="700"><tspan x="158">Make Room</tspan><tspan x="158" dy="76" font-style="italic">to Think.</tspan></text><text x="158" y="440" fill="${text}" fill-opacity=".58" font-family="${body},sans-serif" font-size="18">AN ORGANIZED PLACE FOR UNFINISHED IDEAS</text>`;
    case "pastel-geometry":
      return `<defs><filter id="pastel-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#4f6777" flood-opacity=".18"/></filter></defs><rect width="960" height="540" fill="${bg}"/><rect x="72" y="48" width="814" height="444" rx="34" fill="${surface}" filter="url(#pastel-shadow)"/><text x="122" y="102" fill="${text}" font-family="${body},sans-serif" font-size="14" font-weight="600" letter-spacing="2">PASTEL SYSTEM / 01</text><text x="122" y="242" fill="${text}" font-family="${display},sans-serif" font-size="78" font-weight="800" letter-spacing="-4"><tspan x="122">SOFT</tspan><tspan x="122" dy="72">STRUCTURE.</tspan></text><text x="122" y="404" fill="${text}" fill-opacity=".56" font-family="${body},sans-serif" font-size="20">Friendly forms. Clear hierarchy.</text><g><rect x="844" y="84" width="44" height="64" rx="22" fill="${accent}"/><rect x="844" y="158" width="44" height="96" rx="22" fill="#a8d4c4"/><rect x="844" y="264" width="44" height="142" rx="22" fill="#5a7c6a"/><rect x="844" y="416" width="44" height="68" rx="22" fill="${secondary}"/></g><g transform="translate(774 88)" fill="none" stroke="${text}" stroke-width="3" stroke-linecap="round"><circle cx="22" cy="22" r="21"/><path d="M22 12v20m-8-8 8 8 8-8"/></g>`;
    case "split-pastel":
      return `<defs><pattern id="split-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="${text}" stroke-opacity=".1"/></pattern></defs><rect width="480" height="540" fill="${bg}"/><rect x="480" width="480" height="540" fill="${surface}"/><rect x="480" width="480" height="540" fill="url(#split-grid)"/><text x="54" y="72" fill="${text}" font-family="${body},sans-serif" font-size="14" font-weight="600" letter-spacing="2">PLAYFUL SYSTEM / 01</text><text x="54" y="232" fill="${text}" font-family="${display},sans-serif" font-size="82" font-weight="800" letter-spacing="-4"><tspan x="54">PLAY</tspan><tspan x="54" dy="76">WITH FORM.</tspan></text><rect x="54" y="402" width="180" height="52" rx="26" fill="${text}"/><text x="144" y="435" text-anchor="middle" fill="${bg}" font-family="${body},sans-serif" font-size="16" font-weight="600">START EXPLORING</text><g font-family="${body},sans-serif" font-size="14" font-weight="600" fill="${text}"><rect x="566" y="96" width="142" height="42" rx="21" fill="${accent}"/><text x="637" y="123" text-anchor="middle">MAKE</text><rect x="704" y="212" width="154" height="42" rx="21" fill="#f0f0c8"/><text x="781" y="239" text-anchor="middle">CONNECT</text><rect x="550" y="342" width="168" height="42" rx="21" fill="${secondary}"/><text x="634" y="369" text-anchor="middle">REMIX</text></g><circle cx="804" cy="430" r="66" fill="none" stroke="${text}" stroke-width="3"/><circle cx="804" cy="430" r="7" fill="${text}"/>`;
    case "vintage-editorial":
      return `<rect width="960" height="540" fill="${bg}"/><path d="M710 0H960V176z" fill="${accent}"/><circle cx="818" cy="382" r="104" fill="${secondary}"/><circle cx="818" cy="382" r="72" fill="none" stroke="${text}" stroke-width="3"/><path d="M708 382H928" stroke="${text}" stroke-width="3"/><circle cx="818" cy="382" r="8" fill="${accent}"/><text x="64" y="68" fill="${text}" font-family="${body},sans-serif" font-size="14" font-weight="600" letter-spacing="2">THE FIELD EDITION / 2026</text><text x="64" y="218" fill="${text}" font-family="${display},serif" font-size="86" font-weight="900" letter-spacing="-3"><tspan x="64">OLD IDEAS,</tspan><tspan x="64" dy="82">NEW SHAPES.</tspan></text><text x="68" y="410" fill="${text}" fill-opacity=".62" font-family="${body},sans-serif" font-size="20">A CONVERSATION ABOUT WHAT STILL WORKS</text><rect x="64" y="452" width="202" height="50" fill="none" stroke="${text}" stroke-width="3"/><text x="165" y="484" text-anchor="middle" fill="${text}" font-family="${body},sans-serif" font-size="15" font-weight="600">READ THE EDITION</text>`;
    case "neon-cyber":
      return `<defs><pattern id="cyber-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="${accent}" stroke-opacity=".16"/></pattern><filter id="cyan-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><radialGradient id="cyber-field"><stop stop-color="${surface}"/><stop offset="1" stop-color="${bg}"/></radialGradient></defs><rect width="960" height="540" fill="url(#cyber-field)"/><rect width="960" height="540" fill="url(#cyber-grid)"/><g fill="${accent}"><circle cx="104" cy="92" r="2"/><circle cx="852" cy="78" r="3"/><circle cx="706" cy="192" r="2"/><circle cx="882" cy="410" r="2"/><circle cx="438" cy="470" r="2"/><circle cx="246" cy="424" r="3"/></g><circle cx="772" cy="178" r="102" fill="${secondary}" fill-opacity=".18" stroke="${secondary}" stroke-width="3" filter="url(#cyan-glow)"/><path d="M686 178h172M772 92v172" stroke="${secondary}" stroke-opacity=".62"/><text x="66" y="88" fill="${accent}" font-family="${body},sans-serif" font-size="14" letter-spacing="3">INTERFACE / 01 / ONLINE</text><text x="64" y="256" fill="${text}" font-family="${display},sans-serif" font-size="88" font-weight="700" letter-spacing="-4">NEXT</text><text x="64" y="342" fill="${accent}" font-family="${display},sans-serif" font-size="88" font-weight="700" letter-spacing="-4" filter="url(#cyan-glow)">SIGNAL</text><text x="68" y="414" fill="${text}" font-family="${body},sans-serif" font-size="19" letter-spacing="2">/// ENTER THE NEW INTERFACE</text>`;
    case "terminal-green":
      return `<defs><pattern id="scan-lines" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 1H960" stroke="${text}" stroke-opacity=".035"/></pattern></defs><rect width="960" height="540" fill="${bg}"/><rect x="34" y="32" width="892" height="476" rx="8" fill="${surface}" stroke="${accent}" stroke-width="3"/><rect x="34" y="32" width="892" height="476" rx="8" fill="url(#scan-lines)"/><path d="M34 88H926" stroke="${accent}" stroke-opacity=".55"/><circle cx="64" cy="60" r="7" fill="${accent}"/><circle cx="88" cy="60" r="7" fill="${secondary}"/><circle cx="112" cy="60" r="7" fill="${text}" fill-opacity=".34"/><text x="148" y="66" fill="${text}" fill-opacity=".55" font-family="${body},monospace" font-size="14">presentation-buddy — zsh</text><text x="74" y="144" fill="${accent}" font-family="${body},monospace" font-size="20">$ pnpm build:agent</text><text x="74" y="246" fill="${text}" font-family="${display},monospace" font-size="68" font-weight="700">SYSTEM<tspan fill="${accent}">_</tspan></text><text x="74" y="330" fill="${secondary}" font-family="${body},monospace" font-size="24">agent<tspan fill="${text}">.define</tspan><tspan fill="#d2a8ff">({</tspan></text><text x="112" y="370" fill="${accent}" font-family="${body},monospace" font-size="24">tools, memory, workflow</text><text x="74" y="410" fill="#d2a8ff" font-family="${body},monospace" font-size="24">})</text><text x="74" y="468" fill="${text}" fill-opacity=".48" font-family="${body},monospace" font-size="15">STATUS: READY / EXIT CODE 0</text>`;
    case "swiss-modern":
      return `<rect width="960" height="540" fill="${bg}"/><g stroke="#d9d9d9"><path d="M80 0V540M240 0V540M400 0V540M560 0V540M720 0V540M880 0V540"/><path d="M0 90H960M0 225H960M0 360H960M0 495H960"/></g><rect x="600" y="0" width="280" height="360" fill="${accent}"/><rect x="720" y="360" width="160" height="135" fill="${secondary}"/><circle cx="640" cy="428" r="68" fill="${surface}" stroke="${text}" stroke-width="3"/><text x="70" y="70" fill="${text}" font-family="${body},sans-serif" font-size="14" font-weight="700" letter-spacing="2">01 / SYSTEMS</text><text x="70" y="238" fill="${text}" font-family="${display},sans-serif" font-size="96" font-weight="800" letter-spacing="-5"><tspan x="70">FORM</tspan><tspan x="70" dy="92">FOLLOWS</tspan></text><text x="622" y="86" fill="${bg}" font-family="${body},sans-serif" font-size="15" font-weight="700">GRID / TYPE / SHAPE</text><text x="860" y="324" text-anchor="end" fill="${bg}" font-family="${display},sans-serif" font-size="84" font-weight="800">01</text><text x="70" y="472" fill="${text}" font-family="${body},sans-serif" font-size="18">PRECISION MAKES SPACE FOR MEANING.</text>`;
    case "paper-ink":
      return `<rect width="960" height="540" fill="${bg}"/><rect x="42" y="32" width="876" height="476" fill="${surface}"/><path d="M80 82H880M80 454H880" stroke="${text}" stroke-width="2"/><text x="82" y="64" fill="${accent}" font-family="${body},serif" font-size="14" letter-spacing="3">ESSAY / VOLUME 01</text><text x="80" y="250" fill="${accent}" font-family="${display},serif" font-size="154" font-weight="600">T</text><text x="166" y="194" fill="${text}" font-family="${display},serif" font-size="72" font-weight="600">HE WORK</text><text x="166" y="266" fill="${text}" font-family="${display},serif" font-size="72" font-weight="600">WORTH DOING</text><path d="M166 298H594" stroke="${accent}" stroke-width="3"/><text x="166" y="350" fill="${secondary}" font-family="${body},serif" font-size="21">A measured introduction to a complex subject.</text><text x="650" y="332" fill="${text}" font-family="${display},serif" font-size="30" font-style="italic"><tspan x="650">“Clarity begins</tspan><tspan x="650" dy="38">with attention.”</tspan></text><text x="880" y="486" text-anchor="end" fill="${accent}" font-family="${body},serif" font-size="18">01</text>`;
    case "circuit-blueprint":
      return `<defs><pattern id="blueprint-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="${accent}" stroke-opacity=".14"/></pattern></defs><rect width="960" height="540" fill="${bg}"/><rect width="960" height="540" fill="url(#blueprint-grid)"/><text x="58" y="64" fill="${accent}" font-family="${body},monospace" font-size="14" letter-spacing="2">X.024 / Y.108 / REV.01</text><text x="58" y="246" fill="${text}" font-family="${display},sans-serif" font-size="76" font-weight="700" letter-spacing="-3"><tspan x="58">BUILD</tspan><tspan x="58" dy="74">SYSTEMS</tspan></text><text x="62" y="422" fill="${secondary}" font-family="${body},monospace" font-size="17">TRACE / CONNECT / EXECUTE</text><g fill="${surface}" stroke="${accent}" stroke-width="3"><rect x="626" y="82" width="202" height="74"/><rect x="500" y="258" width="180" height="74"/><rect x="736" y="390" width="156" height="70"/></g><g fill="${text}" font-family="${body},monospace" font-size="16"><text x="652" y="128">AGENT_NODE</text><text x="526" y="304">TOOL_BUS</text><text x="758" y="434">WORKFLOW</text></g><g fill="none" stroke="${accent}" stroke-width="4"><path d="M626 119H540V295H500"/><path d="M680 295H776V390"/><circle cx="540" cy="119" r="7" fill="${secondary}" stroke="none"/><circle cx="776" cy="295" r="7" fill="${secondary}" stroke="none"/></g><g fill="${secondary}" font-family="${body},monospace" font-size="12"><text x="548" y="108">A.01</text><text x="784" y="286">B.04</text></g>`;
    default:
      throw new Error(`Missing preset preview composition for ${id}`);
  }
}

function renderSvg(style, sourceHash) {
  const metadata = [
    `data-style-id="${style.id}"`,
    `data-preview-family="${style.family}"`,
    `data-contract-hash="${sourceHash}"`,
    `data-display-font="${esc(style.typography.display)}"`,
    `data-body-font="${esc(style.typography.body)}"`,
    `data-signature-elements="${esc(style.signatureElements.join(" | "))}"`,
  ].join(" ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540" role="img" aria-label="${esc(style.name)} title slide preview" ${metadata}>\n<title>${esc(style.name)} title slide preview</title>\n${composition(style)}\n</svg>\n`;
}

async function main() {
  const presetSource = await readFile(presetSourcePath, "utf8");
  await mkdir(previewRoot, { recursive: true });
  const contracts = [];

  for (const style of styles) {
    if (style.source === "frontend-slides-preset") {
      const requiredTokens = [style.name, style.typography.display, style.typography.body];
      const missingTokens = requiredTokens.filter((token) => !presetSource.includes(token));
      if (missingTokens.length > 0) {
        throw new Error(`${style.id} drifted from STYLE_PRESETS.md; missing: ${missingTokens.join(", ")}`);
      }
    }

    const sourceHash = hash(JSON.stringify(style));
    contracts.push({ ...style, sourceHash });
    await writeFile(path.join(previewRoot, `${style.id}.svg`), renderSvg(style, sourceHash), "utf8");
  }

  await writeFile(
    generatedContractPath,
    `${JSON.stringify({ generatedFrom: ".claude/skills/frontend-slides/STYLE_PRESETS.md", contracts }, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(`Generated ${contracts.length} preset/custom preview contracts and SVG covers.\n`);
}

await main();
