# Agent 思考反馈与确认执行闭环优化方案

**日期**：2026-07-13  
**状态**：待评审  
**优先级**：P0  
**范围**：Agent Chat 思考态、取消语义、修改提案确认与执行闭环  
**约束**：本文仅给出分析与实施方案，不包含代码修改

---

## 1. 结论摘要

本次截图中的两个问题不是单纯的文案问题，而是两条交互链路的状态语义没有建立完整契约。

### 问题一：把“模型正在处理”误报成“模型响应较慢”

当前前端和服务端都设置了 3 秒、8 秒计时器，并依次展示：

- “仍在组织回复，已等待 3 秒…”
- “模型响应较慢，可取消后重试。”

这些文案只根据时间触发，不知道模型是在排队、连接、输出 reasoning、生成回答，还是执行动作分类。因此它们不是模型真实状态，也不应被展示成“思考过程”。项目虽然已经接入 Mastra 的 `reasoning-start / reasoning-delta / reasoning-end`，但 UI 只有收到非空 reasoning 文本后才显示“思考摘要”，思考期间仍主要由硬编码等待文案占据视觉焦点。

目标应调整为：

1. 系统状态、模型思考摘要、最终回答三类信息明确分层。
2. “思考摘要”有持续但克制的动画反馈，动画由真实 `streamState` 驱动。
3. 未收到 reasoning 时不伪造思考内容；只显示中性的系统处理状态。
4. 运行中只提供“停止”，不诱导用户“取消后重试”；只有失败或超时后才提供“重试”。
5. 前端和服务端只保留一个状态计时来源，避免重复计时和文案相互覆盖。

### 问题二：“按你的方案来执行”没有执行上轮已确认的修改

当前链路存在四个连续缺陷：

1. `explicitlyConfirmedGeneration()` 没有识别“按你的方案来执行”这类引用上轮方案的确认表达。
2. 系统没有保存上轮 Agent 给出的结构化修改提案，下一轮确认时只能让模型重新理解整段历史。
3. 确认被拦截后，`buildRevisionConfirmationReply()` 只读取当前 `brief.style`，所以内容/大纲修改被错误改写成“确认 Paper & Ink 视觉方向”。
4. 即使确认识别成功，前端主要根据 `readyToGenerate + brief` 启动生成，并没有把上轮 `revision` 作为不可变的待执行命令消费；结构修改也没有独立的 outline revision workflow。

因此，仅给正则补一句“按你的方案来执行”只能修复截图文案，不能保证真正执行正确方案。

目标应调整为：

- Agent 提出修改时生成并保存一份带 ID、版本和具体指令的 `PendingActionProposal`。
- 用户说“按你的方案来执行”时，确认的是这份已存在的提案，不再重新猜测 brief、风格或修改内容。
- 确认后立即进入与提案类型匹配的 Workflow；不得再次询问无关的视觉方案。
- 内容修改保持当前大纲和视觉风格；结构修改先生成新版大纲，再按产品策略自动继续生成或进入精确的大纲差异确认。

---

## 2. 调研依据与当前架构

### 2.1 Mastra 当前版本能力

项目当前安装：

- `@mastra/core@0.24.9`
- `mastra@0.18.9`
- `ai@5.0.97`

本地安装包没有 `node_modules/@mastra/core/dist/docs/`，因此按照 `$mastra` 技能要求，以当前安装版本的类型定义作为 API 事实来源。已确认支持：

- `Agent.stream(...)`
- `stream.fullStream`、`stream.textStream`、`stream.objectStream`
- `reasoning-start`、`reasoning-delta`、`reasoning-end`
- `structuredOutput`
- Agent tools 与 `toolChoice`
- `abortSignal`
- Workflow step 的 `abortSignal`、suspend/resume 与 stream

对应事实来源：

- `node_modules/@mastra/core/dist/agent/agent.d.ts`
- `node_modules/@mastra/core/dist/agent/agent.types.d.ts`
- `node_modules/@mastra/core/dist/agent/types.d.ts`
- `node_modules/@mastra/core/dist/stream/types.d.ts`
- `node_modules/@mastra/core/dist/stream/base/output.d.ts`
- `node_modules/@mastra/core/dist/workflows/workflow.d.ts`

Mastra 的能力不是当前问题的阻塞点；问题主要出在应用层如何解释流事件，以及如何把 Agent 提案交给确定性的 Workflow 执行。

### 2.2 当前 Agent Chat 链路

```text
用户消息
  -> PresentationStudio.handleAgentSend
  -> POST /api/agent-chat
  -> 第一次 Agent.stream：生成可见自然语言回答
  -> 第二次 Agent.stream：把对话重新分类成 BriefDecision
  -> 服务端 intent guard / confirmation guard 改写 decision
  -> assistant-snapshot 覆盖前面流出的文本
  -> data-agentDecision
  -> 前端按 readyToGenerate / nextAction 决定是否启动 Workflow
```

这条链路已有真实 text delta 和 reasoning delta，但“可见回复”与“机器动作”来自两次模型调用。两次调用会增加延迟，也可能产生语义漂移：第一遍在讨论大纲修改，第二遍却把当前视觉风格当成下一步重点。

---

## 3. 问题一：思考态、慢响应与取消交互

### 3.1 现状根因

#### 根因 A：前后端重复维护同一组时间文案

`src/app/api/agent-chat/route.ts`：

- 请求开始发送“正在思考回复...”
- 3 秒发送“仍在组织回复，已等待 3 秒…”
- 8 秒发送“模型响应较慢，可取消后重试。”

`src/components/presentation-studio/presentation-studio.tsx` 又独立设置相同的 3 秒、8 秒计时器。

结果是：

- 两套计时器可能相互覆盖。
- UI 文案不由真实 stream event 驱动。
- 用户会把系统估计状态误认为模型真实思考状态。
- “取消后重试”暗示当前请求已经失败，实际请求可能仍在正常推理。

#### 根因 B：思考摘要容器出现得太晚

当前消息模型已有：

- `reasoningSummary`
- `streamState: connecting | reasoning | answering | finalizing | done | error`

但 `agent-panel.tsx` 只有在 `reasoningSummary` 非空时才渲染“思考摘要”。收到 `reasoning-start`、尚未收到文本 delta 时，用户看到的仍是通用 TypingDots 和计时文案。

#### 根因 C：取消与重试的语义混在一起

当前运行中按钮执行的是 abort，但文案同时建议“取消后重试”。正确语义应是：

- 运行中：用户可以“停止本次请求”。
- 用户停止：保留已有输出，并显示“已停止”。
- 失败/超时：才显示“重试”。

重试是失败后的恢复动作，不是思考较久时的默认建议。

### 3.2 目标状态机

| 状态 | 触发依据 | 主视觉 | 推荐文案 | 可用动作 |
| --- | --- | --- | --- | --- |
| `connecting` | 请求已发出，尚无模型事件 | 轻量三点动画 | 正在连接模型… | 停止 |
| `reasoning` | 收到真实 reasoning start/delta | 思考摘要动画卡 | 思考中 | 停止、展开/收起摘要 |
| `finalizing` | reasoning 已结束，回答尚未开始 | 摘要卡动画减弱 | 正在整理回复… | 停止 |
| `answering` | 收到 text delta | 流式文本 + 光标 | 不额外显示等待文案 | 停止 |
| `slow-active` | 超过阈值且仍无模型可见事件 | 中性系统状态 | 模型仍在处理，你可以继续等待或停止本次请求。 | 停止 |
| `done` | decision 已完成 | 静态思考摘要 + 最终回答 | 无 | 后续正常交互 |
| `cancelled` | 用户主动 abort | 保留部分输出 + 状态徽标 | 已停止本次请求。 | 重新发送 |
| `timeout/error` | 真实超时或 provider 错误 | 错误卡 | 本次处理未完成，未执行任何修改。 | 重试 |

状态优先级：真实模型事件高于计时状态。只要收到 reasoning 或 text delta，就不再显示 `slow-active` 文案。

### 3.3 “思考摘要”动画方案

动画目的是说明“这一轮仍在推进”，不是制造虚假的思考步骤。

#### 运行中样式

- Brain 图标使用 1.6～2 秒一次的轻微呼吸动画，避免高频旋转。
- 标题从“思考摘要”临时切换为“思考中”，标题右侧显示三个顺序淡入的小点。
- 摘要容器底部增加低对比度的横向流光，表示仍在接收增量。
- 收到 reasoning delta 后，摘要正文逐段追加；默认显示最近 2～3 行，可点击展开完整摘要。
- 没有任何 reasoning delta 时只显示标题与动画，不生成“正在分析结构”“正在检查大纲”等伪造步骤。

#### reasoning 结束后

- 动画在 200～300ms 内自然停止。
- 标题变为“思考摘要”。
- 默认折叠，用户可再次展开。
- 最终回答开始流式输出，回答区域只保留一个轻量光标，不再同时展示 TypingDots。

#### 无障碍要求

- 支持 `prefers-reduced-motion`，关闭呼吸、流光和弹跳，只保留静态状态点。
- 状态文字使用 `aria-live="polite"`，但 reasoning token 本身不要逐 token 播报。
- 展开按钮使用明确的 `aria-expanded` 和可读名称。
- 动画不改变容器高度，避免每次 delta 造成布局跳动。

### 3.4 文案替换建议

| 当前文案 | 问题 | 建议文案 |
| --- | --- | --- |
| 正在思考回复… | 混淆系统状态与模型思考 | 正在连接模型… |
| 正在理解你的要求… | 可能并未收到任何模型事件 | 正在处理你的请求… |
| 仍在组织回复，已等待 3 秒… | 硬编码、制造焦虑、没有动作价值 | 正在处理，你可以随时停止本次请求。 |
| 模型响应较慢，可取消后重试。 | 把正常思考误报为异常，并诱导重复请求 | 模型仍在处理，你可以继续等待或停止本次请求。 |
| 取消当前请求 | “取消”容易被理解为撤销已有成果 | 停止本次请求 |
| 已取消当前请求 | 没说明部分内容和业务操作状态 | 已停止本次请求，已收到的内容已保留。 |
| 对话响应超时，请重试。 | 没说明是否已执行修改 | 本次处理超时，未执行任何修改。请重试。 |

### 3.5 状态来源收敛

建议以服务端 stream 事件作为主状态源，前端只保留一个网络兜底定时器：

1. 服务端发送 `data-agentStatus`，内容改为结构化 `state + message`，而不是任意字符串。
2. 前端根据 `reasoning-*`、`text-*` 和 `decision` 直接切换 `streamState`。
3. 前端兜底计时器只在长时间没有收到任何事件时进入 `slow-active`；一旦收到真实事件立即清除。
4. 删除前后端重复的 3 秒/8 秒文案计时逻辑。
5. Retry 按钮只由 `error`、`timeout`、`cancelled` 终态提供。

---

## 4. 问题二：确认方案后没有按意图执行

### 4.1 截图场景的实际错误链路

场景：

```text
前一轮：用户与 Agent 已讨论并确认要修改大纲、增加内容
用户：按你的方案来执行
实际：我先不直接生成。你是想把这份演示文稿改成「Paper & Ink」这个方向吗？
预期：执行刚才已确认的大纲/内容修改，并生成结果
```

当前代码会经历以下步骤：

1. `explicitlyConfirmedGeneration()` 只覆盖“开始”“确认生成”“就按这个”“用这个”等固定短语，不覆盖“按你的方案来执行”。
2. 模型可能正确返回 `readyToGenerate=true`，并在 `brief.style` 中携带当前已有的 `Paper & Ink`。
3. 服务端发现本轮不匹配固定确认短语，进入 `shouldBlockGeneration`。
4. `buildRevisionConfirmationReply()` 只要看到 `brief.style`，就把回复改写为“你是想改成 Paper & Ink 方向吗”。
5. `assistant-snapshot` 覆盖前面已经流出的自然语言回复，所以用户最终只看到错误的视觉确认。

这是截图中“答非所问”的直接原因。

### 4.2 更深层的执行闭环缺陷

#### 缺陷 A：上轮修改提案没有持久化

当 Agent 返回 `nextAction=revise-content` 或 `revise-structure` 时，前端只显示回复，没有保存一份待确认的 `revision`。因此下一句“按你的方案执行”没有稳定的引用对象。

#### 缺陷 B：确认轮再次调用模型重建动作

确认本应是“消费上轮提案”的确定性动作，当前却再次让模型从文本历史中推理 brief 和 action。这样会出现：

- 忘记上轮具体修改点。
- 把当前风格误当成用户刚选择的风格。
- 把结构修改降级为普通内容修改。
- 同样一句确认在不同模型/provider 下产生不同结果。

#### 缺陷 C：`readyToGenerate` 同时承担多种含义

它目前可能表示：

- 新文稿 brief 已确认，可以开始生成大纲。
- 修改方案已确认，可以更新现有文稿。
- 风格已选择，可以生成。

这些动作需要不同输入和不同 Workflow，不能由一个 boolean 安全表达。

#### 缺陷 D：前端没有消费结构化 revision

`handleAgentSend()` 主要处理：

- `readyToGenerate && brief`
- `discover-styles`
- `more-styles`

它没有把 `revise-content / revise-structure` 转成持久化的待执行提案。确认后又调用 `startGenerationFromBrief(data.brief, message)`，其中 `message` 只是“按你的方案来执行”，不包含上轮真实修改指令。

#### 缺陷 E：结构修改没有专用 Workflow

当前 `presentationRevisionWorkflow` 只把“已批准的大纲 + revision”交给 HTML 生成步骤，适合不改变大纲的内容、样式和配色修改。

`beginRevision()` 对 `requiresOutlineReview=true` 直接返回 `false`，当前没有“修改现有大纲 -> 得到新版大纲 -> 继续生成”的结构修订 Workflow。即使确认语识别正确，结构修改也可能无法按约定执行或导致后续上下文继续使用旧大纲。

### 4.3 目标原则

1. **提案和执行分离**：Agent 可以提出修改，只有用户确认后 Workflow 才执行。
2. **确认引用稳定对象**：确认的是 `proposalId`，不是重新解析一遍自然语言历史。
3. **最新用户意图优先**：内容/大纲修改不得被当前 style 字段覆盖。
4. **一次确认只消费一次**：执行成功、失败或取消后，提案状态必须明确，不能重复启动。
5. **动作与 Workflow 一一对应**：新建、内容修改、结构修改、配色、风格发现分别走清晰分支。
6. **视觉风格默认保持**：除非用户明确要求换风格，否则修改大纲和内容不触发 style discovery，也不询问视觉方向。

---

## 5. 目标动作契约

### 5.1 用判别联合替代 `readyToGenerate`

建议将 Agent 的机器决策表达为互斥类型：

```ts
type AgentDecision =
  | { kind: "chat"; reply: string }
  | { kind: "clarify"; reply: string; missing: string[] }
  | { kind: "propose-action"; reply: string; proposal: ActionProposal }
  | { kind: "execute-proposal"; reply: string; proposalId: string }
  | { kind: "start-new-deck"; reply: string; brief: PresentationBriefData }
  | { kind: "discover-styles"; reply: string; brief: PresentationBriefData }
  | { kind: "more-styles"; reply: string; sessionId: string }
  | { kind: "select-style"; reply: string; sessionId: string; styleId: string };
```

`reply` 只负责用户沟通，`kind` 和结构化字段负责程序动作。服务端不得再从 `brief.style` 推断用户本轮是否在讨论视觉方案。

### 5.2 待执行提案

```ts
type ActionProposal = {
  proposalId: string;
  deckId: string;
  baseVersion: number;
  action: "revise-content" | "revise-structure" | "change-palette" | "change-style" | "mixed";
  instruction: string;
  targetSlides?: number[];
  requiresOutlineReview: boolean;
  briefPatch?: Partial<PresentationBriefData>;
  outlinePatch?: {
    add?: unknown[];
    update?: unknown[];
    remove?: number[];
    reorder?: number[];
  };
  userFacingSummary: string;
  status: "pending" | "executing" | "consumed" | "cancelled" | "superseded";
  createdAt: string;
};
```

最少必须保存：

- `proposalId`
- `deckId + baseVersion`
- 动作类型
- 具体修改指令
- 目标页
- 是否修改大纲
- 当前状态

这样“按你的方案来执行”才有明确、可审计、可重试的执行对象。

### 5.3 确认语义

当且仅当存在一份未过期、未被替代的 pending proposal 时，以下表达可以解释为确认：

- 按你的方案来执行
- 就按刚才的建议改
- 按上述方案生成
- 可以，执行吧
- 确认应用这些修改
- 就这样改

处理规则：

1. 有唯一 pending proposal，且用户没有补充新条件：直接返回 `execute-proposal(proposalId)`。
2. 用户说“按方案执行，但第 5 页不要改”：不是直接执行，而是更新/替代原提案，再展示新摘要。
3. 存在多份候选方案：要求用户选方案编号，不能猜。
4. 没有 pending proposal：不能凭一句“执行吧”启动未知操作，应简短询问要执行什么。
5. proposal 的 `baseVersion` 不是当前版本：拒绝执行并提示重新基于当前版本整理，避免覆盖新版本。

短期可以扩充确认正则覆盖截图语句，但长期判断必须绑定 pending proposal，不能依赖不断扩张的短语列表。

---

## 6. 目标执行流程

### 6.1 提案阶段

```text
用户提出修改
  -> Conversation Agent 理解当前 deck/outline 与最新请求
  -> 输出自然语言建议
  -> 调用声明式 proposeRevision tool
  -> 服务端校验并保存 PendingActionProposal
  -> UI 显示“方案摘要 + 按此方案执行”按钮
```

Tool 只声明动作，不直接修改 artifact。这样既能使用 Mastra Agent 的开放式理解能力，又不会让模型在未经确认时产生外部状态变化。

### 6.2 确认阶段

```text
用户点击“按此方案执行”
或输入“按你的方案来执行”
  -> 解析到唯一 pending proposal
  -> 校验 proposalId / deckId / baseVersion / status
  -> 原子地把 pending 改为 executing
  -> 启动对应 Workflow
  -> UI 立即显示“已开始应用刚才确认的修改”
```

确认轮不再重新生成 brief，不再调用 `buildRevisionConfirmationReply()`，不再从 current style 构造二次确认。

### 6.3 动作与 Workflow 的映射

| 提案动作 | 是否改大纲 | 默认视觉风格 | 执行路径 | 用户确认后的表现 |
| --- | --- | --- | --- | --- |
| `revise-content` | 否 | 保持 | 现有 revision workflow | 直接重生成目标内容/HTML |
| `change-palette` | 否 | 保持版式，仅改配色 | revision workflow | 直接生成新版本 |
| `change-style` | 否 | 使用已确认 styleId | revision workflow | 直接生成新版本 |
| `revise-structure` | 是 | 保持 | 新 outline revision workflow -> HTML workflow | 立即执行结构修改，不询问视觉方向 |
| `mixed` | 视 operations 而定 | 仅在明确要求时改变 | 编排型 workflow | 按一个 artifact version 原子发布 |
| `start-new-deck` | 新建 | 使用已选择风格或进入明确的风格选择阶段 | generation workflow | 生成大纲/文稿 |

### 6.4 结构修改的特殊处理

建议新增定义明确的 `presentationOutlineRevisionWorkflow`：

```text
current approved outline + revision spec + brief
  -> 生成新版 outline
  -> schema / 页码 / 目标页 / 结构差异校验
  -> 写入 revised outline
  -> 根据确认策略继续 HTML generation
```

确认策略建议：

- 如果上轮提案已经明确列出新增、删除、调整的页面，用户说“按方案执行”应视为对整套动作的最终确认，可在新版大纲校验通过后自动继续生成。
- 如果 Agent 只提出了方向、没有具体到页面，生成新版大纲后可进入一次“新版大纲差异确认”；此时只确认实际结构差异，不得再问视觉风格或重复确认原始意图。
- 无论是否暂停，左侧都应显示结构修改进度，右侧显示“正在应用已确认的大纲修改”，而不是再生成一轮开放式聊天回复。

### 6.5 Artifact 一致性

执行完成后必须同时更新：

- HTML / htmlUrl
- `activeArtifact.version`
- `activeArtifact.brief`
- `activeArtifact.outline`
- 已消费 proposal 的状态

当前内容 revision 可能生成了新 HTML，但仍保留旧 outline；这会让下一轮 Agent 基于过期大纲继续讨论。新方案必须保证 HTML 与 outline 属于同一 artifact version。

---

## 7. Mastra 组件边界

根据 `$mastra` 技能的核心原则：Agent 适合开放式判断，Workflow 适合定义明确、可恢复的多步骤过程。本问题建议使用以下边界：

| 组件 | 职责 | 不应承担的职责 |
| --- | --- | --- |
| Conversation Agent | 理解自然语言、引用当前大纲、提出修改方案、产出声明式 tool call | 不直接写 artifact，不在确认后重新发明方案 |
| Policy Validator | 校验 proposal、确认上下文、版本、styleId 和动作门禁 | 不生成用户可见长文案 |
| Pending Proposal Store | 保存方案与生命周期，提供唯一引用 | 不执行模型调用 |
| Outline Revision Workflow | 修改、校验并发布新版 outline | 不讨论用户是否真的想改 |
| Presentation Revision Workflow | 基于已确认 outline 和 revision 生成新 HTML | 不自行切换成 style discovery |
| UI Stream Adapter | 映射 text/reasoning/status/decision 事件 | 不用计时器伪造 reasoning |

建议使用声明式 tools，例如：

- `proposePresentationRevision`
- `requestPresentationGeneration`
- `requestStyleDiscovery`
- `selectPresentationStyle`

Tool 返回提案或动作数据，实际 Workflow 由服务端策略层在确认后启动。

---

## 8. 文件级实施范围

| 文件 | 建议调整 |
| --- | --- |
| `src/mastra/agents/presentation-brief-conversation-agent.ts` | 重构 prompt；区分 propose/execute；增加声明式 tools；禁止把非视觉修改解释成风格确认 |
| `src/app/api/agent-chat/route.ts` | 收敛状态计时器；绑定 pending proposal；删除基于 `brief.style` 的通用 revision 确认改写；输出判别联合 decision |
| `src/app/api/agent-chat/intent-routing.ts` | 短期补确认表达；长期改为“上下文 + pending proposal”确认路由与 policy validator |
| `src/types/agent-chat.ts` | 增加结构化 status、decision union、proposal/proposalId 和 cancelled 状态 |
| `src/components/presentation-studio/agent-message-model.ts` | 增加 `cancelled`、proposal 卡和稳定的 reasoning parts |
| `src/components/presentation-studio/agent-chat-ui-stream.ts` | 映射结构化 status、reasoning 生命周期、proposal 和 execute decision |
| `src/components/presentation-studio/agent-panel.tsx` | 实现思考摘要动画、状态分层、“停止”语义和方案确认卡 |
| `src/components/presentation-studio/presentation-studio.tsx` | 删除重复计时器；持久化 pending proposal；按 proposal 执行；不再用确认文本重建 revision |
| `src/types/presentation-workflow.ts` | 增加 outline revision 请求、proposal 和 artifact 一致性数据 |
| `src/mastra/workflows/presentation-revision-workflow.ts` | 保留非结构 revision；确保完成后发布同步的 artifact metadata |
| 新增 outline revision workflow | 处理结构修改、新版大纲校验及后续生成编排 |
| 测试文件 | 增加确认语义、proposal 生命周期、流状态和结构 revision 回归测试 |

---

## 9. 分阶段落地建议

### Phase 0：截图问题止血（P0，最小范围）

1. 把“模型响应较慢，可取消后重试”改为中性运行中文案。
2. 运行中按钮统一为“停止本次请求”，错误后才显示“重试”。
3. 扩充确认识别，覆盖“按你的方案来执行”“按刚才的建议改”等表达。
4. `buildRevisionConfirmationReply()` 根据 revision/action 生成文案，不得仅凭 `brief.style` 判断视觉意图。
5. 增加截图场景的 route test，确保不再回复 Paper & Ink 确认。

Phase 0 只能消除明显错误，不代表执行闭环已经可靠。

### Phase 1：思考态体验收敛（P0）

1. 删除前后端重复计时器，建立唯一 status source。
2. 用 `streamState` 驱动思考摘要动画。
3. reasoning 可用时实时展示；不可用时不伪造。
4. abort 后保留部分文本并标记 `cancelled`。
5. 补齐 reduced motion 和 aria 行为。

### Phase 2：提案确认闭环（P0）

1. 引入 `PendingActionProposal` 和 proposal 生命周期。
2. 将确认动作绑定 `proposalId + deckId + baseVersion`。
3. 用判别联合替代 `readyToGenerate` 的多义表达。
4. 前端按结构化 action 启动 Workflow，不从用户确认文本重建 revision。
5. 增加“按此方案执行”按钮，为自由文本确认提供确定性入口。

### Phase 3：结构修改 Workflow（P0）

1. 新增 outline revision workflow。
2. 支持 current outline + revision spec 生成新版 outline。
3. 对新增/删除/重排做结构 diff 和 schema 校验。
4. 明确自动继续生成与差异确认的分界。
5. 确保完成版本同步发布 brief、outline 与 HTML。

### Phase 4：观测与回归（P1）

记录：

- 首个服务端事件耗时
- 首个 reasoning delta 耗时
- 首个 text delta 耗时
- decision/proposal 产出耗时
- proposal confirm 到 workflow start 耗时
- action 命中率与被 policy 拒绝原因
- 重复确认率
- 用户主动停止率
- proposal 版本冲突率

---

## 10. 测试矩阵

### 10.1 思考与取消

| 场景 | 预期 |
| --- | --- |
| 立即收到 text delta、无 reasoning | 不显示伪造思考摘要，回答直接流式增长 |
| reasoning start -> delta -> end -> text | 思考卡先动画，结束后变为静态摘要，回答继续流式增长 |
| reasoning start 但暂时没有 delta | 显示“思考中”动画，不生成虚假步骤 |
| 8 秒无任何模型事件 | 显示“模型仍在处理”，提供停止，不提示取消后重试 |
| 回答中用户停止 | 已有文本保留，消息标记“已停止”，不继续追加 |
| 真实 90 秒超时 | 显示未执行任何修改和重试入口 |
| reduced motion | 无弹跳/流光，状态仍清晰可辨 |

### 10.2 确认与执行

| 上下文 | 用户输入 | 预期 | 禁止行为 |
| --- | --- | --- | --- |
| 唯一 pending 内容提案 | 按你的方案来执行 | 消费该 proposal，启动 content revision | 不再询问视觉风格 |
| 唯一 pending 结构提案 | 就按刚才的建议改 | 启动 outline revision | 不把确认文本当 revision instruction |
| pending Paper & Ink 文稿的内容提案 | 按方案执行 | 保持 Paper & Ink 并执行内容修改 | 不问“是否改成 Paper & Ink” |
| 唯一 pending 提案 | 按方案执行，但第 5 页别改 | 生成替代提案并重新摘要 | 不直接执行旧提案 |
| 无 pending 提案 | 执行吧 | 询问要执行的具体动作 | 不启动生成 |
| pending proposal 版本过期 | 按方案执行 | 提示基于当前版本重新整理 | 不覆盖较新 artifact |
| proposal 已 consumed | 再次确认执行 | 幂等返回已执行/当前状态 | 不重复启动 Workflow |
| 内容修改 | 执行完成 | brief、outline、HTML 版本一致 | 不保留过期 outline |

### 10.3 路由断言

必须加入以下原句回归：

- “按你的方案来执行” -> `execute-proposal`
- “按上述方案生成” -> `execute-proposal`
- “可以，就这么改” -> `execute-proposal`
- “按你的方案来执行，但不要新增页面” -> 更新 proposal，不直接执行
- “我想看看其它视觉方向” -> `discover-styles`
- “修改大纲，增加一页实战案例” -> `propose-action/revise-structure`
- “丰富第 4 页，不增加页数” -> `propose-action/revise-content`

---

## 11. 验收标准

### 问题一

- [ ] 运行中不再展示“模型响应较慢，可取消后重试”。
- [ ] 思考摘要动画只由真实 `streamState/reasoning` 驱动。
- [ ] provider 不提供 reasoning 时不伪造思考内容。
- [ ] 系统状态、思考摘要、最终回答在视觉与文案上可明确区分。
- [ ] 用户停止后保留已收到内容，并显示明确终态。
- [ ] 前后端不再维护两套重复的等待计时器。

### 问题二

- [ ] “按你的方案来执行”稳定执行唯一 pending proposal。
- [ ] 截图场景不再出现 Paper & Ink 二次确认。
- [ ] 确认后不重新生成或猜测修改指令。
- [ ] 内容/结构修改默认保持当前视觉风格。
- [ ] 结构修改进入 outline revision 分支，而不是普通 HTML revision 或 style discovery。
- [ ] proposal 与 `deckId/baseVersion` 绑定，重复确认幂等。
- [ ] 完成后 brief、outline、HTML 属于同一 artifact version。

### 端到端验收脚本

1. 创建并生成一份使用 Paper & Ink 的演示文稿。
2. 告诉 Agent：“在大纲中增加一页 Mastra Workflow 实战，并补充 Agent 与 Workflow 的选择原则。”
3. Agent 输出具体修改方案，并形成 pending proposal。
4. 输入：“按你的方案来执行。”
5. UI 立即显示“正在应用刚才确认的大纲修改”，进入结构修改流程。
6. 全程不得再次询问 Paper & Ink 或其它视觉方向。
7. 生成完成后检查新版大纲包含新增内容，HTML 页数与大纲一致，风格保持 Paper & Ink。
8. 再输入“按你的方案来执行”，验证不会重复生成同一版本。

---

## 12. 非目标与边界

- 不展示或推测模型隐藏的完整 chain-of-thought；只展示 provider 明确提供、允许呈现的 reasoning summary。
- 不因为模型思考时间长就自动取消并重试，以免产生重复请求和额外费用。
- 不把所有自然语言确认都做成无条件本地正则；确认必须有可引用的 pending proposal。
- 不允许 Conversation Agent 绕过服务端 policy 直接发布 artifact。
- 本方案不调整 frontend-slides 的视觉生成质量，仅确保风格选择不会干扰内容/结构修改意图。

---

## 13. 最终建议

实施时不要把两个问题拆成“改一句文案”和“补一个确认关键词”。推荐的 P0 主线是：

```text
真实流状态 -> 清晰的思考/回答 UI
Agent 提案 -> 持久化 proposal -> 用户确认 proposalId -> Workflow 执行 -> 同版本 artifact 发布
```

这一闭环完成后，用户看到的状态与系统真实行为才能一致：思考时明确知道仍在处理，确认时明确知道正在执行哪一个方案，完成后得到的内容、大纲和视觉结果也来自同一次已确认动作。
