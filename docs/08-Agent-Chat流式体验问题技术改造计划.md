# Agent Chat 流式体验问题技术改造计划

## 1. 背景

当前用户在右侧 `Presentation Buddy` 聊天框发送消息后，页面会立即显示一个“正在思考回复...”的 loading 气泡，但真正的 assistant 回复要等 `/api/agent-chat` 请求完整结束后才一次性出现。

从截图里的 Network Timing 看，`agent-chat` 请求的“下载内容”阶段持续约 20 秒。这个现象说明 HTTP 连接确实保持打开了一段时间，但前端没有持续收到可展示的 assistant 文本，只是在等待最后的结果事件。

本次文档只输出技术改造计划，不改代码。后续由实习生按本文档执行。

## 2. 结论摘要

根因不是“完全没有流式响应”，而是“只流了进度状态，没有流 assistant 内容”。

当前 `/api/agent-chat` 已经返回 NDJSON 流，但服务端只在模型调用前发送一条 `progress`：

- `src/app/api/agent-chat/route.ts:44` 定义 `AgentChatStreamEvent`
- `src/app/api/agent-chat/route.ts:84` 创建 NDJSON `ReadableStream`
- `src/app/api/agent-chat/route.ts:225` 调用 `generateBriefDecision(...)`

真正的业务回复仍然来自：

- `src/app/api/agent-chat/route.ts:143` `conversationAgent.generate(...)`
- `src/app/api/agent-chat/route.ts:156` fallback 再次 `conversationAgent.generate(...)`

`generate()` 会等完整结构化结果生成结束后才返回，所以前端只能在最后收到 `result` 后一次性追加 assistant 消息：

- `src/components/presentation-studio/presentation-studio.tsx:316` 等待 `sendToAgentChat(...)`
- `src/components/presentation-studio/presentation-studio.tsx:318` 一次性 `setChatMessages(... data.reply)`

Mastra 当前版本支持真正的流式能力，类型定义已经确认：

- `node_modules/@mastra/core/dist/agent/agent.d.ts:553` `Agent.stream(...)`
- `node_modules/@mastra/core/dist/stream/base/output.d.ts:220` `objectStream`
- `node_modules/@mastra/core/dist/stream/base/output.d.ts:228` `textStream`
- `node_modules/@mastra/core/dist/stream/base/output.d.ts:244` `object`

因此改造方向应是：把 `/api/agent-chat` 从“progress + final result”改为“assistant text delta + final decision result”，让用户在模型生成过程中持续看到文字。

## 3. 当前业务链路

### 3.1 前端链路

入口在 `src/components/presentation-studio/presentation-studio.tsx`。

1. 用户提交消息后进入 `handleAgentSend(...)`。
2. 前端先把用户消息追加到 `chatMessages`。
3. 设置 `isAgentReplying = true`，右侧面板显示 typing dots。
4. 调用 `sendToAgentChat(...)` 发起 `fetch("/api/agent-chat")`。
5. `sendToAgentChat(...)` 读取 `response.body.getReader()`，逐行解析 NDJSON。
6. 如果收到 `progress`，只更新 `agentProgressMessage`。
7. 如果收到 `result`，保存完整 `AgentChatResponse`。
8. fetch 流结束后，`handleAgentSend(...)` 才追加 assistant 文本消息。

当前 UI 层的限制是：没有“正在流式生成的 assistant 消息”这个状态，只有 loading 文案。

相关位置：

- `src/components/presentation-studio/presentation-studio.tsx:233` `sendToAgentChat(...)`
- `src/components/presentation-studio/presentation-studio.tsx:258` `response.body.getReader()`
- `src/components/presentation-studio/presentation-studio.tsx:273` 解析每个 NDJSON event
- `src/components/presentation-studio/presentation-studio.tsx:318` 请求结束后一次性追加 assistant 回复
- `src/components/presentation-studio/agent-panel.tsx:314` `isSending` 只渲染 typing dots 和进度文案

### 3.2 后端链路

入口在 `src/app/api/agent-chat/route.ts`。

1. 校验请求体。
2. 构造最近 20 条历史消息。
3. 通过 `mastra.getAgent("presentationBriefConversationAgent")` 获取会话 agent。
4. `emit({ type: "progress", message: "正在思考回复..." })`。
5. 调用 `generateBriefDecision(...)`。
6. `generateBriefDecisionStructured(...)` 使用 `conversationAgent.generate(history, { structuredOutput: { schema } })`。
7. 如果结构化输出失败，再走 `generateBriefDecisionFallback(...)`，追加“只返回 JSON”的提示，再调用一次 `generate()`。
8. 拿到完整 `decision` 后，执行确认拦截逻辑。
9. 发送单个 `result` event 并关闭流。

这个设计可以避免浏览器完全静默等待，但不能改善首 token 体验。

### 3.3 Agent 配置

`presentationBriefConversationAgent` 负责把自然语言对话转成：

```ts
{
  reply: string;
  readyToGenerate: boolean;
  brief: null | {
    topic: string;
    audience: string;
    pageCount: number;
    style: string;
    requirements: string;
  };
}
```

相关位置：

- `src/mastra/agents/presentation-brief-conversation-agent.ts`
- `briefDecisionSchema`
- 默认模型 `gemini-3.5-flash`
- `getConfiguredModel(...)` 走 `openrouter` / `openai` / `google` / `openai-compatible`

模型速度可能影响总耗时，但不是这次体验问题的唯一原因。即使模型 20 秒才完成，正确的流式改造也应该让用户在生成过程中看到逐步输出。

## 4. Mastra 依据

本地项目已安装 Mastra 包：

- `@mastra/core`
- `@mastra/ai-sdk`
- `@mastra/libsql`
- `@mastra/memory`

按 `$mastra` 技能要求，优先检查本地 embedded docs。但当前安装包没有 `node_modules/@mastra/core/dist/docs/` 目录，因此本计划以本地类型定义为准。

关键类型能力：

| 能力 | 本地类型依据 | 用途 |
| --- | --- | --- |
| `Agent.stream(...)` | `node_modules/@mastra/core/dist/agent/agent.d.ts:553` | 发起真正的流式 agent 调用 |
| `stream.textStream` | `node_modules/@mastra/core/dist/stream/base/output.d.ts:228` | 流式输出 assistant 文本 |
| `stream.objectStream` | `node_modules/@mastra/core/dist/stream/base/output.d.ts:220` | 流式输出结构化对象的 partial object |
| `stream.object` | `node_modules/@mastra/core/dist/stream/base/output.d.ts:244` | 等流结束后拿最终结构化决策 |
| `structuredOutput` | `node_modules/@mastra/core/dist/agent/agent.types.d.ts:107` | 保留最终决策 schema 校验 |

已有 `/api/analyze` 也证明项目已经具备 AI SDK UI stream 基础设施：

- `src/app/api/analyze/route.ts:2` 使用 `createUIMessageStream`
- `src/app/api/analyze/route.ts:4` 使用 `toAISdkFormat`
- `src/app/api/analyze/route.ts:185` 返回 `createUIMessageStreamResponse`
- `src/app/api/analyze/route.ts:192` merge workflow stream

但 `/api/agent-chat` 目前没有使用这套 AI SDK UI stream，而是自定义 NDJSON 协议。

## 5. 目标体验

改造后的体验目标：

1. 用户发送消息后，1 秒内出现 assistant 气泡占位。
2. 模型开始输出后，assistant 文本逐字或逐段增长。
3. 请求还没结束时，用户能看到真实内容，而不是只看到“正在思考回复...”。
4. 最终 `readyToGenerate`、`brief`、`html`、`htmlUrl` 等业务结果仍然准确。
5. 如果结构化决策失败，fallback 过程要有明确进度提示，不能静默再等一轮。
6. 浏览器 Network 里即使请求总耗时仍为 20 秒，用户可感知等待应明显下降。

建议首版验收指标：

| 指标 | 目标 |
| --- | --- |
| 首个非 loading 可见文本 | P95 <= 3 秒 |
| 首个响应字节 | P95 <= 1 秒 |
| assistant delta 间隔 | 正常模型输出期间 P95 <= 2 秒 |
| 20 秒长请求期间 UI 状态 | 必须持续显示真实文本或阶段说明 |
| 原有生成确认逻辑 | 不回归 |
| `/api/analyze` workflow | 不受影响 |

## 6. 推荐改造方案

### 6.1 保留 NDJSON，扩展事件类型

这是首版最小风险方案。不要一开始把 `/api/agent-chat` 强行迁移到 AI SDK UI stream，否则前端 `AgentPanel`、业务 `readyToGenerate`、workflow 启动逻辑会一起重构，范围过大。

建议把 event 类型扩展为：

```ts
type AgentChatStreamEvent =
  | { type: "progress"; message: string }
  | { type: "assistant-delta"; delta: string }
  | { type: "assistant-snapshot"; text: string }
  | { type: "decision"; payload: AgentChatResponse }
  | { type: "error"; error: string };
```

说明：

- `assistant-delta`：服务端每收到一段模型文本就推给前端。
- `assistant-snapshot`：可选。当前端担心 delta 丢失或需要纠偏时，用完整文本覆盖。
- `decision`：替代现在的 `result`，承载最终 `readyToGenerate` 和 `brief`。
- `result` 可暂时兼容一版，避免旧前端直接失效。

### 6.2 服务端使用 `conversationAgent.stream(...)`

把 `generateBriefDecisionStructured(...)` 改造成流式版本。

目标逻辑：

1. 调用 `conversationAgent.stream(history, { structuredOutput: { schema: briefDecisionSchema } })`。
2. 优先读取 `stream.objectStream`，拿 partial `reply`。
3. 当 partial `reply` 比上一次更长时，发送新增 delta。
4. 同时等待 `stream.object` 拿最终决策。
5. 最终仍用 `briefDecisionSchema.parse(...)` 或 Mastra 已验证对象作为权威结果。
6. 执行 `shouldBlockGeneration` 后，发送 `decision`。

注意：

- UI 展示的流式 `reply` 不能直接作为最终业务决策。
- 最终是否生成必须以完整 `decision.readyToGenerate` 和确认拦截逻辑为准。
- 如果 `shouldBlockGeneration` 把模型回复替换成确认文案，最终需要用 `assistant-snapshot` 或 `decision.reply` 覆盖前面流出的文本。

### 6.3 结构化流失败时的 fallback

当前 fallback 会再调用一次 `generate()`，这可能导致用户先等一轮失败，再等第二轮完成。

改造后建议：

1. 结构化 `stream(...)` 抛错时，立即发送：
   - `progress: "结构化回复失败，正在重试普通文本解析..."`
2. fallback 也使用 `conversationAgent.stream(...)`，但让模型输出严格 JSON 文本。
3. 读取 fallback 的 `textStream`，不要直接展示完整 JSON 给用户。
4. fallback 期间只展示 progress，不展示 JSON token。
5. fallback 结束后解析 JSON，再发送最终 `decision`。

原因：fallback 的输出是机器可读 JSON，不适合逐字显示给用户。

### 6.4 前端维护 streaming assistant message

当前 `handleAgentSend(...)` 只有在请求结束后才追加 assistant 消息。需要改为请求开始时创建一条空 assistant 消息，然后在 delta 到来时持续更新。

建议状态流：

1. 用户发送后：
   - 追加 user message。
   - 立即追加 assistant message：`content: ""`，标记为 streaming。
2. `sendToAgentChat(...)` 不再只返回最终 result，而是接收 callbacks：
   - `onAssistantDelta(delta)`
   - `onAssistantSnapshot(text)`
   - `onProgress(message)`
   - `onDecision(payload)`
3. 收到 `assistant-delta`：
   - 找到 streaming assistant message。
   - `content += delta`。
4. 收到 `assistant-snapshot` 或最终 `decision.reply`：
   - 用最终 reply 覆盖 streaming assistant message。
5. 请求结束：
   - 清除 streaming 标记。
   - 根据最终 decision 启动 generation 或更新 frontendSlidesSession。

### 6.5 UI 展示规则

`AgentPanel` 需要避免同时显示“空 assistant 气泡”和 typing dots 的混乱状态。

推荐规则：

- assistant content 为空时：显示 typing dots。
- assistant content 已有文本时：显示文本，并可在末尾显示一个很轻的 loading cursor。
- `progressMessage` 作为辅助状态，不要替代 assistant 文本。
- 如果 fallback 正在执行且没有可展示文本，显示 progress。

首版可以不做复杂光标动画，只要文本能持续增长即可。

### 6.6 Abort 和错误处理

当前前端没有把用户取消传给 `/api/agent-chat`，而 workflow 的 `stop()` 主要作用在 `/api/analyze` 的 `useChat`。

建议首版至少做到：

- `sendToAgentChat(...)` 内部创建 `AbortController`。
- 组件卸载或用户重新开始时 abort 当前 fetch。
- 服务端监听 `request.signal`，传给 `conversationAgent.stream(..., { abortSignal })`。
- 如果前端断开，服务端停止继续 enqueue。

错误时：

- 如果已经流出部分文本，不要再追加一条很长的乱码错误文案。
- 用最终 snapshot 覆盖为可读错误提示，或追加一条 system error card。
- 保留 console error，便于定位 provider 问题。

## 7. 不推荐的方案

### 7.1 只改 loading 文案

把“正在思考回复...”改成更多阶段文案只能缓解焦虑，不能解决用户看不到真实输出的问题。

### 7.2 只优化模型

换更快模型可能降低总耗时，但只要仍用 `generate()` 一次性返回，用户仍然会在慢请求里看不到内容。

### 7.3 直接流 JSON 文本给用户

如果把结构化 JSON token 直接显示在聊天气泡里，用户会看到 `{ "reply": ... }` 这类内部协议，体验更差。

### 7.4 首版统一 `/api/agent-chat` 和 `/api/analyze`

长期可以统一成 AI SDK UI stream，但首版目标是快速修复首 token 体验。直接合并两个协议会扩大回归面。

## 8. 实施步骤

### Phase 1：协议扩展和服务端流式输出

负责人：后端/全栈实习生

修改文件：

- `src/app/api/agent-chat/route.ts`

任务：

1. 扩展 `AgentChatStreamEvent`。
2. 新增 `generateBriefDecisionStream(...)`。
3. 使用 `conversationAgent.stream(... structuredOutput ...)` 替代首选路径的 `generate(...)`。
4. 从 `objectStream` 中提取 partial `reply` 并 emit delta。
5. 等待 `stream.object` 作为最终结果。
6. 保留原 fallback，但 fallback 也要流式调用，并至少发送 progress。
7. 保持现有 `shouldBlockGeneration`、`buildRevisionConfirmationReply(...)`、`buildGenerationConfirmationReply(...)` 逻辑。
8. 最终 emit `decision`，临时兼容 `result` 一版。

验收：

- curl 或浏览器 Network 可以看到多行 NDJSON，其中包含多次 `assistant-delta`。
- 模型慢时，`progress` 后不是一直空等。
- fallback 失败时能返回 `error` event。

### Phase 2：前端接入 assistant delta

负责人：前端实习生

修改文件：

- `src/components/presentation-studio/presentation-studio.tsx`
- `src/components/presentation-studio/agent-panel.tsx`

任务：

1. `sendToAgentChat(...)` 改为 callback 驱动。
2. `handleAgentSend(...)` 在请求开始时插入一条空 assistant message。
3. 收到 `assistant-delta` 时更新这条 message。
4. 收到 `decision` 时用 `decision.reply` 覆盖最终文本。
5. 保持 `readyToGenerate && brief` 后启动 `startGenerationFromBrief(...)`。
6. 保持 `done && html` 后设置 `interactiveResult`。
7. 调整 `AgentPanel`，避免已有流式文本时还显示重复 typing dots。

验收：

- 用户发送消息后，assistant 气泡能逐步出现文字。
- 最终消息内容与旧逻辑一致。
- ready to generate 的确认卡片和 workflow 启动不回归。

### Phase 3：取消、超时和观测

负责人：全栈实习生

修改文件：

- `src/components/presentation-studio/presentation-studio.tsx`
- `src/app/api/agent-chat/route.ts`

任务：

1. 给 `/api/agent-chat` fetch 增加 `AbortController`。
2. `handleStartOver()`、组件卸载、重复发送时取消未完成请求。
3. 服务端将 `request.signal` 传入 Mastra stream。
4. 增加轻量日志：
   - request start
   - first delta timestamp
   - final decision timestamp
   - fallback triggered
5. 日志不要打印完整用户 prompt 和完整模型输出，避免敏感内容泄露。

验收：

- 点击重新开始后，旧请求不再继续更新 UI。
- DevTools 里能定位 first delta latency。

### Phase 4：测试

建议补充测试：

- `parseStreamLine(...)` 支持新事件。
- delta 拼接逻辑正确。
- final snapshot 覆盖前面的 partial 文本。
- `shouldBlockGeneration` 场景下，最终确认文案能覆盖模型流出的“准备生成”类文本。
- fallback JSON 解析失败时，UI 显示可读错误。

如果当前测试体系不方便覆盖 React 流式状态，至少补纯函数测试，把事件 reducer 抽成独立函数。

## 9. 关键边界场景

### 9.1 模型先流出“开始生成”，但系统要拦截确认

当前后端有二次保护：如果用户没有明确确认，即使模型 `readyToGenerate = true`，也会改成确认文案。

流式后可能出现：

1. 模型 partial reply 已经显示“我将开始生成...”
2. 最终后端发现需要 block generation
3. 最终回复变成“我先不直接生成，先和你确认...”

处理方式：

- 最终 `decision.reply` 必须覆盖 assistant message。
- 允许短暂 partial 不一致，但最终状态必须正确。
- 如果要进一步优化，可以在 prompt 中要求模型在最终确认前不要说“开始生成”。

### 9.2 `objectStream` 不稳定或 provider 不支持

不同 provider 对结构化流的支持可能不同。

处理方式：

- 首选 `objectStream`。
- 如果 `objectStream` 没有 partial reply，但最终 `object` 正常，也必须走最终 `decision`。
- 如果结构化流报错，进入 fallback。
- fallback 不展示 JSON 文本，只展示 progress。

### 9.3 中文乱码问题

当前部分 UI 文案已经出现乱码，例如 `agent-panel.tsx` 里的多处中文显示异常。这不是本次 20 秒等待的根因，但改造时不要复制乱码文案。

建议新加的用户可见文案统一用 UTF-8 中文，后续单独安排一次文案编码修复。

### 9.4 历史消息和 partial assistant

`textHistory(messages)` 只应该提交完整历史，不应该把正在流式中的空 assistant message 带入下一次请求。

处理方式：

- 给 streaming assistant message 增加本地标记，或在发送下一次请求前过滤掉 `isStreaming`。
- 最终落库到 `chatMessages` 的必须是完整文本。

## 10. 验收流程

手工验收：

1. 启动开发服务器。
2. 打开应用首页。
3. 在右侧输入：“帮我做一份 mastra 这个 agent 开发框架的入门教程”。
4. 打开 DevTools Network，选中 `/api/agent-chat`。
5. 观察 Response 或 Preview：
   - 应能看到多条 `assistant-delta`。
   - 最后一条是 `decision` 或兼容的 `result`。
6. 观察 UI：
   - assistant 文本逐步出现。
   - 不再 20 秒只显示“正在思考回复...”。
7. 回复“确认生成”。
8. 确认仍然能进入 outline/workflow 流程。
9. 在生成中点击重新开始，确认旧请求不再写入 UI。

自动化验收：

- `npm run lint`
- `npm run test`
- 如果改动 TypeScript 类型较多，执行 `npm run build`

## 11. 交付清单

实习生完成后需要提交：

1. 代码改动 PR。
2. 一段 Network 截图或日志，证明 `/api/agent-chat` 有多次 delta。
3. 一段 UI 录屏或截图，证明 assistant 文本逐步出现。
4. 测试结果：
   - `npm run lint`
   - `npm run test`
   - 是否跑了 `npm run build`
5. 回归说明：
   - 新建 deck 流程是否正常。
   - 确认后生成 outline 是否正常。
   - 已生成 deck 后的 revision 对话是否正常。

## 12. 后续优化方向

首版修复后，再考虑以下优化：

1. 将 `/api/agent-chat` 迁移到 AI SDK UI stream，与 `/api/analyze` 协议统一。
2. 为 `presentationBriefConversationAgent` 增加 Mastra Memory，减少前端手动传历史的复杂度。
3. 针对 brief agent 使用更快的小模型或 provider fallback。
4. 增加首 token latency 指标上报。
5. 单独修复 UI 中文乱码问题。

