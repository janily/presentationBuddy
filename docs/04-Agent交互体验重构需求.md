# Agent 交互体验重构需求文档

**文档版本**: v1.0
**优先级**: P1（高）
**预估工期**: 5-7 天
**负责人**: 前端开发 + 产品设计

---

## 一、问题描述

### 1.1 现状截图分析

根据产品负责人提供的三张截图（uii3.png / uii4.png / uii5.png），右侧 Agent 区域存在严重的信息架构与交互问题。

#### 截图一（uii3.png）：初始对话阶段

**观察到的问题**：
1. Agent 回复的消息气泡被截断，顶部被遮挡（可见半截的橙色按钮"确认"）
2. "正在思考…" 的 loading 气泡孤零零地悬浮，与上下文脱节
3. 用户的回复"默认"以气泡形式出现在右侧，但与 Agent 的提问在视觉上没有对应关系
4. 快捷提示按钮（"帮我做一份融资路演"等）在对话已经开始后仍然显示，与当前上下文无关
5. 输入框的 placeholder 文案过长，像正文而不是提示

#### 截图二（uii4.png）：生成进行中阶段

**观察到的问题**：
1. **信息重复**：左下角有一个进度条（"Generating your HTML presentation..."），右侧 Agent 区域又有一个完全相同的进度卡片，同一状态出现两次
2. **区块堆叠混乱**：右侧从上到下依次是"AGENT MESSAGE 进度卡" → "Agent is working 卡片" → 对话历史（被压缩得只剩两行）→ 快捷按钮 → 输入框 → "Advanced outline editing" 折叠区，共 6 个视觉区块挤在一列中
3. 对话历史区域被挤压到只能看到 2-3 行，用户无法回顾之前的对话
4. "默认" 用户气泡与消息内容重叠错位
5. 快捷提示按钮（"增加案例页"等）在生成进行中仍可点击，但此时点击会重启草稿，存在误操作风险且无警示

#### 截图三（uii5.png）：预览阶段

**观察到的问题**：
1. "Keep refining this deck" 标题条与 "Advanced outline editing" 折叠区、"Slide outline" 编辑区堆叠，层次不清
2. Slide outline 区域内显示的是原始大纲长文本（截断的中文段落），可读性极差
3. "Generate HTML presentation (8 slides)" 大按钮出现在预览已经生成之后，用户困惑：是重新生成还是继续？
4. 对话输入区完全消失，用户无法继续用自然语言迭代——与 "Keep refining this deck" 的标题自相矛盾

### 1.2 问题本质（第一性原理分析）

| 表面现象 | 本质问题 |
|---------|---------|
| 区块堆叠、信息重复 | **没有单一信息源（Single Source of Truth）的展示策略**：同一状态在多处渲染 |
| 对话历史被挤压 | **没有明确"对话是主轴"的定位**：对话流被各种卡片插队 |
| 按钮/入口与阶段错位 | **UI 是静态拼盘而非状态机驱动**：所有区块常驻，只靠条件显隐微调 |
| 用户不知道下一步做什么 | **缺少焦点管理**：每个阶段没有唯一的"主行动（Primary Action）" |

### 1.3 业界标杆对齐

| 产品 | 值得对齐的范式 |
|------|--------------|
| **Gamma.app** | 对话流是唯一主轴；系统状态（生成中/完成）以内联卡片插入对话流，而不是独立区块 |
| **ChatGPT / Claude** | 生成中状态直接显示在对话气泡位置；历史永远可滚动回顾 |
| **Vercel v0** | 左侧预览 + 右侧对话，右侧只有对话，无其他杂项区块 |
| **Cursor** | 阶段性操作（Apply/Reject）以按钮内联在对话消息底部，而非独立面板 |

**结论**：右侧 Agent 区域应重构为**纯对话流驱动**的界面，所有状态、进度、操作按钮都作为消息卡片内联进对话流。

---

## 二、目标设计

### 2.1 核心设计原则

1. **对话流是唯一主轴**：右侧面板 = 消息列表 + 输入框，没有第三种常驻区块
2. **状态内联化**：进度、大纲预览、错误、操作按钮全部以"消息卡片"形式出现在对话流中
3. **每个阶段唯一主行动**：任意时刻界面上最醒目的按钮有且只有一个
4. **进度只显示一处**：左侧预览区显示全局进度，右侧对话流中只显示简短状态文本
5. **快捷提示随阶段切换**：只显示当前阶段有意义的快捷操作

### 2.2 目标信息架构

```
右侧 Agent 面板（自上而下）：
┌─────────────────────────────┐
│ Header：Agent 标题 + 阶段徽章  │  ← 固定，显示当前阶段（需求澄清/大纲确认/生成中/迭代）
├─────────────────────────────┤
│                             │
│  消息流（flex-1, 可滚动）      │  ← 唯一内容区
│   ├─ 用户消息气泡             │
│   ├─ Agent 消息气泡           │
│   ├─ [内联卡片] 大纲确认卡     │  ← 含"生成演示文稿"主按钮 + "展开编辑"次入口
│   ├─ [内联卡片] 生成进度卡     │  ← 简短一行状态 + 细进度条
│   ├─ [内联卡片] 完成卡         │  ← "已生成 8 页" + 下载/继续修改入口
│   └─ [内联卡片] 错误卡         │  ← 错误说明 + 唯一重试按钮
│                             │
├─────────────────────────────┤
│ 快捷提示（随阶段变化，单行）    │  ← 生成中阶段隐藏或禁用
│ 输入框 + 发送按钮             │  ← 始终可见，生成中显示"生成中仍可补充要求"
└─────────────────────────────┘
```

### 2.3 阶段状态机定义

UI 必须由显式状态机驱动，而非零散的条件判断：

```
阶段（Phase）：
  briefing    需求澄清中（对话收集 topic/audience/pageCount/style）
  outlining   大纲生成中（流式输出大纲）
  reviewing   大纲待确认（等待用户点击生成或继续修改）
  generating  HTML 生成中
  previewing  预览就绪（可继续迭代）
  error       出错（附带来源阶段，决定重试行为）
```

**各阶段的 UI 契约**：

| 阶段 | 主行动（唯一醒目按钮） | 快捷提示 | 输入框状态 |
|------|---------------------|---------|-----------|
| briefing | 无（引导用户输入） | "融资路演" / "产品发布会" 等模板 | 可用 |
| outlining | 无（显示流式大纲卡） | 隐藏 | 可用（提示：可随时补充要求） |
| reviewing | **生成演示文稿（N 页）** | "增加案例页" / "调整风格" | 可用 |
| generating | 无（进度卡不可操作） | 隐藏 | 可用（提示：新要求将在本轮完成后生效或重新生成） |
| previewing | 无（完成卡含下载次按钮） | "调整风格" / "删掉第 N 页" | 可用 |
| error | **重试** | 隐藏 | 可用 |

---

## 三、详细实施步骤

### 步骤 1：建立统一的阶段状态机

**修改文件**：`src/components/presentation-studio/presentation-studio.tsx`

当前 `currentStep` 的推导逻辑分散且含糊（`brief/outlining/review/generating/preview`），需要：

1. 新建 `src/components/presentation-studio/use-studio-phase.ts`，集中推导阶段：

```typescript
export type StudioPhase =
  | "briefing"
  | "outlining"
  | "reviewing"
  | "generating"
  | "previewing"
  | "error";

export interface StudioPhaseState {
  phase: StudioPhase;
  errorSource?: "outline" | "html" | "resume";
  errorMessage?: string;
}
```

2. 推导规则（优先级从高到低）：
   - 存在 workflowError → `error`（携带来源）
   - htmlGenerationStep 完成且有 HTML → `previewing`
   - htmlGenerationStep 进行中 → `generating`
   - 大纲已就绪且等待确认（suspenseData 存在）→ `reviewing`
   - outline 流式输出中 → `outlining`
   - 其余 → `briefing`

3. `presentation-studio.tsx` 中所有 UI 分支只依赖这个 phase，删除散落的 `currentStep` 判断。

### 步骤 2：消息流统一化——把所有卡片收进对话流

**修改文件**：`src/components/presentation-studio/agent-panel.tsx`

1. 扩展消息类型，支持内联卡片：

```typescript
export type AgentMessage =
  | { id: string; role: "user" | "assistant"; kind: "text"; content: string }
  | { id: string; role: "system"; kind: "outline-review"; slideCount: number }
  | { id: string; role: "system"; kind: "progress"; message: string; progress: number }
  | { id: string; role: "system"; kind: "complete"; slideCount: number; htmlUrl?: string }
  | { id: string; role: "system"; kind: "error"; message: string; retryKind: "outline" | "html" | "resume" };
```

2. 在消息渲染中按 `kind` 分发到对应卡片组件：
   - `OutlineReviewCard`：显示"大纲已就绪（N 页）" + 主按钮"生成演示文稿" + 次链接"展开编辑大纲"
   - `ProgressCard`：一行状态文本 + 细进度条（高度 4px），**不可交互**
   - `CompleteCard`：完成提示 + "下载 HTML" 次按钮 + 引导文案"继续告诉我要怎么改"
   - `ErrorCard`：错误说明 + 唯一"重试"按钮

3. **删除** `presentation-studio.tsx` 中独立于 AgentPanel 之外的以下区块（它们的职责移入消息流）：
   - 独立的 workflowError 红色 section（335-344 行附近）
   - 独立的 "Agent message / Generating..." 进度 section
   - 独立的 "我已准备好大纲，要生成预览吗？" section

### 步骤 3：进度显示去重

**原则**：全局进度显示在左侧预览区（保留现有底部进度条），右侧对话流中的 ProgressCard 只显示简短状态。

**修改内容**：
1. 右侧 ProgressCard 文案规范：`正在生成演示文稿（3/8 页）…` 或 `正在应用视觉样式…`，单行，不显示百分比大进度条
2. 左侧预览区保留完整进度条 + 阶段文案
3. 同一 workflow 事件只驱动这两处，删除其他进度渲染点

### 步骤 4：快捷提示与输入框的阶段化

**修改文件**：`src/components/presentation-studio/agent-panel.tsx`

1. `quickPrompts` 改为由 phase 派生（见 2.3 表格），`generating` 与 `error` 阶段传空数组并隐藏该行
2. 输入框 placeholder 缩短至一句话以内：
   - briefing: `描述你想做的演示文稿…`
   - reviewing: `想调整大纲？直接说…`
   - generating: `生成中，可先补充新要求…`
   - previewing: `告诉我要怎么改这份 deck…`
3. helperText 移除（信息并入 placeholder），减少一层视觉噪音
4. 修复对话滚动：新消息到达时若用户未主动上滚，自动滚底；用户上滚查看历史时不强制拉回（记录 `isPinnedToBottom` 状态）

### 步骤 5：Advanced outline editing 收纳

**问题**：大纲编辑区常驻在对话面板底部，挤压对话空间，且在 previewing 阶段显示原始长文本。

**方案**：
1. 从右侧面板中移除常驻的 "Advanced outline editing" 折叠区
2. 大纲编辑入口收进 `OutlineReviewCard` 的次链接"展开编辑大纲"
3. 点击后以 **抽屉（Drawer）或 Modal** 形式打开 OutlinePanel，编辑完成后关闭回到对话流
4. previewing 阶段不再显示 slide outline 原文；如需查看结构，入口为完成卡上的"查看大纲"链接

### 步骤 6：修复消息气泡视觉问题

**修改文件**：`agent-panel.tsx` 样式部分

1. 修复截图一中气泡被顶部裁切的问题：检查消息容器的 `overflow` 与首条消息的 margin，确保 `scrollTo` 不会把首条消息滚出可视区
2. 用户气泡与 Agent 气泡宽度上限统一为 85%，间距 12px
3. "正在思考…" loading 气泡替换为三点跳动动画，紧贴上一条消息
4. Agent 长消息（如需求澄清的多个问题）内部使用列表排版，行高 1.6

### 步骤 7：生成中输入的行为定义

**问题**：当前生成中发送新消息会静默重启草稿（截图二 "new requirements restart the draft"），反直觉且有数据丢失风险。

**方案（必须实现）**：
1. generating 阶段用户发送消息时，**不立即重启**，而是在对话流插入确认卡：
   > 当前正在生成中。你的新要求是「…」。
   > [ 完成后应用 ] [ 停止并重新生成 ]
2. 选"完成后应用"：暂存该消息，生成完成进入 previewing 后自动作为迭代请求发送
3. 选"停止并重新生成"：调用 `stop()` 后带新上下文重启 workflow

---

## 四、验收标准

### 4.1 结构性验收
- [ ] 右侧面板只有：Header + 消息流 + 快捷提示行 + 输入框，无其他常驻区块
- [ ] 同一时刻进度信息在右侧只出现一处（对话流内联卡）
- [ ] 任意阶段界面上醒目主按钮 ≤ 1 个
- [ ] 大纲编辑通过抽屉/Modal 打开，不常驻

### 4.2 交互验收
- [ ] 对话历史任何阶段都可完整滚动回顾
- [ ] 新消息自动滚底；用户上滚时不被强制拉回
- [ ] 生成中发送新消息触发确认卡，不静默重启
- [ ] 每个阶段快捷提示与该阶段语义匹配
- [ ] 错误卡提供唯一明确的重试路径

### 4.3 视觉验收
- [ ] 无气泡截断/重叠（对照截图一、二逐项复核）
- [ ] previewing 阶段不出现原始大纲长文本
- [ ] Loading 状态使用统一的三点动画

### 4.4 回归验收
- [ ] 完整跑通：需求对话 → 大纲确认 → 生成 → 预览 → 迭代修改 全流程
- [ ] `pnpm test` 全部通过
- [ ] 现有 workflow API（`use-presentation-workflow.ts`）契约不变

---

## 五、实施顺序与工期建议

| 顺序 | 任务 | 预估 |
|------|------|------|
| 1 | 步骤 1：阶段状态机 | 0.5 天 |
| 2 | 步骤 2：消息流统一化（核心重构） | 2 天 |
| 3 | 步骤 3 + 4：进度去重、快捷提示阶段化 | 1 天 |
| 4 | 步骤 5：大纲编辑收纳为抽屉 | 1 天 |
| 5 | 步骤 6：气泡视觉修复 | 0.5 天 |
| 6 | 步骤 7：生成中输入行为 | 1 天 |
| 7 | 联调 + 验收清单逐项核对 | 1 天 |

**注意**：步骤 2 是其余步骤的地基，必须最先完成并单独提交一次 code review。

---

## 六、交付物

1. **代码**：
   - `src/components/presentation-studio/use-studio-phase.ts`（新增）
   - `src/components/presentation-studio/agent-panel.tsx`（重构）
   - `src/components/presentation-studio/presentation-studio.tsx`（精简）
   - 内联卡片组件（OutlineReviewCard / ProgressCard / CompleteCard / ErrorCard）
   - 大纲编辑抽屉组件
2. **测试**：阶段状态机推导的单元测试（覆盖 2.3 表格全部阶段转换）
3. **验收记录**：按第四章清单逐项截图核对
4. **文档**：完成后使用 recorder/docer agent 更新 llmdoc 文档系统

---

**至此四份需求文档全部交付完毕。实习生请按 01 → 02 → 03 → 04 顺序阅读，按优先级 P0 → P1 实施。**
