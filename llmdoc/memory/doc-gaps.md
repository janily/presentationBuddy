# Documentation Gaps

本次 `/llmdoc:init`（f8e46c0）基于 7 份调查报告的静态源码阅读产出，未运行任何测试/构建来验证行为。以下是已知未核实或未深入的部分。

## Open Gaps

### 验证类
- 未实际运行 `pnpm test` / `pnpm lint`，无法确认 23 个 vitest 测试文件当前是否全绿、有无跳过项；`tests-and-quality-signals` 报告仅基于文件名与用例计数推断覆盖范围，未逐行阅读测试实现（尤其 `agent-chat/route.test.ts`、workflow 测试的 mock 边界未核实）。
- 未运行任何 workflow/agent 的实际调用，agent instructions 里描述的意图分类规则（如"内容丰富 vs 风格模糊需求"的分类边界）是运行时模型行为，静态阅读无法验证真实准确率。

### Workflow / 请求链路
- `presentation-generation-schemas.ts` 中 `revisionSpecSchema`/`artifactOperationSchema`/`presentationInputSchema`/`presentationOutlineSchema` 的完整字段定义未逐一阅读，`request-lifecycle-and-workflows.md` 中相关描述基于调用侧用法推断。
- `applyPaletteRevision`（`src/services/frontend-slides/palette-revision.ts`）、`style-schema.ts` 内部实现未读，仅知其输入输出契约。
- 前端如何把 `/api/agent-chat` 的 `data-agentDecision`（尤其 `nextAction: "discover-styles"`/`"execute-proposal"`）翻译成对 `/api/style-discovery` 与 `/api/analyze`（revise）的具体请求，客户端编排细节（`presentation-studio.tsx` 内 `sendToAgentChat` 之后的分支逻辑）未逐行核实，仅从组件清单与数据流大致推断。
- `src/types/agent-chat.ts` 中 `AgentActionProposal` 的完整字段列表未在本轮重新核对，以 `proposal-store.ts` 与 `intent-routing.ts` 的实际用法为准。

### frontend-slides 契约
- `.claude/skills/frontend-slides/{html-template.md, viewport-base.css, animation-patterns.md, STYLE_PRESETS.md}` 未逐字全文阅读，`frontend-slides-contract.md` 中的描述基于 `SKILL.md` 引用 + `html-validator.ts` 断言反推。
- `bold-template-pack/` 与 `scripts/`（`extract-pptx.py`、`deploy.sh`、`export-pdf.sh`）在当前 checkout 中缺失，未确认这是"应由构建/子模块生成"还是"仅服务交互式 Claude Agent CLI 场景、服务器端本就不需要"，本文档暂按后者记录，需在有新信息时复核。
- `skills-lock.json` 记录的 `mastra` 技能哈希未重新计算校验是否与本地 `SKILL.md` 一致。

### UI / 前端状态管理
- 未成文一篇独立的"UI 双通道消费模式"架构文档（原计划的第三候选文档），仅在 `request-lifecycle-and-workflows.md` 与 `must/doc-routing.md` 中简要提及。`presentation-studio.tsx`（~1100 行、20+ useState）承载的完整状态清单、`deriveStudioPhase` 六态机、`agent-chat-ui-stream.ts` 的 chunk 分发细节仍只在原始调查报告（`ui-and-agent-chat.md`）中，未提炼为稳定文档。若后续该组件是重构/排障重点，建议补一篇 architecture 文档。
- `agent-quick-actions.ts`、`proposal-routing.ts`、`revision-routing.ts`、`cancelled-generation-retry.ts` 仅从调用点推断行为，未逐行确认实现细节。

### 历史文档对照
- `docs/` 下 01-09 号历史需求/方案文档未逐篇核对是否仍与当前代码一致（仅核对了 10、11 号，确认已落地）。若后续需要理解某功能的早期设计意图，读这些文档前应先假设其内容可能已被后续变更覆盖。

## Resolved / Stale Gaps
（本次为项目首次 init，暂无历史条目。）
