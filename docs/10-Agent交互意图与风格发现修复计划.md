# Agent 实时交互、意图路由与多风格发现修复计划

**文档版本**：v1.0  
**创建日期**：2026-07-12  
**范围**：仅修复计划，不包含代码修改  
**优先级**：P0（意图错路由、伪流式体验）+ P1（更多风格）

---

## 1. 目标

本计划解决当前验收发现的三个问题：

1. Agent 请求期间主要展示固定的“正在理解 / 仍在组织回复”文案，用户看不到模型真实输出。
2. Agent 没有按用户意图回答。例如用户要求“内容再丰富些”，却被回复为“正在准备三个视觉风格预览”。
3. 用户要求“推荐更多风格”时，系统仍重复展示固定的 3 个风格，没有利用 frontend-slides 已提供的完整风格目录。

目标体验：

- 模型开始回答后，assistant 气泡按 token 实时增长。
- 如果模型/provider 提供 reasoning summary，则以可折叠的“思考摘要”实时展示；不提供时不伪造。
- “丰富内容”只进入内容修改链路，“更多风格”只进入下一批风格发现链路。
- 默认仍遵循 frontend-slides 的 3 个对比预览原则，但用户可继续换一批，且默认不重复已看过的风格。

---

## 2. 调研依据

### 2.1 当前安装版本

- `@mastra/core@0.24.9`
- 根项目 `ai@5.0.210`
- `@mastra/core` 内部兼容层包含 `ai@4.3.19`

本地安装包没有 `node_modules/@mastra/core/dist/docs/references/`，因此本计划按 mastra skill 的要求，继续以当前版本的类型定义作为 API 事实来源。

已确认当前 Mastra 版本支持：

- `Agent.stream(...)`
- `stream.fullStream`
- `stream.textStream`
- `stream.objectStream`
- `reasoning-start`、`reasoning-delta`、`reasoning-end`
- `redacted-reasoning`
- tool call / tool result 流事件

相关类型定义：

- `node_modules/@mastra/core/dist/agent/agent.d.ts`
- `node_modules/@mastra/core/dist/stream/base/output.d.ts`
- `node_modules/@mastra/core/dist/stream/types.d.ts`

### 2.2 frontend-slides 的真实约束

`.claude/skills/frontend-slides/SKILL.md` 明确规定：

- 初次风格发现默认生成 3 个差异明显的预览。
- 三个预览应根据 purpose、audience、mood 和 density 选择。
- `STYLE_PRESETS.md` 包含 12 个 curated presets。
- 理想组合为安全 preset、bold template、wildcard 各一个。

当前仓库没有 skill 文档提到的 `bold-template-pack/selection-index.json` 和模板目录。因此本轮不能把 bold template 当作已可用能力；首期应基于现有 12 个 preset、已有静态预览资源和 1 个本地 custom 风格实现“换一批”。bold template 资源补齐应作为独立增强项，不能阻塞三个问题的修复。

---

## 3. 当前根因

### 3.1 问题一：目前流的是结构化对象字段，不是稳定的自然语言回复流

当前 `/api/agent-chat` 调用：

```ts
conversationAgent.stream(history, {
  structuredOutput: { schema: briefDecisionSchema },
})
```

然后从 `objectStream` 的 partial object 中提取 `reply` 字段。问题在于：

- provider 可能在完整 JSON 接近结束时才给出 `reply`。
- provider 可能不提供稳定的 partial object。
- structured output 失败后会发起第二次 JSON fallback，等待时间叠加。
- fallback 的 `textStream` 被全部缓存后才解析，没有流给用户。
- 前端在首个 assistant delta 前只能显示本地计时器生成的固定状态。

因此当前虽然使用了 `stream()`，但不是用户可感知的稳定自然语言流式回答。

另外，“大模型实时思考过程”必须区分两类数据：

1. **真实回答流**：模型最终给用户的自然语言回答 token，可以直接实时展示。
2. **reasoning summary**：只有 provider 明确返回 `reasoning-*` 事件时才可展示，并应作为摘要而不是内部完整推理链。

不得把计时器文案包装成模型思考，不得展示 `redacted-reasoning`，也不得声称未收到的内部推理链是“实时思考过程”。

### 3.2 问题二：动作枚举过粗，服务端还有无意图条件的强制改写

当前 `briefDecisionSchema.nextAction` 只有：

- `chat`
- `discover-styles`
- `generate`

它无法明确表达：

- 丰富现有内容
- 修改某几页内容
- 调整结构或页数
- 修改配色
- 推荐下一批风格
- 选择某个风格

更严重的是 `/api/agent-chat/route.ts` 中存在以下后置规则：

```ts
decision.readyToGenerate && decision.brief && !hasSelectedStyle
```

只要模型认为可以执行、存在 brief 且前端没有 `styleSpec`，服务端就无视最新用户意图，强制把结果改写成 `discover-styles`。这正是“内容再丰富些”可能被改成“准备三个视觉风格预览”的直接根因。

`hasSelectedStyle` 只依赖 `selectedStyle` 或 artifact 的 `brief.styleSpec`。旧 artifact 即使已有文字风格名称，也可能没有 `styleSpec`，从而被错误视为“未选风格”。

Agent 提示词也硬编码了：

> Reply only that three visual frontend-slides previews are being prepared.

这会进一步放大错路由后的答非所问。

### 3.3 问题三：目录有更多风格，但发现算法永远返回固定 3 个

`src/services/frontend-slides/style-catalog.ts` 当前有：

- 12 个 frontend-slides preset
- 1 个本地 custom 风格 `Circuit Blueprint`

但 `discoverFrontendSlideStyles()` 根据四类场景直接选择固定 ID 数组，并始终返回 3 项：

- 技术主题：Terminal Green / Swiss Modern / Circuit Blueprint
- pitch deck：Bold Signal / Dark Botanical / Circuit Blueprint
- conference talk：Creative Voltage / Vintage Editorial / Circuit Blueprint
- 其他：Notebook Tabs / Paper & Ink / Circuit Blueprint

函数没有接收以下状态：

- 用户已经看过哪些风格
- 当前是首次发现还是“更多风格”
- 用户不喜欢上一批的具体原因
- 用户希望保留或排除的色调、字体、明暗、正式度
- 当前批次或 cursor

同时，现有单测明确断言结果长度必须为 3。这适用于“每批 3 个”，不应被误解为“整个会话只能有 3 个”。

---

## 4. 目标架构

### 4.1 核心原则：可见回复与机器动作分离

不要继续让一个 structured object 同时承担“用户可见回复”和“程序动作决策”。改为：

```text
用户消息
  -> 确定性前置路由（仅处理明确产品命令）
  -> Mastra Conversation Agent 自然语言 stream
       -> text-delta：直接进入 assistant 气泡
       -> reasoning-delta：可选进入折叠的思考摘要
       -> tool-call：产生结构化动作
  -> 服务端策略校验
  -> data-agentDecision
  -> 前端执行 workflow / revision / style discovery
```

收益：

- 自然语言不再被 JSON 结构阻塞，可以更早出现首 token。
- 动作由 Zod 校验的 tool input 承载，不需要从聊天文案猜测。
- Agent 的回答和动作仍来自同一次 Mastra run，避免两个模型各自理解一次导致漂移。
- 服务端保留最终策略门禁，模型不能仅凭一句含糊表达直接生成或覆盖 artifact。

### 4.2 新的意图与动作契约

建议把动作扩展为：

| action | 含义 | 典型表达 |
| --- | --- | --- |
| `chat` | 解释、回答、澄清，不修改文稿 | “Mastra 和 LangGraph 有什么区别？” |
| `revise-content` | 丰富、精简、改写现有内容 | “内容再丰富些”“第 4 页多讲讲 memory” |
| `revise-structure` | 增删页、调整顺序或章节 | “加一页案例”“把 4-6 页合并” |
| `change-palette` | 仅修改配色 | “换成黑白红” |
| `discover-styles` | 初次或重新开始风格发现 | “推荐几种风格” |
| `more-styles` | 在当前发现会话中加载下一批 | “还有别的吗”“再推荐一些” |
| `select-style` | 选择当前批次中的准确 style ID | “选第二个”“用 Swiss Modern” |
| `generate` | 用户明确确认生成或应用修改 | “确认生成”“就按这个改” |

建议定义声明式 Mastra tools，tool 本身不直接写 artifact：

- `proposeRevision`
- `requestStyleDiscovery`
- `selectPresentationStyle`
- `requestGeneration`

tool input 至少包含：

- `action`
- `instruction`
- `targetSlides`（可选）
- `requiresOutlineReview`
- `styleId`（选择风格时必填）
- `styleMode: initial | more | restart`

服务端收集 tool call/result 后统一生成 `AgentDecision`，前端只消费该契约，不从 assistant 文案反推动作。

### 4.3 确定性前置路由的边界

只对语义完全确定的 UI 命令走本地路由：

- 点击“换一种视觉风格” -> `discover-styles`
- 点击风格卡 -> `select-style`
- 点击“换一批” -> `more-styles`
- 点击“修改配色”快捷入口 -> 展示配色选择或 `change-palette`

自由文本仍交给 Agent。例如“更丰富一点但不要增加页数”需要结合 artifact 和 outline 理解，应由 Agent 产生 `revise-content`，不能用脆弱正则硬判。

### 4.4 服务端动作门禁

后置校验必须基于动作本身，而不是 `hasSelectedStyle` 这类旁路条件：

- 只有 `discover-styles` / `more-styles` 才能打开风格预览。
- `revise-content` 不得被“未选 styleSpec”改写成风格发现。
- `generate` 必须满足明确确认规则。
- `select-style` 的 `styleId` 必须存在于本次 style discovery session 提供的候选中。
- `more-styles` 必须存在有效 style discovery session；否则降级为 `discover-styles`。
- 修改已生成文稿时必须带当前 `deckId`、`version`、brief 和 approved outline。

删除当前 `shouldDiscoverStyle = readyToGenerate && brief && !hasSelectedStyle` 的无意图强制改写。新文稿是否必须先选视觉风格，应在新建生成状态机中显式表达，不能影响 revision 对话。

---

## 5. 问题一实施计划：真实流式回复与思考摘要

### 5.1 服务端流协议

扩展 Agent Chat UI stream 事件：

- `text-start / text-delta / text-end`：模型真实回答。
- `reasoning-start / reasoning-delta / reasoning-end`：仅转发 provider 实际提供的 reasoning summary。
- `data-agentStatus`：连接、排队、fallback 等系统状态，明确标记为系统状态。
- `data-agentDecision`：最终结构化动作。
- `error`：本轮错误。

服务端读取 Mastra `fullStream`，按 chunk type 映射到 AI SDK UI stream。处理规则：

- `text-delta` 立即写给客户端，不等待最终动作。
- `reasoning-delta` 只有在内容非空、非 redacted 且 provider 允许展示时才转发。
- `redacted-reasoning` 只记录类型和计数，不记录或展示内容。
- tool call/result 仅用于形成 decision；默认不把原始工具参数直接展示给用户。
- 最终 decision 不再用 snapshot 覆盖已经正确流完的 assistant 文本；只有规范化、补全或 fallback 时才发送 snapshot。

### 5.2 前端消息模型

将 assistant streaming message 扩展为稳定的 parts：

- `content`
- `reasoningSummary`
- `isStreaming`
- `streamState: connecting | reasoning | answering | finalizing | done | error`

展示规则：

- 未收到模型事件前，可显示轻量“正在连接模型”，但必须视觉上标为状态，不叫“思考过程”。
- 收到 reasoning 后显示可折叠“思考摘要”，默认折叠或只显示最后一行。
- 收到首个 text delta 后，以回答文本为主，不再用固定等待气泡占位。
- provider 没有 reasoning 时直接从连接状态进入回答，不生成模拟 reasoning。
- abort 后保留已收到文本，并标记“已停止”，不清空整个气泡。

### 5.3 降级策略

- 自然语言 stream 成功但没有 action：保留回答，并追加轻量可重试提示；不得猜测执行修改。
- tool schema 校验失败：不发起第二次完整回复生成；可用一次短的 action-only 修复调用，且用户已看到的回答保持不变。
- provider 完全不支持 reasoning：功能正常，只没有“思考摘要”。
- 首 token 超时：展示真实系统状态和取消入口，不能循环伪造不同“思考阶段”。

### 5.4 观测指标

增加按 `operationId` 关联的指标：

- `request_received_at`
- `provider_started_at`
- `first_reasoning_delta_at`
- `first_text_delta_at`
- `first_tool_call_at`
- `decision_emitted_at`
- `stream_closed_at`
- `fallback_reason`
- `intent/action`

验收目标：

- 正常网络下 P50 首个可见模型事件小于 2 秒。
- P95 首个可见模型事件小于 5 秒；超过阈值显示系统慢响应状态。
- assistant 文本至少产生 2 次增量更新的测试 fixture 中，UI 必须按序渲染，不得等结束后一次出现。

---

## 6. 问题二实施计划：按用户意图回答和执行

### 6.1 Agent 提示词重构

删除容易造成偏置的固定指令：

- “Reply only that three visual ... previews are being prepared.”
- 只允许 `chat / discover-styles / generate` 的决策描述。

新增高优先级规则：

- 最新用户请求优先，历史上下文只用于补全对象，不得用旧任务覆盖最新意图。
- 先判断用户是在问问题、修改内容、修改结构、改配色、找风格、要更多风格、选风格还是确认执行。
- 回复必须直接回应最新请求，并引用当前 deck 的具体章节/页码（可用时）。
- “更丰富”默认保持现有视觉风格和页数，除非用户明确要求增页或换风格。
- 风格发现只能由风格相关意图触发。
- 不得声称已执行尚未开始的 workflow。

### 6.2 上下文输入

现有 `deckContext` 已包含 brief 和 approved outline，应继续保留并补齐：

- `deckId`
- `version`
- 当前准确 `styleId/styleSpec`（如有）
- 当前生成状态
- 当前 style discovery session 摘要（如有）

不要只传 `hasGeneratedDeck` 和 `hasSelectedStyle` 布尔值。布尔值可以作为派生字段，但不能成为路由事实来源。

### 6.3 “内容再丰富些”的目标行为

对截图中的请求，预期流程为：

```text
用户：我觉得内容还需要再丰富下
Agent（流式）：可以。当前 11 页框架可以保留，我建议优先补强……
Agent action：revise-content
```

如果请求足够明确，Agent 应总结准备补强的页面并请求一次确认；确认后进入现有 revision workflow，复用当前 approved outline。若会改变页数或章节结构，则 action 必须是 `revise-structure` 并重新进入 outline review。

任何情况下都不得打开 style preview，除非用户同时明确提出换风格。

### 6.4 冲突意图

一句话可能包含多个修改，例如“内容丰富些，同时换成更专业的风格”。动作契约应允许：

- `mixed` revision，内部包含 content 与 style 两个 operation；或
- 返回有序 `actions[]`，先确认组合变更，再执行一次 revision workflow。

首期建议使用单个 `mixed` revision，避免一次用户请求触发两个并行 artifact 版本。

---

## 7. 问题三实施计划：更多风格与不重复推荐

### 7.1 保留“每批 3 个”，取消“永远只有 3 个”

frontend-slides 的 3 个预览是单批视觉比较原则，不是总量上限。目标交互：

1. 初次推荐 3 个差异明显的风格。
2. 用户点击“换一批”或输入“再推荐一些”。
3. 返回下一批 3 个，默认排除已展示和已拒绝的 style ID。
4. 候选耗尽后明确提示“已展示全部可用预设”，允许重置筛选或混搭。

### 7.2 Style discovery session

新增会话状态：

```ts
type StyleDiscoverySession = {
  sessionId: string;
  briefFingerprint: string;
  shownStyleIds: string[];
  rejectedStyleIds: string[];
  selectedStyleId?: string;
  preferences?: {
    scheme?: "light" | "dark" | "mixed";
    tone?: string[];
    avoid?: string[];
  };
  batch: number;
};
```

状态规则：

- 同一 brief 下的 `more-styles` 复用 session。
- topic/audience/purpose/density 发生实质变化时建立新 session。
- 选择风格后保留 session，方便用户返回比较。
- 重新开始或显式“从头推荐”才清空 `shownStyleIds`。

### 7.3 目录 API 与排序

重构 `discoverFrontendSlideStyles(input)` 为支持：

- `limit`，默认 3。
- `excludeIds`。
- `preferredIds`。
- `preferences`。
- 稳定的 ranking score。

排名至少考虑：

- topic / audience 的技术、商业、教育、创意属性。
- purpose。
- density。
- 明暗、正式度、活力、编辑感等用户反馈。
- 与本批其他候选的差异度。
- 是否已展示。

初次技术教程仍可优先 Terminal Green / Swiss Modern / Circuit Blueprint；下一批应从 Electric Studio、Neon Cyber、Paper & Ink、Bold Signal 等剩余候选中按匹配度选择，而不是重复首批。

### 7.4 UI

风格预览区增加：

- “换一批”命令按钮。
- “上一批”或已看风格历史入口（P1，可后置）。
- 当前批次信息，例如“第 2 批 · 还有 7 种可看”。
- 候选耗尽状态。

聊天中输入“更多风格”与点击“换一批”必须调用同一个 `more-styles` action，避免两套行为。

### 7.5 资源一致性

当前 12 个 preset 已有对应静态 SVG 预览。`Circuit Blueprint` 是本地 custom，不属于 `STYLE_PRESETS.md` 的 12 个 preset，应在数据层保留准确 source。

后续若补齐 bold template pack：

- 只读取 selection index 做候选排名。
- 只加载入选模板的 `preview.md`。
- 用户最终选择后才加载该模板的 `design.md`。

这应作为 P2 增强，不与本轮 P0/P1 修复混在同一个提交中。

---

## 8. 分阶段实施顺序

### Phase A：修复意图契约与错误强制路由（P0）

涉及文件：

- `src/mastra/agents/presentation-brief-conversation-agent.ts`
- `src/app/api/agent-chat/route.ts`
- `src/types/agent-chat.ts`
- `src/components/presentation-studio/presentation-studio.tsx`

工作项：

1. 引入细分 action schema 和声明式 Mastra tools。
2. 删除无意图的 `shouldDiscoverStyle` 强制改写。
3. 让 revision 使用完整 deck context。
4. 增加 server policy validator。
5. 用 action 驱动 `startGenerationFromBrief`、`beginRevision`、`discoverStyles`。

### Phase B：真实回复流与 reasoning summary（P0）

涉及文件：

- `src/app/api/agent-chat/route.ts`
- `src/components/presentation-studio/agent-chat-ui-stream.ts`
- `src/components/presentation-studio/agent-message-model.ts`
- `src/components/presentation-studio/agent-panel.tsx`
- `src/components/presentation-studio/presentation-studio.tsx`

工作项：

1. 从 structured `objectStream.reply` 切换为自然语言 `fullStream`。
2. 映射 text、reasoning、tool 和 error 事件。
3. UI 区分系统状态、思考摘要和最终回答。
4. 保留 abort 后的部分回复。
5. 增加首事件与决策耗时指标。

### Phase C：可连续发现更多风格（P1）

涉及文件：

- `src/services/frontend-slides/style-catalog.ts`
- `src/services/frontend-slides/style-schema.ts`
- `src/mastra/workflows/frontend-slides-style-discovery-workflow.ts`
- `src/app/api/style-discovery/route.ts`
- `src/components/presentation-studio/presentation-studio.tsx`
- `src/components/presentation-studio/presentation-preview-pane.tsx`

工作项：

1. 增加 catalog 列表、排除集合和排名能力。
2. 增加 style discovery session。
3. 打通 `more-styles` action。
4. 增加“换一批”和候选耗尽状态。

### Phase D：回归与观测（P0/P1）

1. 补齐单元、route、stream reducer 和交互测试。
2. 在 Mastra Studio 和应用 UI 各跑一遍同样的对话脚本。
3. 记录首 token、action 准确率、fallback 次数和风格重复率。
4. 桌面与移动端截图验收。

---

## 9. 测试计划

### 9.1 意图路由测试矩阵

| 用户输入 | 上下文 | 预期 action | 禁止行为 |
| --- | --- | --- | --- |
| 内容再丰富些 | 已生成 11 页 | `revise-content` | 不得发现风格 |
| 第 4 页补充 memory 示例 | 已生成 | `revise-content` | 不得重做无关页面 |
| 增加一页竞品对比 | 已生成 | `revise-structure` | 不得直接跳过 outline review |
| 推荐一些其它风格 | 已有风格批次 | `more-styles` | 不得重复上一批 |
| 换一种视觉风格 | 已生成 | `discover-styles` | 不得直接生成 |
| 用第二个 | 当前批次有效 | `select-style` | 不得选择批次外 ID |
| 就按这个生成 | 已明确选风格 | `generate` | 不得再次打开风格发现 |
| Mastra 和其它框架有什么区别 | 任意 | `chat` | 不得修改 artifact |

### 9.2 流式测试

- `reasoning-start -> reasoning-delta x2 -> reasoning-end -> text-delta x3 -> tool-call -> decision` 按序渲染。
- 无 reasoning、只有 text 时正常回答。
- 只有 text、无 tool 时不执行 artifact 操作。
- tool schema 无效时保留已流出的回答。
- abort 后保留部分回答并停止更新。
- snapshot 不得把非空的正确流式回答覆盖为空。
- 慢响应状态与模型回答不能同时显示为两个 assistant 气泡。

### 9.3 风格发现测试

- 初次返回 3 个互不重复的候选。
- 第二批与第一批无交集。
- 连续请求直到覆盖所有可用候选。
- 候选耗尽后返回明确状态，不重新从第一批循环。
- `excludeIds`、用户明暗偏好和 purpose 会改变排序。
- 所有返回 previewImage 都存在对应静态资源。
- preset 与 `STYLE_PRESETS.md` 的 name/font contract 不漂移。

### 9.4 端到端验收脚本

1. 创建一份 11 页 Mastra 教程并选择 Terminal Green。
2. 生成完成后输入“我觉得内容还需要再丰富下”。
3. 确认 assistant 实时输出针对内容的建议，左侧不出现风格预览。
4. 确认后执行 revision，保持原风格并复用现有 outline；如增页则先 review 新 outline。
5. 输入“推荐一下其它的风格”。
6. 确认出现新的 3 个预览。
7. 再输入“还有吗”。
8. 确认第二批不重复第一批。
9. 选择其中一个并确认生成，验证准确 style ID 贯穿 brief、revision 和最终 HTML。

---

## 10. 验收标准

### 问题一

- [ ] assistant 回答以真实模型 text delta 增长，不再等待完整 structured object。
- [ ] provider 有 reasoning summary 时可实时折叠展示；没有时不伪造。
- [ ] 固定计时器文案明确属于系统状态，不冒充模型思考。
- [ ] 用户可以取消，已收到的部分回答不会消失。

### 问题二

- [ ] “内容再丰富些”稳定命中 `revise-content`，不得进入 style discovery。
- [ ] 服务端不再依据 `!hasSelectedStyle` 强制覆盖最新用户意图。
- [ ] Agent 回答引用当前 deck/outline，直接回应最新请求。
- [ ] chat、revision、style、generation 四类动作都有独立契约和门禁。

### 问题三

- [ ] 初次每批展示 3 个，符合 frontend-slides 默认比较原则。
- [ ] “更多风格/换一批”返回未展示过的新候选。
- [ ] 会话可遍历现有全部可用 preset，耗尽后有明确提示。
- [ ] 选中风格使用准确 style ID/styleSpec，不只保存显示名称。

---

## 11. 风险与边界

| 风险 | 应对 |
| --- | --- |
| 当前 provider 不返回 reasoning events | 只展示真实 answer stream；reasoning summary 是可选增强，不阻塞主流程 |
| tool call 出现在回答末尾，动作仍有延迟 | 用户先看到自然语言流；用 action-only fallback 修复缺失动作，不重跑整段回复 |
| 模型调用 tool 不稳定 | 对明确 UI 命令使用确定性前置路由，服务端校验所有 action |
| 旧 artifact 没有 styleSpec | 不再把该情况等同于“用户要求发现风格”；必要时从已知 style name 做一次显式迁移 |
| 风格候选很快耗尽 | 明确提示已展示全部现有 preset，提供重置筛选和混搭，不静默重复 |
| skill 文档提到 bold template，但仓库资源缺失 | 先基于现有 12 presets + custom 完成修复；模板包作为独立 P2 引入 |

---

## 12. 非目标

本轮不包含：

- 修改演示文稿 HTML 生成质量。
- 引入或下载缺失的 bold template pack。
- 更换模型或 provider。
- 重构整个 presentation generation workflow。
- 展示模型不可访问、被 redacted 或不应暴露的内部完整推理链。

本计划要求的代码改造应按 Phase A 到 D 分批提交，每个阶段保持可独立回滚，并避免与现有未跟踪生成 HTML 混入同一提交。
