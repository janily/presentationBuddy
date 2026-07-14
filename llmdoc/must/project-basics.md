# Project Basics

## Identity
- Presentation Buddy：Next.js 16 + Mastra 应用，把一段演示文稿简报（brief）变成可在浏览器直接打开的完整 HTML 幻灯片。
- 唯一 UI 页面是 `/`（`src/app/page.tsx` → `<PresentationStudio />`），单页应用，无路由分支。
- 包管理器 pnpm；关键依赖：`@mastra/core`/`@mastra/ai-sdk`/`@mastra/libsql`、`ai`(AI SDK v5)、`@ai-sdk/{google,openai,react}`、`@openrouter/ai-sdk-provider`、`zod`。

## 核心目录
- `src/app/page.tsx` + `src/components/presentation-studio/`：唯一 UI 入口与编排组件。
- `src/app/api/`：4 个存活的 API 路由（`upload/` 目录存在但为空，非存活端点）。
- `src/mastra/`：Mastra 单例（`index.ts`）、3 个 agent、4 个 workflow。
- `src/services/frontend-slides/`：加载 `.claude/skills/frontend-slides` 契约、构建生成 prompt、校验输出。
- `src/services/presentation-artifacts/`、`src/services/agent-proposals/`：进程内内存状态存储（artifact 版本、proposal 生命周期）。
- `src/utils/save-html-to-file.ts`：生成 HTML 的落盘与 URL 解析（不在 `presentation-artifacts/` 里，容易找错地方）。
- `src/hooks/use-presentation-workflow.ts`：`/api/analyze` 的唯一客户端封装（基于 AI SDK `useChat`）。

## API 端点一览
| 路径 | 方法 | 职责 |
|---|---|---|
| `/api/analyze` | POST | 主工作流入口：`start`（新建生成）/`resume`（大纲审阅后恢复）/`revise`（修订已有 deck）三分支，流式返回 |
| `/api/agent-chat` | POST | 对话式简报/修订意图分类，返回结构化决策 + 可选 proposal |
| `/api/agent-chat/proposal-status` | POST | 更新 proposal 生命周期（`cancelled`/`executing`） |
| `/api/style-discovery` | POST | 确定性（无 LLM）风格发现，从预设目录挑 3 个 |
| `/api/preview/[filename]` | GET | 当生成的 deck 不在 `public/` 下时的静态托管出口 |
| `/api/upload` | — | 目录存在但为空，当前不是可用端点 |

## 关键运行时事实（务必牢记）
- **Mastra 单例**：`src/mastra/index.ts` 用 `globalThis.__presentationBuddyMastra` 缓存实例，避免 Next dev 热重载重复注册。`storage` 是 `LibSQLStore({ url: ":memory:" })`——workflow run 状态**进程内、非持久化**。
- **两个额外内存单例**：`artifact-store`（deck 版本元数据）与 `agent-proposals/proposal-store`（提案生命周期）同样是进程内 Map，靠 `globalThis` 缓存。**多实例部署下这三者都会失效**，仅适合单实例/单进程运行。
- **HTML 生成无备用生成器**：唯一生成器是 `frontendSlidesComposerAgent`，失败只重试一次（repair prompt），仍失败即整步报错。
- **模型 provider 抽象**：`src/utils/model-provider.ts`，默认 `openrouter`，支持 `openrouter|openai|google|openai-compatible`；`MODEL_API_KEY`/`MODEL_BASE_URL` 优先于各 provider 专属 env。openrouter 保留 vendor 前缀（如 `google/gemini-...`），直连 provider 才剥前缀。
- **生成产物落盘目录优先级**（`resolveGeneratedSlidesDir`，`src/utils/save-html-to-file.ts`）：`GENERATED_SLIDES_DIR` env → `VERCEL=1`→`/tmp/generated-slides` → 默认 `public/generated-slides`。前两者走 `/api/preview/<file>`，默认走 Next 静态托管 `/generated-slides/<file>`。

## 测试与质量信号
- 测试框架 vitest（node 环境，仅匹配 `src/**/*.test.ts`），23 个测试文件，聚焦纯逻辑（路由校验、状态机、映射、校验、存储、provider 选择），**无组件渲染测试、无 E2E、无覆盖率门槛**。
- ESLint 用 `eslint-config-next` 官方集，无自定义规则。
- **无 CI**（无 `.github/`、`.gitlab-ci.yml` 等），测试/lint 依赖本地手动执行：`pnpm test` / `pnpm lint`。
- 部署侧为 Vercel（`vercel.json` 仅设置 install 命令），非 CI 测试。

## Related Docs
- `llmdoc/overview/project-overview.md`：项目身份与边界的完整表述。
- `llmdoc/architecture/request-lifecycle-and-workflows.md`：workflow 与 API 三分支全链路。
- `llmdoc/architecture/frontend-slides-generation-contract.md`：HTML 生成契约细节。
