# Doc Routing

## Read Next By Task
- 改动 `/api/analyze`、主 workflow（大纲 suspend/resume）、两个 revision workflow、frontend-slides HTML 生成/校验/落盘：先读 `llmdoc/architecture/request-lifecycle-and-workflows.md`，再读 `llmdoc/architecture/frontend-slides-contract.md`。
- 改动 `.claude/skills/frontend-slides/` 契约文本、`html-validator.ts`、`prompt-builder.ts`、`save-html-to-file.ts`、`GENERATED_SLIDES_DIR`/Vercel 落盘路径：先读 `llmdoc/architecture/frontend-slides-contract.md`。
- 改动 `/api/agent-chat`、`intent-routing.ts`、`proposal-store`、`presentationBriefConversationAgent` instructions、提案确认/取消流程：读 `llmdoc/architecture/request-lifecycle-and-workflows.md` 的 agent-chat 提案生命周期部分。
- 改动 `presentation-studio.tsx` 及其辅助模块、`use-presentation-workflow.ts`、双通道流式消费：读 `llmdoc/architecture/request-lifecycle-and-workflows.md` 里"两条链路"的描述（本轮未单独成文，细节在调查报告，见 gap 记录）。
- 新增/修改 API 端点、目录结构、环境变量：读 `llmdoc/overview/project-overview.md`。
- 测试策略、lint、CI 现状：见 `llmdoc/overview/project-overview.md`「质量信号」一节。
- 遇到重复出现的坑或误解：先看 `llmdoc/memory/doc-gaps.md` 和 `llmdoc/must/working-agreement.md` 的"关键代码/命名陷阱"。

## Escalation Hints
- 想知道"为什么这样设计" → 先查 `docs/`（历史意图），再核对 llmdoc architecture 文档是否已反映为当前实现。
- 想知道"现在代码到底是什么样" → 只信 llmdoc architecture/reference 文档或直接读源码，不要只信 `docs/`。
- 想找具体文件职责、schema 字段、状态机转移规则等硬事实 → 优先 `llmdoc/architecture/`（本项目暂未单独拆 `reference/`，硬事实内嵌在对应 architecture 文档中）。
