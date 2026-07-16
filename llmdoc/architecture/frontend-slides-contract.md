# Architecture of the frontend-slides Generation Contract

## Purpose
- `frontendSlidesComposerAgent` 是系统里**唯一的 HTML 生成来源**，无备用生成器。它的输出必须满足 `.claude/skills/frontend-slides/` 定义的固定舞台契约，规则很硬（禁 reflow、禁 `display:none` 切换等），值得单独固化，避免改动契约文本或校验代码时二者脱节。

## Core Components
- `.claude/skills/frontend-slides/SKILL.md`：主契约文档，定义 Full-Viewport Stage Rules（见下）与 Phase 0-6 交互流程。**注意**：SKILL.md 引用的部分脚本资源属于交互式 Agent CLI 场景，服务器端 Mastra 路径不依赖它们。
- `.claude/skills/frontend-slides/{html-template.md, viewport-base.css, animation-patterns.md, STYLE_PRESETS.md}`：契约的补充文本/CSS，`viewport-base.css` 必须被完整内联进生成的 HTML。
- `src/services/frontend-slides/skill-loader.ts`（`loadFrontendSlidesFinalContext`/`loadFrontendSlidesDiscoveryContext`）：读取上述契约文件并拼装成 agent 可用的上下文文本。`getProjectRoot()` 专门处理 `mastra dev` 下 `process.cwd()` 指向 `.mastra/output` 的情况。
- `src/services/frontend-slides/prompt-builder.ts`（`buildFrontendSlidesMastraPrompt`/`buildFrontendSlidesRepairPrompt`）：把 `FrontendSlidesInput` + 完整契约上下文拼成一次性、headless 的生成 prompt；repair prompt 在首次失败后前置失败原因，复用主 prompt 做整体重生成（不是局部补丁）。
- `src/services/frontend-slides/html-validator.ts`（`assertFrontendSlidesDocument`/`assertFrontendSlidesComplete`）：运行时断言，检查文档完整性、viewport/stage 结构、slide 可见性切换、键盘导航和风格身份；不再校验固定画布尺寸或缩放语法。
- `src/services/frontend-slides/viewport-fill.ts`（`ensureFrontendSlidesViewportFill`）：在校验前幂等注入纯 CSS 全屏覆盖，强制 stage/slide 使用当前 viewport 并清除模板遗留的整体 transform；它不参与失败判定，不包含固定画布尺寸计算。
- `src/utils/outline-to-slides-mapper.ts`（`mapOutlineToFrontendSlides`）：把已批准大纲转成 `FrontendSlidesInput`，含按内容特征分派的 `getSlideLayout`（title/quote/split/content）。
- `src/utils/save-html-to-file.ts`（`resolveGeneratedSlidesDir`/`saveHtmlToFile`）：生成 HTML 的磁盘落盘与 URL 解析，**不在 `src/services/presentation-artifacts/` 里**（那里只是内存版本元数据，命名易混）。
- `src/app/api/preview/[filename]/route.ts`：当产物不在 `public/` 下时的静态托管出口。

## Flow

### 生成与校验链路（`presentation-generation-workflow.ts` Step 2）
1. `mapOutlineToFrontendSlides(outline, style, options)` → `FrontendSlidesInput`。
2. `loadFrontendSlidesFinalContext()` 并行读取 SKILL.md/html-template.md/viewport-base.css/animation-patterns.md（必需）+ 可选 STYLE_PRESETS.md。
3. `frontendSlidesComposerAgent.stream(buildFrontendSlidesMastraPrompt(...))`，流式累积 text-delta，按字符阈值推进度。
4. `extractHtmlFromAgentResult` 剥离 markdown fence / 正则抓取 `<!doctype>...</html>`，再 `assertFrontendSlidesDocument` 校验。
5. 校验失败 → 用 `buildFrontendSlidesRepairPrompt`（带失败原因）**整体重生成一次**；仍失败 → 整步抛错，**不允许切换到其他生成器**。
6. 校验通过 → `saveHtmlToFile` 落盘；若有 `inputData.artifact` 则推进 artifact/proposal 状态（见 request-lifecycle 文档）。

### 落盘路径解析优先级（`resolveGeneratedSlidesDir`）
| 优先级 | 条件 | 目录 | URL 形式 |
|---|---|---|---|
| 1 | `GENERATED_SLIDES_DIR` env 已设置 | 该目录 | `/api/preview/<file>`（`servedByStatic:false, source:"custom"`） |
| 2 | `VERCEL === "1"` | `/tmp/generated-slides` | `/api/preview/<file>`（`servedByStatic:false, source:"vercel"`，`Cache-Control: no-store`） |
| 3 | 默认 | `<projectRoot>/public/generated-slides` | `/generated-slides/<file>`（Next 静态托管，`servedByStatic:true, source:"public"`，`immutable` 缓存） |
- 写入文件名为 `presentation-<uuid>.html`，带 3 次重试。
- `/api/preview/[filename]` 校验文件名必须以 `.html` 结尾、不含 `..`/`/`/`\`，否则 400；用同一 `resolveGeneratedSlidesDir()` 定位目录。

## Invariants（Full-Viewport Stage Rules，契约文本与校验代码的对应关系）
| 契约要求（SKILL.md） | 运行时校验（html-validator.ts） |
|---|---|
| `.deck-viewport`、`.deck-stage` 和 slide 直接铺满当前浏览器 viewport，不使用固定画布或整体缩放 | prompt、SKILL.md、html-template.md 与 viewport-base.css 统一要求 `100vw` + `100dvh`（含 `100vh` fallback）；workflow 通过 `viewport-fill.ts` 注入 `transform:none !important` 的全屏 CSS 兜底；validator 不再检查具体尺寸或缩放源码 |
| 必须有 viewport wrapper + stage 结构 | 断言 `.deck-viewport` + `.deck-stage` 存在 |
| slide 切换用 `visibility`/`opacity`/`pointer-events`，**禁止 `display:none/block`** | 断言 `.slide` 存在且 visibility/pointer-events 成对；**显式禁止** `.slide{display:none}` / `.slide.active{display:block}` 模式 |
| 必须支持 `prefers-reduced-motion` | 断言存在该媒体查询 |
| 必须内联完整 `viewport-base.css` | 由 prompt-builder 注入契约上下文强制要求；validator 不单独重复校验文件内容，靠结构断言间接约束 |
| 必须支持键盘导航 | 断言存在 `keydown` 事件绑定 |
| 自包含单文档，无外部依赖 | 断言无外部 `<script src>`；文档必须闭合完整 |
| slide 数量必须等于批准大纲的页数 | `countGeneratedSlides`（优先数 `class="...slide..."`，回退 `<section>`）+ `assertFrontendSlidesComplete` 强制相等 |
| 已选择视觉风格 | prompt 要求 `.deck-stage` 写入稳定 style ID，并声明、实际引用 style contract 的规范化 background/accent/display-font/body-font CSS variables；validator 校验身份、声明与引用，缺失时触发一次完整 repair 重生成 |
- 固定舞台不变量在两处强制：契约文本（约束模型）+ validator（运行时断言），改任一处必须同步检查另一处是否仍对应。
- `style` revision 是全稿视觉重设计：保留内容、叙事和页序，但清除旧大纲的 `designGuidance`/`designSuggestion`，并要求每一页替换旧布局、字体、配色和标志性元素；内容 revision 才使用“保留未影响页面和当前视觉风格”的约束。
- `artifact-store`（内存元数据）与 `save-html-to-file`（磁盘产物）是两个不同职责的存储，命名容易混淆，改落盘逻辑时认准 `save-html-to-file.ts`。

## Related Docs
- `llmdoc/architecture/request-lifecycle-and-workflows.md`：Step 2 在整条 workflow 中的位置、repair 重试与 workflow 失败处理。
- `llmdoc/must/project-basics.md`：落盘目录优先级速查。
- `llmdoc/memory/doc-gaps.md`：`bold-template-pack/`/`scripts/` 缺失原因、html-template.md 等文件全文未读的记录。
