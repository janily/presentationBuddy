# llmdoc Index

## Purpose
- 本文件是 presentationBuddy 项目 llmdoc 文档体系的全局地图。
- 启动阅读顺序见 `llmdoc/startup.md`（本文件不重复列出阅读顺序）。

## Categories
- `must/`：高频启动上下文，几乎每个任务都该先读
- `overview/`：项目身份、边界、主要子系统
- `architecture/`：最深的耦合点/不变量——workflow 全链路、frontend-slides 生成契约
- `guides/`：暂无（当前项目尚无需要单独固化的操作型工作流指南）
- `reference/`：暂无（硬事实目前内嵌在对应 `architecture/` 文档与 `must/project-basics.md` 中，未单独拆分）
- `memory/`：已知文档缺口、决策记录、任务复盘

## Key Documents
- `llmdoc/overview/project-overview.md`：项目是什么、边界在哪、五大子系统（对话意图层/生成工作流层/frontend-slides 契约层/状态存储层/前端编排层）。
- `llmdoc/architecture/request-lifecycle-and-workflows.md`：主 workflow 两步 suspend/resume、两个 revision workflow 变体、`/api/analyze` 三分支、`/api/agent-chat` 提案生命周期如何驱动 revise——系统里最深、最容易出错的耦合点。
- `llmdoc/architecture/frontend-slides-contract.md`：唯一的 HTML 生成来源的契约与校验规则、落盘路径解析优先级。
- `llmdoc/must/project-basics.md`：项目身份速览、API 端点表、关键运行时事实（单例陷阱、无备用生成器、provider 抽象、落盘优先级）、测试/质量信号现状。
- `llmdoc/must/working-agreement.md`：docs/ 历史文档的免责声明、已踩过的命名/耦合陷阱、协作约定。
- `llmdoc/must/doc-routing.md`：按任务类型路由到具体文档。

## Routing Rules
- 任何任务先读 `startup.md` 走完 `must/` 三篇。
- 改动 workflow 编排、agent instructions、`/api/analyze`、proposal/artifact 状态机 → 读 `architecture/request-lifecycle-and-workflows.md`。
- 改动 frontend-slides 契约文本、html-validator、prompt-builder、落盘/URL 解析 → 读 `architecture/frontend-slides-contract.md`。
- 想知道"为什么这样设计"而非"现在是什么样" → 查 `docs/`（历史意图文档），但以 llmdoc architecture 文档或源码为当前状态的最终依据。
- `llmdoc/state/sync.md` 是机器管理的 commit watermark 状态，不是知识内容：不要索引进本文件或 `startup.md`/`must/`。

## Memory
- `llmdoc/memory/doc-gaps.md`：本次调查/记录中已知的未核实细节与信息盲区。
- `llmdoc/memory/reflections/`：任务复盘（当前为空，尚无历史任务）。
- `llmdoc/memory/decisions/`：架构/流程决策记录（当前为空）。
