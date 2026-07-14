# 生成中断与 frontend-slides 重试空结果问题分析与解决方案

> 依据错误日志 `err.txt`（2026-07-14）与当前源码分析。

## 一、错误现象（日志逐条对应）

`err.txt` 中的三段日志其实是**同一次生成请求的一条因果链**：

1. **`Error [AbortError]: This operation was aborted`**（`src/app/api/analyze/route.ts:189`）
   客户端断开了 `/api/analyze` 的 resume 请求（用户刷新/关闭页面、前端超时或代理断连），`request.signal` 触发 abort，`run.cancel()` 被调用，workflow run 进入取消状态。

2. **`initialFailure: "promise 'text' was not resolved or rejected when stream finished"`**
   HTML 生成步骤（`presentation-generation-workflow.ts` 的 `runFrontendSlidesAttempt`）里，流被中途取消：`fullStream` 直接结束、累积的 `output` 为空，代码回退到 `getCompletedStreamText(stream)` 去等 `stream.text`——但 AI SDK 在流被 abort 后既不 resolve 也不 reject 这个 promise，最终以上述错误失败。

3. **`Failed to extract HTML from frontend-slides agent result`**（`html-validator.ts:21`）
   初次失败后，代码进入 repair 重试分支，但重试**复用了同一个已经 aborted 的 `abortSignal`**，agent stream 立即结束、返回空字符串，`extractHtmlFromAgentResult` 在空内容上抛错，整步以 `frontend-slides generation failed` 终结。

## 二、根因分析

### 根因 1（主因）：取消（abort）没有被当作独立的失败类别处理

`presentation-generation-workflow.ts:729-754` 的 try/catch 把**所有**初次失败都当作"模型输出不合格"，一律走 repair 重生成。但本次的初次失败是**请求被取消**：

- 取消后重试注定失败（signal 已 aborted，stream 秒关、输出为空）；
- 白白多打一次 agent 调用日志，并把真实原因（用户断连）掩盖成"HTML 提取失败"，误导排障。

### 根因 2：`getCompletedStreamText` 对 abort 场景的兜底不成立

`presentation-generation-workflow.ts:712` 在 `output` 为空时等待 `stream.text`。流因 abort 提前结束时，这个 promise 会挂起直到 `HTML_STREAM_IDLE_TIMEOUT_MS` 超时（或如本例被底层以 "promise 'text' was not resolved" 拒绝），拖长失败路径。

### 根因 3：`extractHtmlFromAgentResult` 对空输入的报错信息不区分场景

`html-validator.ts:21` 对"空字符串"和"有内容但格式不对"抛同一个错误。空输入几乎总意味着上游流异常（abort/超时），而非模型输出格式问题，混在一起使 repair prompt 把"提取失败"当成格式问题去修，方向就是错的。

### 附带观察：`/api/analyze` 的 abort 处理本身是符合预期的

`route.ts:188-190` 在客户端断连时 `run.cancel()` 是正确行为；问题不在这里，而在 workflow 步骤内部对取消信号的后续处置。AbortError 打进 `console.error` 会造成"服务端出错"的假象，可降级为 warn 并标注取消语义。

## 三、解决方案

### 方案 A（必做）：在 HTML 生成步骤中识别取消，跳过 repair 重试

在 `presentation-generation-workflow.ts` 初次失败的 catch 分支（约 734 行）最前面加取消判断：

```ts
} catch (initialError) {
  if (abortSignal?.aborted) {
    throw new Error("Presentation HTML generation was cancelled by the client");
  }
  // ...现有 repair 重试逻辑
}
```

同时在 `runFrontendSlidesAttempt` 入口和流读取循环中检查 `abortSignal?.aborted`，一旦 aborted 立即抛出带"cancelled"语义的错误，而不是继续等超时。外层 catch（764 行）对 cancelled 错误改用 `console.warn`，避免误报为生成失败。

### 方案 B（必做）：修正空输出的兜底与报错语义

1. `runFrontendSlidesAttempt` 末尾（712 行）：仅在流**正常完成**（`done === true` 且未 aborted）时才调用 `getCompletedStreamText`；abort 场景直接抛 cancelled 错误，不再等待 `stream.text`。
2. `extractHtmlFromAgentResult`（`html-validator.ts`）：空输入单独报错，便于区分上游流异常与模型格式问题：

```ts
export function extractHtmlFromAgentResult(result: string) {
  const content = result.trim();
  if (!content) {
    throw new Error("frontend-slides agent returned empty output (stream may have been aborted or truncated)");
  }
  // ...现有提取逻辑
}
```

对应补充 `html-validator.test.ts` 用例：空字符串/纯空白输入应抛出该新错误信息。

### 方案 C（建议）：`/api/analyze` 侧区分取消日志

`route.ts` 中给 `run.cancel()` 附带日志标注取消来源（client abort），并在 workflow 失败上报路径里把 `AbortError` / cancelled 类错误从 error 级降为 warn 级，前端可据此提示"生成已取消"而非"生成失败"。

### 方案 D（可选，提升重试价值）：repair 前校验初次失败类型

repair 重生成只对以下失败类型有意义：slide 数量不符、缺固定舞台规则等**格式/契约类**校验失败。对超时、取消、空输出类失败，重试同一 prompt 大概率复现失败，可直接失败快返，节省一次完整生成的 token 与时间。可按错误信息前缀白名单实现。

## 四、验证方式

1. 单测：`html-validator.test.ts` 新增空输入用例；为 workflow 的取消分支补 mock 测试（aborted signal 下不进入 repair、抛 cancelled 错误）。
2. 手工复现：发起生成后中途刷新页面，确认服务端日志只出现一条"cancelled"warn，无 repair 重试、无 "Failed to extract HTML" 报错。
3. 回归：正常生成路径与真正格式失败触发 repair 的路径不受影响。

## 五、涉及文件

| 文件 | 改动 |
|---|---|
| `src/mastra/workflows/presentation-generation-workflow.ts` | abort 识别、跳过 repair、空输出兜底条件收紧 |
| `src/services/frontend-slides/html-validator.ts` | 空输入独立报错 |
| `src/services/frontend-slides/html-validator.test.ts` | 新增用例 |
| `src/app/api/analyze/route.ts` | （建议）取消日志语义化 |
