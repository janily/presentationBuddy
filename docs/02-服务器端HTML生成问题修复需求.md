# 服务器端 HTML 生成问题修复需求

**文档版本**: v1.0  
**优先级**: P0（最高）  
**预估工期**: 2-3 天  
**负责人**: 后端开发 + DevOps

---

## 一、问题描述

### 1.1 现象

**本地环境**：
- ✅ 演示文稿生成正常
- ✅ HTML 能正确保存到 `public/generated-slides/`
- ✅ 预览正常显示

**生产环境（服务器）**：
- ❌ HTML 生成失败
- ❌ 错误信息：无法建立连接到 `https://fonts.gstatic.com/...`（字体资源）
- ❌ 可能还有其他超时或资源限制问题

### 1.2 用户影响

- **严重程度**：🔴 致命
- **影响范围**：100% 生产环境用户无法使用核心功能
- **业务影响**：产品完全无法交付价值，用户流失风险极高

### 1.3 根本原因分析

根据错误信息和代码分析，问题可能来自以下几个方面：

| 原因 | 可能性 | 影响 |
|-----|--------|------|
| **字体资源加载失败** | 高 | Google Fonts 在服务器环境无法访问 |
| **LLM 生成超时** | 高 | 服务器端超时配置过短，长时间生成被中断 |
| **文件保存权限问题** | 中 | `public/` 目录在服务器上可能没有写权限 |
| **网络出口限制** | 中 | 服务器环境可能限制外部网络访问 |
| **资源限制** | 低 | 内存或 CPU 不足导致进程被杀 |

---

## 二、解决方案

### 2.1 方案总览

我们采用**多层次防御策略**，逐步排除问题：

```
Layer 1: 字体资源本地化 ✅（已完成）
  └─ 使用 @fontsource 包，避免依赖 Google Fonts CDN

Layer 2: 超时配置优化
  └─ 调整 workflow 超时时间，适配生产环境

Layer 3: 文件保存优化
  └─ 确保目录权限，添加错误处理

Layer 4: 日志和监控增强
  └─ 添加详细日志，快速定位问题

Layer 5: 降级策略
  └─ 提供备用生成方案，确保服务可用
```

---

## 三、详细实施步骤

### 步骤 1：字体资源本地化（已完成）

**现状**：
- ✅ 已安装 `@fontsource/fraunces` 和 `@fontsource/commissioner`
- ✅ 已修改 `src/app/layout.tsx` 使用 `next/font/local`
- ✅ 字体文件已复制到 `src/app/fonts/`

**验证**：
```bash
# 检查字体文件是否存在
ls src/app/fonts/
# 应该看到：
# commissioner-latin-300-normal.woff2
# commissioner-latin-400-normal.woff2
# ...
# fraunces-latin-300-normal.woff2
# ...
```

**测试**：
```bash
# 本地编译验证
pnpm run build

# 检查编译输出，确保没有字体相关错误
```

---

### 步骤 2：超时配置优化

#### 2.1 分析当前超时配置

**文件**：`src/mastra/workflows/presentation-generation-workflow.ts`

当前配置：
```typescript
const OUTLINE_GENERATION_TIMEOUT_MS = 300_000;  // 5 分钟
const HTML_GENERATION_TIMEOUT_MS = 360_000;     // 6 分钟
const HTML_STREAM_IDLE_TIMEOUT_MS = 180_000;    // 3 分钟
const OUTLINE_STREAM_IDLE_TIMEOUT_MS = 120_000; // 2 分钟
```

**问题**：
1. `HTML_STREAM_IDLE_TIMEOUT_MS` 3 分钟可能不够
   - 使用免费模型（如 `tencent/hy3:free`）时，思考时间可能很长
   - 服务器环境网络延迟更高
2. `HTML_GENERATION_TIMEOUT_MS` 6 分钟总超时可能被框架层限制覆盖

#### 2.2 优化方案

**调整超时配置**：

```typescript
// 根据环境动态调整超时时间
const isProduction = process.env.NODE_ENV === 'production';
const TIMEOUT_MULTIPLIER = isProduction ? 1.5 : 1.0;

const OUTLINE_GENERATION_TIMEOUT_MS = Math.floor(300_000 * TIMEOUT_MULTIPLIER);  // 生产环境 7.5 分钟
const HTML_GENERATION_TIMEOUT_MS = Math.floor(480_000 * TIMEOUT_MULTIPLIER);      // 生产环境 12 分钟
const HTML_STREAM_IDLE_TIMEOUT_MS = Math.floor(240_000 * TIMEOUT_MULTIPLIER);    // 生产环境 6 分钟
const OUTLINE_STREAM_IDLE_TIMEOUT_MS = Math.floor(180_000 * TIMEOUT_MULTIPLIER); // 生产环境 4.5 分钟
```

**修改文件**：`src/mastra/workflows/presentation-generation-workflow.ts`

**具体操作**：
1. 在文件顶部添加环境判断逻辑
2. 替换硬编码的超时常量
3. 添加日志输出当前超时配置

**代码示例**：
```typescript
// 添加到文件顶部
const isProduction = process.env.NODE_ENV === 'production';
const TIMEOUT_MULTIPLIER = isProduction ? 1.5 : 1.0;

console.log('Presentation workflow timeout configuration:', {
  environment: isProduction ? 'production' : 'development',
  multiplier: TIMEOUT_MULTIPLIER,
  outlineTimeout: Math.floor(300_000 * TIMEOUT_MULTIPLIER),
  htmlTimeout: Math.floor(480_000 * TIMEOUT_MULTIPLIER),
});
```

---

### 步骤 3：部署平台超时限制处理

HTML 生成是长时间运行的操作（可能需要 6-12 分钟），不同部署平台对函数执行时间有不同限制，需要分别处理。

#### 3.1 自部署服务器（默认路径）

**自部署在 VPS / 云主机 / 容器**（如 Docker、Zeabur、Railway、Render 等）：

- Node.js 进程**无内置超时**，由我们自己的 `HTML_GENERATION_TIMEOUT_MS` 控制
- 步骤 2 的超时配置即可满足需求，**无需额外操作**
- 唯一需要注意的是反向代理（Nginx / Caddy）的 `proxy_read_timeout`，需要设置到不低于 `HTML_GENERATION_TIMEOUT_MS`

**Zeabur 部署（本项目目标平台）**：
- Zeabur 容器部署无函数级超时限制，长时间生成不受影响
- 平台自带的网关对 SSE 流式响应友好，一般无需额外配置；若出现流被中断，检查服务的 HTTP 超时设置
- 需要关注的是**文件持久化问题**，见步骤 4

**Nginx 配置示例**（自建 VPS 时）：
```nginx
location /api/ {
  proxy_pass         http://localhost:3000;
  proxy_read_timeout 900s;   # ≥ HTML_GENERATION_TIMEOUT_MS (12min * 1.5 = 18min，建议 900s)
  proxy_send_timeout 900s;
  proxy_connect_timeout 60s;
}
```

**Docker / docker-compose 无需额外配置**，进程超时完全由应用层控制。

#### 3.2 Vercel 部署（可选平台）

Vercel 对函数执行时间有平台级限制：
- Hobby 计划：最大 10 秒
- Pro 计划：最大 300 秒（5 分钟）
- 即使是 Pro，HTML 生成若需要 6-12 分钟也会被强制中断

**解决方案**：

**方案 A：Vercel Pro + 调整 `vercel.json`（生成时间 < 5 分钟时可用）**
```json
{
  "functions": {
    "src/app/api/analyze/route.ts": {
      "maxDuration": 300
    }
  }
}
```

**方案 B：改用后台任务队列（Vercel 长时间任务的推荐方案）**
```
用户请求 → 创建任务 → 立即返回任务 ID
       ↓
  后台 Worker（Vercel Queue / Upstash QStash）处理
       ↓
  完成后客户端轮询或 Webhook 通知
```

**结论**：如果预期生成时间超过 5 分钟，**建议优先选择自部署服务器**，避免平台硬限制。

---

### 步骤 4：文件保存优化

#### 4.1 分析当前实现

**文件**：`src/utils/save-html-to-file.ts`

当前逻辑：
1. 生成唯一文件名
2. 保存到 `public/generated-slides/`
3. 返回 URL

**潜在问题**：
- Vercel 运行时 `public/` 是**只读**的（构建产物，不可写入）
- 自部署服务器上 `public/` 通常**可写**，但需确保目录权限和 `process.cwd()` 解析正确
- 没有错误处理和重试逻辑

#### 4.2 优化方案（按部署方式分层）

**自部署服务器（默认）**：

`public/generated-slides/` 在自部署环境中完全可用，保持现有逻辑，仅补充错误处理和重试即可。需确保：
- 目录可写（`chmod 755 public/generated-slides` 或由 Node 自动 `mkdir`）
- 反向代理静态文件路由正常（Nginx 的 `root` 指向 `public/`）

**Zeabur 部署（本项目目标平台）——挂载 Volume 持久化**：

Zeabur 容器文件系统是**临时的**：重新部署/重启后 `public/generated-slides/` 下的文件全部丢失，历史预览链接失效。解决方案是挂载 Zeabur Volume：

1. Zeabur 控制台：Service → Volumes → 添加 Volume，挂载路径设为 `/data`
2. 设置环境变量 `GENERATED_SLIDES_DIR=/data/generated-slides`
3. 文件保存逻辑优先读取该环境变量，写入 Volume 目录
4. **注意**：Volume 目录不在 `public/` 下，Next.js 静态路由无法直接访问，需复用步骤 5 的预览 API 提供文件访问

**Vercel 环境（可选）**：

必须改用 `/tmp` 目录或云存储，因为 `public/` 在运行时只读。

#### 4.3 实施步骤

**修改文件**：`src/utils/save-html-to-file.ts`

**具体操作**：
1. 新增 `GENERATED_SLIDES_DIR` 环境变量支持（Zeabur Volume 挂载路径），优先级最高
2. 保持自部署路径（`public/generated-slides/`）为默认
3. 检测 Vercel 环境，自动切换到 `/tmp`
4. 补充目录创建、错误处理、重试逻辑
5. 添加日志

**代码示例**：
```typescript
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const isVercel = process.env.VERCEL === '1';
// Zeabur 等容器平台：挂载 Volume 并通过此变量指定持久化目录
const customOutputDir = process.env.GENERATED_SLIDES_DIR;

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

function resolveOutputDir(): { dir: string; servedByStatic: boolean } {
  if (customOutputDir) {
    // Zeabur Volume 等自定义目录：不在 public/ 下，需走预览 API
    return { dir: customOutputDir, servedByStatic: false };
  }
  
  if (isVercel) {
    // Vercel 运行时 public/ 只读，必须写 /tmp
    return { dir: '/tmp/generated-slides', servedByStatic: false };
  }
  
  // 自部署服务器：使用项目 public/ 目录，静态路由直接可访问
  // mastra dev 时 cwd 会指向 .mastra/output，需要向上导航
  let projectRoot = process.cwd();
  if (projectRoot.includes('.mastra')) {
    projectRoot = projectRoot.substring(0, projectRoot.indexOf('.mastra')).replace(/\/$/, '');
  }
  return {
    dir: join(projectRoot, 'public', 'generated-slides'),
    servedByStatic: true,
  };
}

export async function saveHtmlToFile(
  html: string,
  options: { prefix?: string } = {}
): Promise<string> {
  const { prefix = 'presentation' } = options;
  const filename = `${prefix}-${crypto.randomUUID()}.html`;
  
  const { dir: outputDir, servedByStatic } = resolveOutputDir();
  await ensureDir(outputDir);
  
  const filePath = join(outputDir, filename);
  
  let retries = 3;
  while (retries > 0) {
    try {
      await writeFile(filePath, html, 'utf-8');
      console.log('HTML file saved successfully:', {
        filePath,
        size: html.length,
        servedByStatic,
      });
      
      // public/ 下的文件由静态路由直接提供；
      // Volume / tmp 目录需走预览 API
      return servedByStatic
        ? `/generated-slides/${filename}`
        : `/api/preview/${filename}`;
    } catch (error) {
      retries--;
      console.error('Failed to save HTML file:', { filePath, error, retriesLeft: retries });
      if (retries === 0) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error('Failed to save HTML after retries');
}
```

---

### 步骤 5：添加预览 API（Zeabur Volume / Vercel 环境需要）

当文件保存目录**不在 `public/` 下**时（Zeabur Volume 挂载目录、Vercel `/tmp`），Next.js 静态路由无法直接提供文件，需要预览 API 代理读取。

仅当使用默认的 `public/generated-slides/` 路径时（无 Volume 的纯自部署），此 API 不会被用到，但建议一并实现，作为统一的访问入口。

**创建文件**：`src/app/api/preview/[filename]/route.ts`

```typescript
import { readFile } from 'fs/promises';
import { join } from 'path';
import { NextRequest, NextResponse } from 'next/server';

function resolvePreviewDir(): string {
  // 与 save-html-to-file.ts 的目录解析保持一致
  if (process.env.GENERATED_SLIDES_DIR) {
    return process.env.GENERATED_SLIDES_DIR; // Zeabur Volume
  }
  if (process.env.VERCEL === '1') {
    return '/tmp/generated-slides';
  }
  return join(process.cwd(), 'public', 'generated-slides');
}

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const { filename } = params;
    
    // 安全检查：防止路径遍历攻击
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }
    
    const filePath = join(resolvePreviewDir(), filename);
    const html = await readFile(filePath, 'utf-8');
    
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // 文件名含 UUID，内容不可变，可长缓存；
        // 但 Vercel /tmp 文件重启后丢失，不设长缓存
        'Cache-Control': process.env.VERCEL === '1'
          ? 'no-store'
          : 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Failed to serve preview file:', error);
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
```

---

### 步骤 6：增强日志和监控

#### 6.1 添加关键节点日志

**修改文件**：
- `src/mastra/workflows/presentation-generation-workflow.ts`
- `src/app/api/analyze/route.ts`

**添加日志点**：
1. Workflow 启动时
2. Outline 生成开始/完成
3. HTML 生成开始/每次流式更新/完成
4. 文件保存开始/完成
5. 错误发生时（包含完整堆栈和上下文）

**代码示例**：
```typescript
console.log('Presentation HTML generation: starting', {
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV,
  slideCount: inputData.outline.slides.length,
  model: process.env.PRESENTATION_HTML_MODEL,
});

// ... 生成逻辑 ...

console.log('Presentation HTML generation: completed', {
  timestamp: new Date().toISOString(),
  duration: Date.now() - startTime,
  generatedCharacters: html.length,
  outputPath: htmlUrl,
});
```

#### 6.2 错误分类和处理

**增强错误信息**：

```typescript
function enhanceError(error: unknown, context: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  
  return {
    error: message,
    context,
    timestamp: new Date().toISOString(),
    stack: error instanceof Error ? error.stack : undefined,
  };
}

// 使用示例
catch (error) {
  console.error('HTML generation failed:', enhanceError(error, {
    slideCount: inputData.outline.slides.length,
    model: process.env.PRESENTATION_HTML_MODEL,
    timeout: HTML_GENERATION_TIMEOUT_MS,
  }));
  throw error;
}
```

---

## 四、测试计划

### 4.1 本地测试

**测试用例 1：字体加载**
```bash
# 清除 .next 缓存
rm -rf .next

# 重新编译
pnpm run build

# 检查编译日志，确保没有字体相关错误
# 启动开发服务器
pnpm run dev

# 打开浏览器开发者工具 Network 标签
# 生成一份演示文稿
# 确认没有 Google Fonts 请求
```

**测试用例 2：超时配置**
```bash
# 设置环境变量
export NODE_ENV=production

# 启动服务
pnpm run build && pnpm start

# 生成演示文稿，观察日志中的超时配置
```

**测试用例 3：文件保存——自部署路径**
```bash
# 确认未设置 VERCEL 变量（默认即自部署路径）
unset VERCEL

pnpm run dev

# 生成演示文稿
# 检查文件是否保存到 public/generated-slides/
ls public/generated-slides/

# 直接访问静态 URL 验证预览
# 浏览器打开 http://localhost:3000/generated-slides/<filename>.html
```

**测试用例 4：文件保存——Zeabur Volume 路径（部署目标平台）**
```bash
# 模拟 Volume 挂载目录
export GENERATED_SLIDES_DIR=/tmp/mock-volume/generated-slides

pnpm run dev

# 生成演示文稿
# 检查文件是否保存到模拟 Volume 目录
ls /tmp/mock-volume/generated-slides/

# 验证预览 API：http://localhost:3000/api/preview/<filename>.html
```

**测试用例 5：文件保存——Vercel 路径（可选，仅需部署到 Vercel 时验证）**
```bash
# 模拟 Vercel 环境
export VERCEL=1

pnpm run dev

# 生成演示文稿
# 检查文件是否保存到 /tmp/generated-slides/
ls /tmp/generated-slides/

# 验证预览 API：http://localhost:3000/api/preview/<filename>.html
```

### 4.2 生产环境测试

#### Zeabur 部署（本项目目标平台）

**部署前检查清单**：
- [ ] Zeabur 控制台已为服务挂载 Volume（挂载路径如 `/data`）
- [ ] 环境变量已设置：`GENERATED_SLIDES_DIR=/data/generated-slides`
- [ ] 其余环境变量已设置（`MODEL_API_KEY`、`MODEL_PROVIDER` 等）
- [ ] 字体文件已包含在构建产物中
- [ ] 预览 API 已实现（Volume 目录不走静态路由）

**部署后验证**：
1. 访问 Zeabur 分配的域名
2. 创建一份简单的演示文稿（3-5 页），检查生成过程是否流畅（SSE 流式进度正常推送）
3. 预览 URL 应为 `/api/preview/<filename>.html` 格式，确认可正常访问
4. **持久化验证**：在 Zeabur 控制台 Redeploy 服务，重启后旧的预览链接仍可访问
5. 检查浏览器控制台是否有错误

#### 自部署服务器（VPS / Docker，通用场景）

**部署前检查清单**：
- [ ] Node.js 进程有 `public/generated-slides/` 目录的写权限
- [ ] Nginx（如有）`proxy_read_timeout` ≥ 900s
- [ ] 环境变量已设置（`MODEL_API_KEY` 等）
- [ ] 字体文件已包含在构建产物中
- [ ] **未设置** `VERCEL=1` 环境变量

**部署后验证**：
1. 访问生产环境 URL
2. 创建一份简单的演示文稿（3-5 页），检查生成过程是否流畅
3. 检查 `public/generated-slides/` 下是否有新文件
4. 直接访问 `/generated-slides/<filename>.html` 确认预览正常
5. 检查浏览器控制台是否有错误

#### Vercel 部署（可选场景）

**部署前检查清单**：
- [ ] Vercel 账户为 Pro 计划（Hobby 超时限制 10s 无法使用）
- [ ] `vercel.json` 已配置 `maxDuration: 300`
- [ ] 环境变量已设置（`MODEL_API_KEY` 等，在 Vercel 控制台配置）
- [ ] 字体文件已包含在构建产物中

**部署后验证**：
1. 访问生产环境 URL
2. 创建一份演示文稿，检查生成是否在 5 分钟内完成
3. 预览 URL 应为 `/api/preview/<filename>.html` 格式，确认可正常访问
4. 重启（redeploy）后 `/tmp` 文件丢失属正常现象——历史记录中的旧预览链接将失效

**压力测试（通用）**：
1. 创建大型演示文稿（15-20 页）
2. 观察是否超时
3. 检查日志中的性能指标

---

## 五、回滚计划

如果修复后问题仍然存在，需要快速回滚。

### 5.1 回滚步骤
1. 恢复 Git 提交到修复前的版本
2. 重新部署
3. 在修复分支上继续调试

### 5.2 降级方案

**方案 A：禁用生产环境功能**
- 在生产环境显示维护公告
- 引导用户使用本地版本或提供演示视频

**方案 B：使用备用生成方案**
- 临时使用更快的模型（如 GPT-4o-mini）
- 限制生成页数上限
- 增加用户等待提示

---

## 六、完成标准

### 6.1 功能验证
- [ ] 本地环境能正常生成演示文稿
- [ ] 生产环境能正常生成演示文稿
- [ ] 没有字体加载错误
- [ ] 没有超时错误
- [ ] 文件能正常保存和预览

### 6.2 性能指标
- [ ] Outline 生成时间 < 90 秒（生产环境）
- [ ] HTML 生成时间 < 180 秒（生产环境）
- [ ] 文件保存时间 < 5 秒

### 6.3 日志和监控
- [ ] 关键节点都有日志输出
- [ ] 错误信息包含足够的上下文
- [ ] 能通过日志快速定位问题

---

## 七、交付物

1. **代码修改**：
   - `src/app/layout.tsx`（字体本地化）✅ 已完成
   - `src/mastra/workflows/presentation-generation-workflow.ts`（超时优化）
   - `src/utils/save-html-to-file.ts`（文件保存优化，支持 `GENERATED_SLIDES_DIR` / Vercel / 默认 public 三种路径）
   - `src/app/api/preview/[filename]/route.ts`（预览 API，Zeabur Volume 与 Vercel 环境必需）

2. **部署配置（按平台选择）**：
   - **Zeabur（本项目目标平台）**：挂载 Volume + 设置 `GENERATED_SLIDES_DIR` 环境变量（参见步骤 4.2）
   - **自建 VPS**：Nginx `proxy_read_timeout` 配置（参见步骤 3.1）
   - **Vercel（可选）**：`vercel.json` 添加 `maxDuration: 300`

3. **测试报告**：
   - 本地测试结果（截图 + 日志）
   - 生产环境测试结果（截图 + 日志）
   - 性能指标对比（修复前 vs 修复后）

4. **文档更新**：
   - README.md 添加部署说明（区分自部署和 Vercel 两种路径）
   - 环境变量配置文档

---

**下一步**：完成本文档的实施后，继续进行 `03-集成frontend-slides-skill需求.md`。
