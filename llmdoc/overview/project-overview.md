# Project Overview

## Identity
- Presentation Buddy 是一个 Next.js 16 + Mastra 应用，把一段自然语言演示简报（brief）变成一份可在浏览器直接打开的、自包含的 HTML 幻灯片（1920x1080 固定舞台）。
- 用户交互路径：对话式简报收集/意图分类（`/api/agent-chat`）→ 大纲生成与人工审阅（`/api/analyze` 的 workflow，含 suspend/resume）→ HTML 生成 →（可选）内容/结构/配色修订循环。
- 唯一 UI 入口是 `/`（`src/app/page.tsx` → `PresentationStudio`），单页应用，没有多路由。

## Boundaries
- 属于本项目：Next.js App Router 前端与 API 路由、Mastra agents/workflows 编排、frontend-slides HTML 生成契约与校验、进程内 artifact/proposal 状态管理、模型 provider 抽象。
- 不属于本项目（或当前未实现）：
  - 持久化存储——`artifact-store`、`agent-proposals/proposal-store`、Mastra 的 `LibSQLStore(":memory:")` 均是进程内内存单例，重启/多实例即丢失或不一致。
  - 用户上传（`src/app/api/upload/` 目录存在但为空，非存活功能）。
  - `.claude/skills/frontend-slides/` 契约中描述的交互式 Phase 0-6 流程、`bold-template-pack/`、`scripts/extract-pptx.py` 等 Claude Agent CLI 场景资源——这些文件在当前 checkout 不存在，服务器端 Mastra 路径只把 skill 文档当"文本契约"注入 prompt，不执行这些脚本化交互。
  - CI（无 `.github/` 等配置），质量把关仅靠本地 `pnpm test` / `pnpm lint`。

## Major Areas
- **对话与意图层**（`src/app/api/agent-chat/`、`src/mastra/agents/presentation-brief-conversation-agent.ts`）：模型是意图分类的唯一真相源，产出结构化决策与可选的修订提案（`AgentActionProposal`）。
- **生成工作流层**（`src/mastra/workflows/`、`src/app/api/analyze/route.ts`）：Mastra 两步主 workflow（大纲 suspend/resume → HTML 生成）+ 两个 revision workflow 变体（复用主 workflow 的 step）+ 一个无 LLM 的风格发现 workflow。
- **frontend-slides 生成契约**（`.claude/skills/frontend-slides/`、`src/services/frontend-slides/`）：唯一的 HTML 生成来源，固定舞台/无 reflow 等强规则，契约文本与运行时校验（`html-validator.ts`）一一对应。
- **状态存储层**（`src/services/presentation-artifacts/`、`src/services/agent-proposals/`、`src/utils/save-html-to-file.ts`）：deck 版本元数据（内存）、提案生命周期（内存）、生成 HTML 的实际磁盘落盘（三分支路径解析）。
- **前端编排层**（`src/components/presentation-studio/`、`src/hooks/use-presentation-workflow.ts`）：双通道消费——workflow 流走 AI SDK `useChat`，agent-chat 流走手写 SSE reader；`presentation-studio.tsx` 是唯一的编排/黏合组件。

## Related Docs
- `llmdoc/architecture/request-lifecycle-and-workflows.md`：请求/工作流全链路，包含 suspend/resume、revision 分流、proposal 生命周期如何驱动修订。
- `llmdoc/architecture/frontend-slides-contract.md`：frontend-slides 生成与落盘契约。
- `llmdoc/must/project-basics.md`：高频启动事实（端点表、单例陷阱、测试现状）。
