# 集成 frontend-slides Skill 需求文档

**文档版本**: v1.0  
**优先级**: P0（最高）  
**预估工期**: 2-3 天  
**负责人**: 前端开发 + AI 集成

---

## 一、问题描述

### 1.1 现状分析

**当前实现**：
- 使用自定义的 `presentationHtmlGenerationAgent`
- 通过通用 LLM（如 `google/gemini-3-flash-preview`）生成 HTML
- Agent 的 instructions 非常简单，仅约 200 字
- 生成的 HTML 质量不稳定，视觉效果一般

**问题**：
```typescript
// 当前的 Agent instructions（过于简单）
export const presentationHtmlGenerationAgent = new Agent({
  id: "presentation-html-generation-agent",
  name: "Presentation HTML Generation Agent",
  instructions: `You are an expert front-end presentation generator...
  - Return only valid HTML in the html field when structured output is requested.
  - Use semantic HTML and embedded CSS in a <style> tag.
  - Create one full-screen slide section for each approved outline slide.
  ...`,
  model: getConfiguredModel(...),
});
```

**生成效果差的根本原因**：
1. **没有专业工具支持**：从零生成 HTML，质量依赖 LLM 能力
2. **缺少动画和交互**：简单的 CSS 无法实现复杂动画效果
3. **视觉设计不够专业**：没有设计系统和视觉规范
4. **无法保证一致性**：每次生成风格可能不同

### 1.2 frontend-slides Skill 介绍

**frontend-slides** 是一个专业的 Claude Code Skill，专门用于生成高质量的 HTML 演示文稿。

**核心优势**：
- ✅ 视觉效果惊艳，内置丰富的动画和过渡效果
- ✅ 支持多种主题风格（简洁、商务、创意等）
- ✅ 自适应布局，支持多设备显示
- ✅ 从 PowerPoint 转换或从零生成
- ✅ 通过视觉探索帮助用户发现审美偏好

**技术特点**：
- 使用 Reveal.js 作为演示框架
- 内置专业的 CSS 动画库
- 支持代码高亮、Markdown、LaTeX 公式
- 可导出为独立 HTML 文件

**GitHub 地址**：https://github.com/zarazhangrui/frontend-slides

---

## 二、集成方案设计

### 2.1 架构调整

**当前流程**：
```
用户输入 Brief 
  → presentationOutlineSuggestionStep (生成 Outline)
  → presentationHtmlGenerationStep (自定义 Agent 生成 HTML)
  → 保存 HTML 文件
```

**目标流程**：
```
用户输入 Brief
  → presentationOutlineSuggestionStep (生成 Outline)
  → 调用 frontend-slides Skill (专业生成工具)
  → 保存 HTML 文件
```

### 2.2 集成方式

有两种集成方式：

#### 方案 A：直接在 Workflow 中调用 Skill（推荐）

**优势**：
- 流程简单，易于维护
- 利用 Mastra Workflow 的状态管理
- 用户体验连贯

**实现**：
```typescript
// 在 presentationHtmlGenerationStep 中调用 frontend-slides
const presentationHtmlGenerationStep = createStep({
  id: "presentation-html-generation-step",
  execute: async ({ inputData, mastra, writer }) => {
    // 构造 frontend-slides 所需的输入
    const slidesInput = formatForFrontendSlides(inputData.outline);
    
    // 调用 frontend-slides Skill
    const result = await invokeFrontendSlidesSkill(slidesInput, {
      style: inputData.style,
      theme: mapStyleToTheme(inputData.style),
    });
    
    return {
      html: result.html,
      htmlUrl: await saveHtmlToFile(result.html),
    };
  },
});
```

#### 方案 B：替换整个 Workflow Step

**优势**：
- 完全使用 frontend-slides 的生成能力
- 可以利用 frontend-slides 的对话式交互

**劣势**：
- 需要重构 UI 交互流程
- 工作量更大

**本次采用方案 A**，快速集成并验证效果。

---

## 三、详细实施步骤

### 步骤 1：了解 frontend-slides Skill 接口

#### 1.1 Skill 的调用方式

frontend-slides 是一个 Claude Code Skill，需要通过 Claude 的 Skill 工具调用。

**典型用法**：
```typescript
// 用户提示词示例
"使用 frontend-slides 创建一份关于 AI 技术的演示文稿，包含 5 页幻灯片，风格简洁现代"
```

**Claude 会自动**：
1. 调用 frontend-slides skill
2. 生成 HTML 演示文稿
3. 返回文件路径或内容

#### 1.2 Skill 的输入格式

frontend-slides 接受以下输入：

**从零生成**：
```
主题：AI 技术趋势
页数：5
风格：简洁现代
内容要点：
1. AI 发展历史
2. 当前技术趋势
3. 应用案例
4. 未来展望
5. 总结
```

**从 Outline 生成**：
```
根据以下大纲生成演示文稿：

标题：AI 技术趋势报告
风格：商务专业

第 1 页：封面
- 标题：AI 技术趋势报告
- 副标题：2026 年度总结

第 2 页：AI 发展历史
- 1950s：图灵测试
- 1980s：专家系统
- 2010s：深度学习
...
```

### 步骤 2：创建 frontend-slides 集成工具

由于 frontend-slides 是一个 Claude Code Skill，我们需要通过 Claude API 调用它。

#### 2.1 创建 Skill 调用工具

**创建文件**：`src/utils/frontend-slides-invoker.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk';

// 支持第三方服务商（中转/代理）提供的 Anthropic 兼容端点
// - ANTHROPIC_API_KEY：第三方服务商提供的 key
// - ANTHROPIC_BASE_URL：第三方服务商的 Anthropic 兼容 API 地址（不设置则直连官方）
// - ANTHROPIC_MODEL：模型 ID（不同服务商的模型命名可能不同，故可配置）
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});

const FRONTEND_SLIDES_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-8';

export interface FrontendSlidesInput {
  title: string;
  style: string;
  slides: Array<{
    title: string;
    content: string;
  }>;
}

export async function invokeFrontendSlidesSkill(
  input: FrontendSlidesInput
): Promise<{ html: string }> {
  // 构造提示词
  const prompt = buildFrontendSlidesPrompt(input);
  
  console.log('Invoking frontend-slides skill:', {
    title: input.title,
    slideCount: input.slides.length,
    style: input.style,
  });
  
  // 调用 Claude API（经由配置的第三方服务商端点），指定使用 frontend-slides skill
  const response = await anthropic.messages.create({
    model: FRONTEND_SLIDES_MODEL, // 默认 claude-opus-4-8，可通过 ANTHROPIC_MODEL 覆盖
    max_tokens: 16000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    // 注意：Skill 调用需要特殊配置，具体参考 Claude Code 文档
  });
  
  // 提取生成的 HTML
  const html = extractHtmlFromResponse(response);
  
  console.log('frontend-slides skill completed:', {
    htmlLength: html.length,
  });
  
  return { html };
}

function buildFrontendSlidesPrompt(input: FrontendSlidesInput): string {
  return `请使用 frontend-slides skill 生成一份 HTML 演示文稿。

标题：${input.title}
风格：${input.style}
页数：${input.slides.length}

详细内容大纲：

${input.slides.map((slide, index) => `
第 ${index + 1} 页：${slide.title}
${slide.content}
`).join('\n')}

要求：
1. 使用专业的视觉设计，风格与 "${input.style}" 匹配
2. 添加流畅的动画和过渡效果
3. 确保文字清晰可读，布局美观
4. 生成独立的 HTML 文件，包含所有样式和脚本
5. 返回完整的 HTML 代码

请开始生成。`;
}

function extractHtmlFromResponse(response: Anthropic.Message): string {
  // 从 Claude 响应中提取 HTML 内容
  const content = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { text: string }).text)
    .join('\n');
  
  // 移除 Markdown 代码块标记
  const htmlMatch = content.match(/```html?\n([\s\S]*?)\n```/);
  if (htmlMatch) {
    return htmlMatch[1];
  }
  
  // 如果没有代码块标记，尝试提取 HTML 标签
  const htmlTagMatch = content.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
  if (htmlTagMatch) {
    return htmlTagMatch[0];
  }
  
  throw new Error('Failed to extract HTML from frontend-slides response');
}
```

#### 2.2 环境变量配置

**添加到 `.env`**：
```env
# ============================================
# Anthropic / Claude 配置（用于 frontend-slides skill）
# ============================================
# 第三方服务商提供的 API Key（中转/代理服务）
ANTHROPIC_API_KEY=sk-xxx

# 第三方服务商的 Anthropic 兼容端点（可选，不设置则直连官方 API）
# 示例：OpenRouter、自建代理、国内中转服务等
ANTHROPIC_BASE_URL=https://your-proxy.com/v1

# 模型 ID（可选，默认 claude-opus-4-8）
# 不同第三方服务商的模型命名可能不同，如 OpenRouter 为 anthropic/claude-opus-4-8
ANTHROPIC_MODEL=claude-opus-4-8
```

**配置说明**：
- **必填项**：`ANTHROPIC_API_KEY`
- **可选项**：
  - `ANTHROPIC_BASE_URL`：不设置时直连 Anthropic 官方 API（`https://api.anthropic.com`）
  - `ANTHROPIC_MODEL`：不设置时默认使用 `claude-opus-4-8`
- **第三方服务商示例**：
  - OpenRouter：`ANTHROPIC_BASE_URL=https://openrouter.ai/api/v1`，模型可能需要前缀如 `anthropic/claude-opus-4-8`
  - One-API / New-API 等自建网关：设置为网关地址
  - 国内中转服务：根据服务商文档设置

**安装依赖**：
```bash
pnpm add @anthropic-ai/sdk
```

---

### 步骤 3：修改 Workflow 集成 frontend-slides

#### 3.1 修改 presentationHtmlGenerationStep

**文件**：`src/mastra/workflows/presentation-generation-workflow.ts`

**修改前**：
```typescript
const presentationHtmlGenerationStep = createStep({
  id: "presentation-html-generation-step",
  execute: async ({ inputData, mastra, writer }) => {
    const generationAgent = mastra.getAgent("presentationHtmlGenerationAgent");
    const stream = await generationAgent.stream([...]);
    
    // 流式接收 HTML
    let html = "";
    // ...
  },
});
```

**修改后**：
```typescript
import { invokeFrontendSlidesSkill } from "@/src/utils/frontend-slides-invoker";

const presentationHtmlGenerationStep = createStep({
  id: "presentation-html-generation-step",
  inputSchema: presentationInputSchema.extend({
    outline: presentationOutlineSchema,
  }),
  outputSchema: z.object({
    html: z.string(),
    htmlUrl: z.string().optional(),
  }),
  execute: async ({ inputData, mastra, writer }) => {
    writer.write({
      type: "data-presentationHtml",
      data: {
        status: "in-progress",
        phase: "structure",
        message: "准备使用专业工具生成演示文稿...",
        progress: 10,
      } satisfies PresentationHtmlStepData,
    });
    
    console.log("Presentation HTML generation: invoking frontend-slides skill", {
      slideCount: inputData.outline.slides.length,
      title: inputData.outline.title,
      style: inputData.style,
    });
    
    // 转换 Outline 为 frontend-slides 输入格式
    const slidesInput = {
      title: inputData.outline.title,
      style: inputData.style,
      slides: inputData.outline.slides.map((slide) => ({
        title: slide.title,
        content: [
          slide.purpose,
          ...slide.keyPoints,
          slide.designSuggestion,
        ].join('\n'),
      })),
    };
    
    writer.write({
      type: "data-presentationHtml",
      data: {
        status: "in-progress",
        phase: "html",
        message: "frontend-slides 正在生成专业演示文稿...",
        progress: 40,
      } satisfies PresentationHtmlStepData,
    });
    
    // 调用 frontend-slides skill
    const result = await invokeFrontendSlidesSkill(slidesInput);
    
    writer.write({
      type: "data-presentationHtml",
      data: {
        status: "in-progress",
        phase: "bundle",
        message: "保存演示文稿...",
        progress: 90,
        generatedCharacters: result.html.length,
      } satisfies PresentationHtmlStepData,
    });
    
    const htmlUrl = await saveHtmlToFile(result.html, { prefix: "presentation-deck" });
    
    writer.write({
      type: "data-presentationHtml",
      data: {
        status: "completed",
        phase: "bundle",
        message: "演示文稿生成完成！",
        progress: 100,
        generatedCharacters: result.html.length,
        html: result.html,
        htmlUrl,
      } satisfies PresentationHtmlStepData,
    });
    
    console.log("Presentation HTML generation: completed", {
      generatedCharacters: result.html.length,
      htmlUrl,
    });
    
    return {
      html: result.html,
      htmlUrl,
    };
  },
});
```

---

### 步骤 4：处理 Skill 调用的特殊情况

#### 4.1 Skill 调用失败降级

如果 frontend-slides 调用失败（如 API Key 无效、网络问题），需要降级到原有方案。

**降级逻辑**：
```typescript
let result;
try {
  result = await invokeFrontendSlidesSkill(slidesInput);
} catch (error) {
  console.warn('frontend-slides skill failed, falling back to legacy agent:', error);
  
  writer.write({
    type: "data-presentationHtml",
    data: {
      status: "in-progress",
      phase: "html",
      message: "使用备用方案生成...",
      progress: 40,
    } satisfies PresentationHtmlStepData,
  });
  
  // 降级到原有的 Agent 生成方式
  const generationAgent = mastra.getAgent("presentationHtmlGenerationAgent");
  const stream = await generationAgent.stream([...]);
  // ... 原有逻辑
}
```

#### 4.2 超时处理

frontend-slides 生成可能需要 1-3 分钟，需要合理设置超时。

```typescript
const FRONTEND_SLIDES_TIMEOUT_MS = 180_000; // 3 分钟

const result = await Promise.race([
  invokeFrontendSlidesSkill(slidesInput),
  timeoutAfter(
    FRONTEND_SLIDES_TIMEOUT_MS,
    'frontend-slides skill timed out'
  ),
]);
```

---

### 步骤 5：优化 Outline 到 Slides 的转换

#### 5.1 增强内容映射

frontend-slides 需要更结构化的内容，我们需要优化转换逻辑。

**创建文件**：`src/utils/outline-to-slides-mapper.ts`

```typescript
import type { PresentationOutlineData } from '@/src/types/presentation-workflow';

export interface FrontendSlide {
  title: string;
  content: string;
  layout?: 'title' | 'content' | 'image' | 'split' | 'quote';
}

export function mapOutlineToFrontendSlides(
  outline: PresentationOutlineData
): FrontendSlide[] {
  return outline.slides.map((slide, index) => {
    // 第一页通常是封面
    if (index === 0 && slide.title.toLowerCase().includes('intro')) {
      return {
        title: outline.title,
        content: slide.purpose,
        layout: 'title',
      };
    }
    
    // 最后一页通常是总结或 CTA
    if (index === outline.slides.length - 1) {
      return {
        title: slide.title,
        content: formatSlideContent(slide),
        layout: 'quote',
      };
    }
    
    // 中间页面
    return {
      title: slide.title,
      content: formatSlideContent(slide),
      layout: 'content',
    };
  });
}

function formatSlideContent(slide: PresentationOutlineData['slides'][number]): string {
  const parts: string[] = [];
  
  // 添加目的说明
  if (slide.purpose) {
    parts.push(`## 核心信息\n${slide.purpose}\n`);
  }
  
  // 添加关键点（转换为列表）
  if (slide.keyPoints && slide.keyPoints.length > 0) {
    parts.push(`## 关键要点\n${slide.keyPoints.map(point => `- ${point}`).join('\n')}\n`);
  }
  
  // 添加设计建议（作为注释）
  if (slide.designSuggestion) {
    parts.push(`<!-- 设计建议: ${slide.designSuggestion} -->`);
  }
  
  return parts.join('\n');
}
```

**在 Workflow 中使用**：
```typescript
import { mapOutlineToFrontendSlides } from "@/src/utils/outline-to-slides-mapper";

const slides = mapOutlineToFrontendSlides(inputData.outline);
const result = await invokeFrontendSlidesSkill({
  title: inputData.outline.title,
  style: inputData.style,
  slides,
});
```

---

## 四、测试计划

### 4.1 单元测试

**测试 frontend-slides 调用**：
```typescript
// tests/frontend-slides-invoker.test.ts
import { invokeFrontendSlidesSkill } from '@/src/utils/frontend-slides-invoker';

describe('frontend-slides-invoker', () => {
  it('should generate HTML presentation', async () => {
    const input = {
      title: 'Test Presentation',
      style: 'modern',
      slides: [
        { title: 'Intro', content: 'Welcome' },
        { title: 'Content', content: 'Main content here' },
        { title: 'End', content: 'Thank you' },
      ],
    };
    
    const result = await invokeFrontendSlidesSkill(input);
    
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('Test Presentation');
  }, 60000); // 60s 超时
});
```

### 4.2 集成测试

**测试完整流程**：
1. 创建测试 Brief
2. 生成 Outline
3. 调用 frontend-slides 生成 HTML
4. 验证 HTML 质量

**验证标准**：
- [ ] HTML 包含 Reveal.js 框架
- [ ] 幻灯片数量与 Outline 一致
- [ ] 包含动画效果
- [ ] 视觉风格与 style 参数匹配
- [ ] 文件大小合理（< 1MB）

### 4.3 视觉效果测试

**人工检查清单**：
- [ ] 字体清晰可读
- [ ] 颜色搭配和谐
- [ ] 动画流畅不卡顿
- [ ] 布局适配不同屏幕尺寸
- [ ] 整体视觉效果专业

---

## 五、风险与应对

### 5.1 技术风险

| 风险 | 概率 | 影响 | 应对措施 |
|-----|------|------|---------|
| frontend-slides Skill 不稳定 | 中 | 高 | 实现降级方案，保留原有 Agent |
| API 调用超时 | 中 | 中 | 设置合理超时，添加重试逻辑 |
| 生成质量不符合预期 | 低 | 中 | 优化 Prompt，调整内容映射 |
| 第三方服务商端点兼容性问题（模型命名不一致、部分 API 特性不支持） | 中 | 中 | 通过 `ANTHROPIC_MODEL` 适配服务商的模型命名；集成前先用最小请求验证端点可用性；不可用时降级到原有 Agent |

### 5.2 集成风险

| 风险 | 概率 | 影响 | 应对措施 |
|-----|------|------|---------|
| Skill 接口变化 | 低 | 高 | 版本锁定，定期检查更新 |
| 成本增加（API 调用） | 高 | 低 | 监控调用量，优化 Prompt 长度 |

---

## 六、完成标准

### 6.1 功能验证
- [ ] 能成功调用 frontend-slides skill
- [ ] 生成的 HTML 包含专业动画效果
- [ ] 视觉质量明显优于原有方案
- [ ] 降级方案正常工作

### 6.2 性能指标
- [ ] frontend-slides 生成时间 < 180 秒
- [ ] 生成的 HTML 文件大小 < 1MB
- [ ] 预览加载时间 < 3 秒

### 6.3 质量标准
- [ ] 通过视觉效果检查清单
- [ ] 用户满意度提升（需人工测试）
- [ ] 无致命 Bug

---

## 七、交付物

1. **代码实现**：
   - `src/utils/frontend-slides-invoker.ts`（Skill 调用工具）
   - `src/utils/outline-to-slides-mapper.ts`（内容映射）
   - `src/mastra/workflows/presentation-generation-workflow.ts`（Workflow 修改）
   - `tests/frontend-slides-invoker.test.ts`（单元测试）

2. **配置文件**：
   - `.env`（添加 `ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`、`ANTHROPIC_MODEL` 环境变量）
   - `package.json`（添加 `@anthropic-ai/sdk` 依赖）

3. **测试报告**：
   - 生成效果对比（修改前 vs 修改后）
   - 性能指标记录
   - 视觉效果检查表

4. **文档更新**：
   - README.md 添加 frontend-slides 说明
   - 环境变量配置文档

---

**下一步**：完成本文档的实施后，继续进行 `04-Agent交互体验重构需求.md`。
