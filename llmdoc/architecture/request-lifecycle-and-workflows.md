# Architecture of Request Lifecycle and Workflows

## Purpose
- 这是系统里最深、最容易出错的耦合点：一个两步 Mastra workflow（含 suspend/resume）、两个 revision workflow 变体（复用同样的 step）、一个无 LLM 的风格发现 workflow，以及 `/api/agent-chat` 的提案生命周期如何驱动其中的 revise 分支。
- 记录这条链路是为了让后续改动者不在 step id 硬编码、版本乐观锁、`autoApproveOutline` 绕过 suspend 等耦合点上引入不一致。

## Core Components
- `src/mastra/index.ts`（`createMastra`）：Mastra 单例，注册 3 个 agent + 4 个 workflow，`storage: LibSQLStore({url:":memory:"})`（进程内、非持久化）。用 `globalThis.__presentationBuddyMastra` 缓存避免 Next dev 热重载重复注册。
- `src/mastra/workflows/presentation-generation-workflow.ts`：主 workflow，导出两个共享 step（`presentationOutlineSuggestionStep`、`presentationHtmlGenerationStep`），被其余两个 revision workflow 复用。
- `src/mastra/workflows/presentation-revision-workflow.ts`：单步（只跑 HTML step），无 suspend，用于"大纲不变、只改 HTML/配色"。
- `src/mastra/workflows/presentation-outline-revision-workflow.ts`：两步，但 `autoApproveOutline` 字面量锁定为 `true`，绕过 suspend，用于"结构性修改需要重跑大纲"。
- `src/mastra/workflows/frontend-slides-style-discovery-workflow.ts`：单步，**无 LLM**，regex + purpose 分支从固定预设目录选 3 个风格，返回静态 SVG 预览路径（`src/services/frontend-slides/style-catalog.ts` 的 `discoverFrontendSlideStyles`）。
- `src/app/api/analyze/route.ts`：主 workflow 入口，三分支（start/resume/revise）。
- `src/app/api/analyze/revision-workflow-plan.ts`（`buildRevisionWorkflowPlan`）：决定 revise 请求走哪个 revision workflow。
- `src/app/api/agent-chat/route.ts`：对话/意图分类入口，产出决策与（可选）提案。
- `src/app/api/agent-chat/intent-routing.ts`（`createActionProposal`）：把决策转成可持久化提案的**纯结构转换**（不做意图判断，命名易误导）。
- `src/services/agent-proposals/proposal-store.ts`：进程内提案状态机。
- `src/services/presentation-artifacts/artifact-store.ts`：进程内 deck 版本元数据（乐观锁 `baseVersion`/`targetVersion`）。
- `src/mastra/agents/presentation-brief-conversation-agent.ts`：意图分类的**唯一真相源**（structured output `briefDecisionSchema`），从不进入任何 workflow，只被 `/api/agent-chat` 调用。

## Flow

### 1. 主 workflow：两步 + suspend/resume
- Step 1 `presentation-outline-suggestion-step`：调用 `presentationOutlineSuggestionAgent` 生成大纲（流式，边生成边推 `data-presentationOutline` 进度）。
  - 若 `inputData.autoApproveOutline` 为真 → 跳过审阅，直接返回带 outline 的结果。
  - 否则 `await suspend({ reason, suggestedOutline })` 挂起，等待外部 resume。
  - resume 时若 `resumeData.approvedOutline` 已存在 → 走快速路径直接返回，不重新生成。
- Step 2 `presentation-html-generation-step`：`mapOutlineToFrontendSlides` 转换 → 加载 frontend-slides 契约 → `frontendSlidesComposerAgent.stream(...)` 生成 HTML → 校验（`assertFrontendSlidesDocument`）失败则用 repair prompt **重试一次**，仍失败直接抛错（**无备用生成器**）。校验通过后 `saveHtmlToFile` 落盘；若 `inputData.artifact` 存在，还会推进 proposal/artifact 状态（见第 3 节）。

### 2. `/api/analyze` 三分支
- **start**：`createRunAsync()` → `run.stream({ inputData })`，走主 workflow，先写 `data-workflowRunId`，再 merge `toAISdkFormat(fullStream)`。
- **resume**：取 `workflowRunId` + `approvedOutline` → `createRunAsync({ runId: workflowRunId })` → `run.resumeStream({ step: "presentation-outline-suggestion-step", resumeData: { approvedOutline } })`。**step id 是硬编码字符串**，改 step 定义时必须同步这里。
- **revise**：先校验 `artifact.baseVersion` 是否等于 `getPresentationArtifact(deckId).version`，不等则 409 `artifact_version_conflict`（乐观锁）。再 `buildRevisionWorkflowPlan` 分流：
  - `revision.requiresOutlineReview === true` → `workflowKind: "outline-revision"`，input 带 `autoApproveOutline: true` + `outlineRevisionContext`，跑 `presentationOutlineRevisionWorkflow`。
  - 否则 → `workflowKind: "html-revision"`，input 带既有 `outline`，跑 `presentationRevisionWorkflow`。
  两者都用 `run.stream(...)`，无 suspend，端到端同步执行到完成或报错。

### 3. `/api/agent-chat` 提案生命周期如何驱动 revise
1. 已生成 deck 后用户提修改 → `presentationBriefConversationAgent`（单趟 Mastra run，同时流式 `reply` 与产出 `briefDecisionSchema`）判定 `nextAction ∈ {revise-content, revise-structure, change-palette}`。
2. `createActionProposal(decision, context)`（`intent-routing.ts`）：仅当 `nextAction` 属于上述三者且 `revision.instruction` 非空才产出 `AgentActionProposal`；否则返回 `null`（chat/discover-styles/generate 等不产生提案）。
3. `saveAgentProposal`（`proposal-store.ts`）：保存前把同 `deckId` 下所有 `pending` 提案标记为 `superseded`——**单活跃提案约束**，防止历史提案被误确认。
4. 用户确认后模型返回 `nextAction: "execute-proposal"` → `resolveProposalExecution`（`agent-chat/route.ts`）做**确定性结构门禁**（不猜意图）：校验提案存在/属于本 deck/`baseVersion` 匹配/状态为 `pending`；已 `executing`/`consumed` 则幂等去重。全部通过后 `beginProposalExecution` 置 `executing` 并生成 `executionId`。
5. `data-agentDecision` 把 `nextAction: "execute-proposal"` + `revision`（`requiresOutlineReview`/`instruction`/`targetSlides`）+ `executeProposalId` 推给前端，前端据此发起 `/api/analyze` 的 **revise** 请求（agent-chat 自身不调用 revision workflow）。
6. workflow 完成写 artifact 前后：`assertProposalExecution`（校验 `executionId` 匹配，防过期执行写回）+ `markProposalConsumed`（终态收尾）——把提案终态与 artifact 版本推进绑定。
7. 中途取消/恢复：`POST /api/agent-chat/proposal-status`，discriminated union `cancelled`（`markProposalCancelled`）或 `executing`（`resumeProposalExecution`，仅允许从 `cancelled`/`executing` 复活）。

### 4. 状态机与双令牌乐观锁
- Proposal 状态：`pending → executing → consumed/cancelled`，另有 `superseded`（被新提案顶替）。
- 双令牌：`deckId + baseVersion` 是跨请求版本乐观锁；`executionId`（`crypto.randomUUID()`）是单次执行的幂等/防串写令牌。两者配合 `assertProposalExecution` 防止过期执行写回已推进的 artifact。

## Invariants
- Step 1 的 suspend/resume 依赖硬编码 step id `presentation-outline-suggestion-step`，主 workflow 与 `/api/analyze` resume 分支必须保持一致。
- HTML 生成阶段无备用生成器；只有一次 repair 重试，失败即整步报错，前端需处理该失败态。
- `requiresOutlineReview` 是唯一决定 revise 走哪个 workflow（outline-revision vs html-revision）的开关，该字段由 `presentationBriefConversationAgent` 在 `briefDecisionSchema.revision` 中给出，经 proposal 持久化后带到 `/api/analyze`。
- 意图分类完全在 agent instructions 里，服务端不做关键字/正则兜底；代码侧仅有两处确定性门禁：`shouldRequireInitialStyle`（新 deck 未选风格强制先风格发现）与 `resolveProposalExecution`（执行提案的结构校验）。
- `artifact-store`、`proposal-store`、Mastra `LibSQLStore(":memory:")` 均是进程内内存单例（`globalThis` 缓存），只适合单实例部署；多实例/无状态部署下三者都会不一致或丢失。
- `frontend-slides-style-discovery-workflow` 无 LLM，是确定性目录选择；其 description 文案写"生成预览"具有误导性。

## Related Docs
- `llmdoc/architecture/frontend-slides-contract.md`：Step 2 HTML 生成的契约细节、校验规则、落盘路径解析。
- `llmdoc/must/project-basics.md`：端点表与关键运行时事实速查。
- `llmdoc/memory/doc-gaps.md`：本文档未完全核实的细节（如前端如何消费 `data-agentDecision` 发起后续请求）。
