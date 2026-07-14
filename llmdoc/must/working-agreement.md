# Working Agreement

## Docs 优先级与免责声明
- `docs/` 下 11 篇历史需求/技术方案文档按时间顺序描述功能演进意图，**不代表当前代码状态**。理解某功能"为什么这样设计"可以参考，但判断"现在代码是什么样"必须读源码或 llmdoc 的 architecture/reference 文档。
- 本次 llmdoc 初始化时，`docs/10`、`docs/11`（近期 UX 改造：真实流式回复、意图路由修复、思考态反馈、提案确认闭环）经核对已基本落地在当前代码中（详见 `llmdoc/architecture/request-lifecycle-and-workflows.md`），但更早期文档未逐一核验。

## 关键代码/命名陷阱（已踩过的坑）
- **`presentation-artifacts/artifact-store.ts` 只是内存元数据存储**（deckId/version/brief/outline/html 引用），不负责磁盘落盘。真正的磁盘写入与 URL 解析在 `src/utils/save-html-to-file.ts`，命名上容易搞混，改动生成落盘逻辑时认准这个文件。
- **`agent-chat/intent-routing.ts` 名不副实**：它只做"决策 → AgentActionProposal"的确定性结构转换（校验字段、组装对象），不做意图判断。意图分类完全交给 `presentationBriefConversationAgent` 的 structured output，服务端**不做关键字/正则兜底意图**。改动意图相关逻辑，应先看 agent instructions，而不是先找服务端 if/else。
- **`presentationBriefConversationAgent` 从不进入任何 workflow**，只被 `/api/agent-chat` 使用，负责"对话 + 意图分类 + proposal 生成"；实际生成/修订工作由 `/api/analyze` 驱动的 workflow 完成。
- **`frontend-slides-style-discovery-workflow` 无 LLM**：纯 regex + 预设目录选择，返回静态 SVG 预览路径。workflow/服务描述文案写的是"生成预览"，但实现是确定性挑选，别被文案误导。
- **两个 revision workflow 是主 workflow step 的重组复用**，不是独立实现：`presentationRevisionWorkflow` 只跑 HTML step；`presentationOutlineRevisionWorkflow` 跑两步但用 `autoApproveOutline:true` 绕过 suspend。改主流程的 outline/HTML step 逻辑时，要意识到会同时影响这两个 revision workflow。

## 协作约定
- 涉及 workflow 编排、agent instructions、proposal/artifact 状态机、frontend-slides 校验规则的改动前，先读 `llmdoc/architecture/` 对应文档，避免在耦合点上引入不一致（例如 suspend/resume 的 step id 硬编码、版本乐观锁字段）。
- 完成非小改动后，跑 `pnpm test` 与 `pnpm lint`（本仓库无 CI，这是唯一的质量门）。
- 修改 `.claude/skills/frontend-slides/` 契约文本时，必须同步核对 `src/services/frontend-slides/html-validator.ts` 的断言是否仍与契约一致（两者是"约束模型的文本 + 校验实现"的对应关系）。

## Related Docs
- `llmdoc/must/doc-routing.md`：按任务类型路由到具体文档。
- `llmdoc/memory/doc-gaps.md`：已知未核实的细节。
