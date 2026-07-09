# Mastra 改造 Claude Agent SDK 技术方案

## 1. 背景与目标

当前项目已经引入 Mastra，并存在一条 Mastra workflow 路径：

- `src/mastra/index.ts` 注册了 `presentationGenerationWorkflow` 和 3 个 agent。
- `src/mastra/workflows/presentation-generation-workflow.ts` 已用 `createWorkflow` / `createStep` 实现“大纲生成 -> 用户确认 -> HTML 生成”。
- `src/app/api/analyze/route.ts` 已用 `workflow.createRunAsync()`、`run.streamVNext()`、`run.resumeStreamVNext()` 和 `toAISdkFormat()` 输出 AI SDK UI stream。

但项目仍然依赖 Claude Agent SDK 调用 `.claude/skills/frontend-slides`：

- `src/utils/frontend-slides-agent-runner.ts` 直接从 `@anthropic-ai/claude-agent-sdk` 导入 `query`。
- `/api/agent-chat` 优先调用 `startOrContinueFrontendSlidesSession()`，通过 Claude Agent SDK session/resume 维持多轮 skill 会话。
- HTML 生成 step 里的 `invokeFrontendSlidesAgent()` 也依赖 Claude Agent SDK 的 `skills: ["frontend-slides"]` 能力。

本次改造目标：

1. 移除业务 agent 流对 Claude Agent SDK 的依赖。
2. 使用 Mastra Agent / Workflow / Tool 完成 agent 开发。
3. 保留并调用 `.claude/skills/frontend-slides` 中的技能资产和生成规则。
4. 保留完整流式交互效果，包括思考中、阶段进度、大纲流式更新、HTML 生成进度、完成/错误事件。
5. 让交互入口统一收敛到 Mastra，减少 `/api/agent-chat` 与 `/api/analyze` 两套协议并存。

## 2. Mastra 能力选型

根据本地 `mastra` 技能说明与当前已安装包类型定义，建议使用以下 Mastra 原语：

| 场景 | Mastra 原语 | 原因 |
| --- | --- | --- |
| 多轮需求澄清、风格偏好、用户自然语言迭代 | Agent | 开放式任务，需要理解上下文并决定下一步 |
| 从 brief 到 outline 到 style 到 HTML 的生成流水线 | Workflow | 有明确阶段、需要暂停确认、可恢复、可追踪 |
| 读取 frontend-slides 文件、生成 prompt、保存/校验 HTML、生成 style preview | Tool / 普通服务函数 | 确定性能力，不应让 LLM 随意实现 |
| 用户确认 outline / style preview | Workflow suspend/resume | 当前代码已经使用 suspend/resume，适合继续沿用 |
| 前端流式展示 | Workflow writer + AI SDK UI stream | 当前 `/api/analyze` 已经跑通，可扩展事件类型 |

注意：本地 `@mastra/core` 包没有 `dist/docs/references` 目录，因此 API 方案以当前项目已用代码和 `node_modules/@mastra/core/dist/**/*.d.ts` 为准。类型定义显示 `Agent.stream()` 是新名称，`streamVNext()` 已标记 deprecated；workflow 当前仍可继续沿用 `streamVNext()` / `resumeStreamVNext()`，后续实现时再按实际类型迁移。

## 3. 目标架构

```text
用户输入
  -> Next.js API: /api/analyze 或 /api/presentation-agent
    -> Mastra presentationConversationAgent
      -> 判断是否需要澄清 / 是否进入生成 workflow
    -> Mastra presentationGenerationWorkflow
      -> collectBriefStep
      -> outlineStep
      -> styleDiscoveryStep
      -> frontendSlidesHtmlStep
      -> validateAndSaveStep
    -> AI SDK UI stream / NDJSON stream
      -> 前端 AgentPanel + PreviewPane
```

目标模块拆分：

```text
src/
  mastra/
    agents/
      presentation-conversation-agent.ts
      presentation-outline-suggestion-agent.ts
      frontend-slides-composer-agent.ts
    tools/
      frontend-slides-skill-tool.ts
      frontend-slides-preview-tool.ts
      frontend-slides-validation-tool.ts
    workflows/
      presentation-generation-workflow.ts
      presentation-generation-schemas.ts
  services/
    frontend-slides/
      skill-loader.ts
      prompt-builder.ts
      preview-builder.ts
      html-validator.ts
      run-store.ts
```

设计原则：

- Mastra 管 orchestration：谁先谁后、何时暂停、何时恢复、流式事件如何输出。
- frontend-slides skill 管规则：固定 1920x1080 stage、viewport CSS、风格发现、预览、动画、导出要求。
- 业务代码只包装 skill 文件，不复制一份散落在 agent prompt 中。

## 4. frontend-slides Skill 调用方式

Claude Agent SDK 的核心能力是自动发现 skill、读取 skill 文件、使用文件工具写 HTML。改成 Mastra 后，不能再依赖 `skills: ["frontend-slides"]` 这种 SDK 级能力，需要显式实现一个 `FrontendSlidesSkillRuntime`。

### 4.1 SkillRuntime 职责

`FrontendSlidesSkillRuntime` 负责：

1. 读取 `.claude/skills/frontend-slides/SKILL.md`。
2. 按阶段读取必要支持文件：
   - Phase 2：`STYLE_PRESETS.md`、可选 `bold-template-pack/selection-index.json`、候选模板 `preview.md`。
   - Phase 3：`html-template.md`、`viewport-base.css`、`animation-patterns.md`、选中模板 `design.md`。
3. 构造 Mastra agent prompt，把 skill 规则作为上下文注入。
4. 限制输出协议：返回结构化 JSON 或完整 HTML，不返回解释性文本。
5. 校验 HTML：
   - slide 数量不少于预期。
   - 存在 `.slide`。
   - 包含固定 `width: 1920px` 和 `height: 1080px`。
   - 使用 `visibility` / `opacity` / `pointer-events` 切换，不能用 `.slide { display: none }`。
6. 保存到 `public/generated-slides`，返回 `htmlUrl`。

### 4.2 为什么不直接让 Agent 自己读整个 skill 目录

不建议把 `.claude/skills/frontend-slides` 整个目录一次性塞进 agent prompt：

- token 成本不可控。
- style preview、template design、export script 等资源只在特定阶段需要。
- frontend-slides 的规则要求“渐进式读取”，尤其 bold template 的 `design.md` 只能在用户选中后读取。

因此应由 deterministic runtime 控制读取范围，Agent 只接收当前阶段需要的上下文。

## 5. Workflow 设计

建议把现有 `presentationGenerationWorkflow` 扩展为可覆盖完整 frontend-slides Phase 0-5 的 workflow。

### 5.1 Step 规划

| Step | 输入 | 输出 | 是否流式 | 是否可暂停 |
| --- | --- | --- | --- | --- |
| `brief-conversation-step` | 用户消息、历史上下文 | brief 或追问 | 是 | 否 |
| `outline-suggestion-step` | brief | outline | 是，结构化 partial object | 是，等待用户确认 |
| `style-discovery-step` | brief + outline + image context | 3 个 style preview | 是，逐个 preview 生成 | 是，等待用户选风格 |
| `frontend-slides-html-step` | approved outline + selected style | HTML | 是，阶段进度 + 字符数 | 否 |
| `validate-save-step` | HTML | htmlUrl + metadata | 是，短进度 | 否 |

当前代码已经有 `outline-suggestion-step` 和 `presentation-html-generation-step`，可以渐进改造，不必一次性重写。

### 5.2 交互型会话改造

当前 `/api/agent-chat` 让 Claude Agent SDK 直接跑完整 frontend-slides Phase 1-3。迁移后建议取消 Claude session，改成：

```text
用户消息
  -> presentationConversationAgent.generate/stream
  -> 输出 BriefDecision
  -> 未满足：返回 assistant 追问
  -> 已满足：启动 workflow
```

多轮上下文由前端消息历史 + Mastra memory/thread 管理，不再依赖 Claude SDK `session_id` / `resume`。

## 6. 流式交互方案

### 6.1 统一流式协议

建议统一使用 AI SDK UI stream，即继续沿用 `/api/analyze` 的模式：

```ts
createUIMessageStreamResponse({
  stream: createUIMessageStream({
    execute: ({ writer }) => {
      writer.write({ type: "data-workflowRunId", data: run.runId });
      writer.merge(toAISdkFormat(stream, { from: "workflow" }));
    },
  }),
});
```

如果短期要兼容 `/api/agent-chat` 的 NDJSON，也可以做一层 adapter，但最终应只保留一种协议，避免 UI 状态重复。

### 6.2 标准事件类型

建议定义以下 data part：

| 事件 | 用途 |
| --- | --- |
| `data-agentMessage` | 助手自然语言回复，支持澄清问题和生成说明 |
| `data-workflowRunId` | workflow run id，用于 resume |
| `data-presentationBrief` | 已抽取 brief |
| `data-presentationOutline` | 大纲 partial / completed |
| `data-styleDiscovery` | style preview 生成进度、3 个 preview URL、待选择状态 |
| `data-styleSelectionRequired` | workflow suspend payload，等待用户选择 |
| `data-presentationHtml` | HTML 生成进度、generator、字符数、完成 html/htmlUrl |
| `data-validation` | 校验阶段、失败原因、可重试建议 |
| `data-error` | 可展示错误，包含 source step |

### 6.3 HTML 生成流式效果

Mastra 无法天然流式展示“写文件工具”的内部细节，所以需要 runtime 主动写进度：

```text
10% 读取 frontend-slides skill
18% 读取 viewport-base.css / html-template.md / animation-patterns.md
28% 准备 outline -> frontend-slides prompt
40% 生成 HTML 结构
58% 生成 CSS 和动画
72% 生成交互脚本和导航
84% 校验 slide 数量和 fixed stage
92% 保存 HTML 文件
100% 预览就绪
```

对于 agent text stream，可以继续统计 text delta 字符数：

```text
generatedCharacters: html.length
message: "正在生成 HTML（12 KB）..."
```

对于 style preview，每完成一个 preview 就立即发一次事件：

```json
{
  "type": "data-styleDiscovery",
  "data": {
    "status": "streaming",
    "completedPreviews": 2,
    "previews": [
      { "id": "style-a", "name": "Swiss Modern", "url": "/generated-slides/previews/..." }
    ]
  }
}
```

### 6.4 前端状态机

前端 `StudioPhase` 建议扩展：

```ts
type StudioPhase =
  | "briefing"
  | "outlining"
  | "reviewing-outline"
  | "discovering-style"
  | "reviewing-style"
  | "generating"
  | "previewing"
  | "error";
```

UI 只从 stream parts 派生状态，不再让 `/api/agent-chat` 和 `/api/analyze` 分别驱动不同状态。

## 7. Mastra Agent 与 Tool 设计

### 7.1 `presentationConversationAgent`

职责：

- 读取用户消息历史。
- 判断是否需要继续澄清。
- 输出结构化 `BriefDecision`。
- 不直接生成 HTML。

它可以复用当前 `presentation-brief-conversation-agent.ts`，但应修复已有中文 prompt 乱码，并加入 frontend-slides 需要的字段：

```ts
brief: {
  topic: string;
  audience: string;
  pageCount: number;
  purpose: "pitch" | "teaching" | "conference" | "internal" | "other";
  density: "low" | "high";
  styleHint?: string;
  requirements: string;
}
```

### 7.2 `frontendSlidesComposerAgent`

职责：

- 只负责根据 runtime 提供的 skill 上下文和 outline 生成 HTML。
- 不负责读取文件、不负责保存文件、不负责询问用户。
- 使用 `Agent.stream()` 获取 text delta，用 workflow writer 转成进度。

### 7.3 `frontendSlidesSkillTool`

建议工具化能力：

- `loadSkillPhaseContext(phase, selection?)`
- `buildStylePreviewPrompt(input)`
- `buildFinalDeckPrompt(input)`
- `validateFrontendSlidesHtml(html, expectedSlideCount)`
- `saveGeneratedDeck(html)`

实现上可以是 Mastra tool，也可以先做普通 service 函数。若要让 Agent 自主调用，则注册为 tool；若 workflow 明确编排，普通函数更稳定。

## 8. API 改造方案

### 8.1 推荐收敛为一个 API

保留 `/api/analyze`，废弃或重定向 `/api/agent-chat`。

请求 body 支持三类 action：

```ts
type PresentationAgentRequest =
  | { action: "message"; messages: ChatMessage[]; context?: unknown }
  | { action: "approve-outline"; workflowRunId: string; approvedOutline: PresentationOutline }
  | { action: "select-style"; workflowRunId: string; selectedStyleId: string; mixNotes?: string };
```

响应统一是 UIMessage stream。

### 8.2 短期兼容方案

如果前端暂时不能合并协议：

- `/api/agent-chat` 不再调用 Claude SDK。
- 它内部调用 Mastra conversation agent。
- 当 `readyToGenerate=true` 时返回 `brief`，由现有前端再触发 `/api/analyze`。
- 但 HTML 生成一定走 Mastra workflow，不再走 `startOrContinueFrontendSlidesSession()`。

## 9. 数据与持久化

当前 `LibSQLStore({ url: ":memory:" })` 只适合开发环境。迁移后建议：

- 开发：继续 `:memory:`。
- 本地持久：`file:./.mastra/presentation-buddy.db`。
- 生产：Postgres / LibSQL 云服务。

需要持久化的数据：

- workflow run id 与状态。
- brief、outline、style preview metadata。
- selected style。
- generated html metadata。
- 用户消息 thread。

否则用户刷新页面后无法 resume outline/style 确认。

## 10. 迁移步骤

### 阶段 1：抽离 Claude SDK runner

1. 新建 `src/services/frontend-slides/skill-loader.ts`，读取 `.claude/skills/frontend-slides` 必要文件。
2. 新建 `prompt-builder.ts`，把当前 `buildFrontendSlidesAgentPrompt()` 改造成 Mastra prompt builder。
3. 新建 `html-validator.ts`，迁移 `assertFrontendSlidesDocument()` 等校验逻辑。
4. 保留 `src/utils/frontend-slides-agent-runner.ts` 作为旧实现，先不删除。

### 阶段 2：Mastra HTML 生成替换

1. 新建 `frontendSlidesComposerAgent`。
2. 在 `presentation-html-generation-step` 中优先调用 Mastra agent stream。
3. 用 workflow `writer.write()` 发 `data-presentationHtml` 进度。
4. 成功后保存 HTML，失败时走现有 backup agent。
5. 增加测试：validator、prompt builder、workflow fallback。

### 阶段 3：交互会话迁移

1. 改 `/api/agent-chat`：删除 `startOrContinueFrontendSlidesSession()` 调用。
2. 使用 Mastra `presentationBriefConversationAgent` 做多轮需求澄清。
3. 当 brief 完整，启动 `/api/analyze` workflow。
4. 前端去掉 `frontendSlidesSessionId` / `frontendSlidesRunId` 状态。

### 阶段 4：Style Discovery 完整化

1. 新增 `style-discovery-step`。
2. 生成 3 个 preview HTML，保存到临时 preview 目录。
3. workflow suspend，等待用户选 A/B/C 或 Mix。
4. resume 后读取对应 design context，进入最终 HTML 生成。

### 阶段 5：统一流式 UI

1. 前端只消费 AI SDK UI stream。
2. 删除 NDJSON adapter。
3. `AgentPanel` 内只显示一个状态源：stream parts 派生的当前 phase。
4. 保留生成中可输入，但新输入进入队列或触发“完成后应用”。

### 阶段 6：清理依赖

在确认所有路径都不再引用后：

1. 删除 `@anthropic-ai/claude-agent-sdk` 依赖。
2. 删除 `frontend-slides-agent-runner.ts` 或改名为历史备份后移除。
3. 删除环境变量：
   - `ANTHROPIC_API_KEY` 作为 frontend-slides 必需项。
   - `FRONTEND_SLIDES_MODEL` 若只用于 Claude SDK。
4. 保留通用模型配置：`MODEL_API_KEY`、`MODEL_BASE_URL`、`PRESENTATION_*_MODEL`。

## 11. 风险与应对

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| Mastra agent 没有 Claude SDK 的原生 skill discovery | 不能直接 `skills: ["frontend-slides"]` | 显式实现 `FrontendSlidesSkillRuntime` |
| frontend-slides 依赖文件工具写 HTML | Agent 不一定能稳定写文件 | 让 Agent 只返回 HTML，保存由 service 完成 |
| prompt 上下文过长 | 成本高、延迟高 | 按 Phase 渐进读取支持文件 |
| style preview 增加一次用户确认 | 流程变长 | Phase 4 再做，短期先用 brief/outline 直接生成 |
| 当前中文文案存在乱码 | 影响 agent 质量和 UI 文案 | 迁移时统一修复 prompt 与 UI 文案编码 |
| `:memory:` storage 无法跨刷新恢复 | 用户确认中断 | 生产前切换持久化 storage |

## 12. 验收标准

功能验收：

- 用户可以通过右侧对话输入主题。
- Agent 可追问缺失信息，也可在信息足够时直接生成。
- 大纲生成过程有流式状态和 partial outline。
- 用户确认大纲后，HTML 生成有持续进度。
- 最终输出 HTML 仍满足 frontend-slides 固定 1920x1080 stage 规则。
- 预览区能加载生成文件。
- 不再调用 `@anthropic-ai/claude-agent-sdk`。

技术验收：

- `rg "@anthropic-ai/claude-agent-sdk|query\\(" src package.json` 无业务引用。
- `/api/analyze` 或新统一 API 是唯一生成入口。
- 关键 deterministic 逻辑有单元测试：
  - skill loader
  - prompt builder
  - HTML validator
  - stream event reducer
- `npm run lint`、`npm test`、`npm run build` 通过。

## 13. 推荐落地优先级

最高优先级先做“非交互版替换”：

1. workflow HTML step 不再用 Claude Agent SDK。
2. Mastra agent + frontend-slides 文件上下文生成完整 HTML。
3. 保留现有 outline confirm 和 HTML progress。

第二优先级再做“完整 frontend-slides Phase 2 style discovery”：

1. 生成 3 个 style preview。
2. 用户选风格后 resume workflow。
3. 按选中风格生成最终 deck。

这样能最小化风险：先把 Claude SDK 依赖从核心生成链路拿掉，再补齐 frontend-slides 原始 skill 的视觉探索体验。
