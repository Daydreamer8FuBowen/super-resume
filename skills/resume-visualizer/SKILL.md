---
name: resume-visual
description: SuperResume 的简历 JSON 可视化渲染器。MUST use this skill when the user wants to preview a resume profile as a styled HTML page, visualize base.json or a target profile, start a live-preview dev server, export resume to HTML, or see what their resume looks like. 触发请求包括“预览我的简历”、“render my resume”、“show my resume”、“生成简历页面”、“打开简历预览”、“visualize the resume JSON”，以及任何已产出简历 JSON 且需要视觉反馈的工作流步骤。
---

# 简历可视化预览

本技能会把 profile-loader 生成的 JSON 文件（`base.json` 或某个目标 profile）渲染为样式完整的 HTML 简历页面。它会启动带实时刷新的开发服务器，便于你调整 JSON 后立即看到变化。

## 适用范围

以下情况应使用本技能：

- 将 `data/profiles/base.json` 渲染为可预览的可视化 HTML 简历。
- 将任意目标 profile JSON（`data/profiles/targets/*.json`）渲染为 HTML。
- 启动实时刷新 dev server，监听 JSON 文件变化并自动刷新浏览器。
- 导出自包含 HTML 文件（可在任意浏览器打开，也可打印为 PDF）。
- 预览 profile JSON 的修改会如何影响最终简历外观。

以下情况不应使用本技能：

- 编辑或修改 profile JSON（使用 `profile-loader` 或 `base-profile-editor`）。
- 撰写简历内容（使用简历写作技能）。
- 判断简历质量（使用评审技能）。
- 创建新的简历模板（模板是 HTML/CSS，编辑模板属于另一类任务）。

## 路径约定

JSON 文件有两类不同存放位置——不要混用：

| 位置 | 目录 | 用途 | 示例 |
|----------|-----------|---------|----------|
| **插件数据** | `skills/resume-visualizer/` | visualizer 自身的模板元数据、示例/测试数据 | `sample-base.json`, `templates/*/template.json` |
| **用户数据** | `data/profiles/`（项目根目录） | 用户真实简历 profiles——事实源 | `base.json`, `targets/<company>-<role>.json` |

**规则：**
- visualizer 自身的 JSON 文件（示例、模板配置）保留在插件目录中——绝不要把用户数据写到那里。
- 用户简历 JSON 始终位于项目根目录的 `data/profiles/` 下——visualizer 从这里读取用户文件。
- visualizer 脚本接受任意路径作为输入，因此用户文件可以在任何位置，但**约定**是 `data/profiles/`。

## 稳定的 Profile 解析规则

不要凭猜测决定要可视化哪个 profile JSON，也不要把 profile JSON 复制到 visualizer 目录中。先解析输入：

```bash
node skills/resume-visualizer/scripts/resolve-profile.mjs [input] --json
```

支持的输入形式：

| 输入 | 含义 |
|---|---|
| omitted or `latest` | 最新的 `data/profiles/targets/*.json`；如果没有则回退到 `data/profiles/base.json` |
| `base` | `data/profiles/base.json` |
| `target:<slug>` | `data/profiles/targets/<slug>.json` |
| `<path.json>` | 显式 JSON 文件 |

解析器会校验所选 profile，并返回精确的 `render-resume.mjs` 命令。预览或导出时使用该命令。

## 工作原理

可视化脚本会读取 profile JSON，将其转换为视图模型，再通过兼容 Handlebars 的模板引擎渲染并写入一个自包含 HTML 文件。如果没有传入 `--no-serve`，它会启动本地 HTTP 服务，并通过 Server-Sent Events (SSE) 实现实时刷新。

### 命令格式

```bash
node skills/resume-visualizer/scripts/render-resume.mjs <input.json> [output.html] [options]
```

### 参数说明

| 参数 | 说明 |
|---|---|
| `--port, -p <N>` | Dev server 端口（默认：3000；忙碌时自动递增） |
| `--no-serve` | 只写入 HTML 文件，不启动 dev server |
| `--open, -o` | server 启动后自动打开浏览器 |
| `--template, -t <name>` | 使用的模板（默认：`modern-clean`） |
| `--watch, -w <path>` | 额外监听的文件或 glob |

### 使用示例

```bash
# 使用实时刷新预览基础 profile
node skills/resume-visualizer/scripts/render-resume.mjs data/profiles/base.json resume-preview.html

# 使用示例数据快速测试
node skills/resume-visualizer/scripts/render-resume.mjs skills/resume-visualizer/sample-base.json

# 只导出（不启动 server）
node skills/resume-visualizer/scripts/render-resume.mjs base.json export.html --no-serve

# 自定义端口并自动打开浏览器
node skills/resume-visualizer/scripts/render-resume.mjs base.json preview.html --port 8080 --open
```

## 推荐流程

### 1. 解析输入 JSON 路径

根据用户请求和上下文判断：

- 如果用户说“preview my resume”或类似请求但没有指定文件，运行 `resolve-profile.mjs latest --json`。
- 如果用户指定了某个 profile，运行 `resolve-profile.mjs target:<slug> --json` 或传入显式 JSON 路径。
- 如果 profile 刚由上一个工作流步骤创建或更新，将那个精确文件路径传给 `resolve-profile.mjs`。
- 如果还没有 profile JSON，告诉用户先通过 `base-profile-editor` 创建。

### 1.5. 头像检查（非必需）

**运行 visualizer 前**，检查是否存在简历头像并提示用户：

```
📷 简历头像提示：
   在工作目录下放置一张 profile.png（或 .jpg）即可作为简历头像。
   当前状态：<检测到 / 未检测到>
```

- 如果当前工作目录存在 `profile.png`（或 `profile.jpg`）→ visualizer 会自动检测、转换为 base64，并注入简历。
- 如果没有找到头像文件 → 只提示一次，然后继续流程。用户后续添加头像后，实时刷新会自动捕获。
- 用户也可以明确请求：“帮我添加简历头像”——此时引导他们把 `profile.png` 放到项目目录并重新运行 visualizer。
- 头像文件会自动复制到 `skills/resume-visualizer/`，用于持久保存。

这一步**不会阻塞流程**——没有头像时 visualizer 也能正常工作。

### 2. 选择输出路径

- 默认：当前工作目录下的 `<input-basename>-preview.html`。
- 用户可以指定自定义路径。

### 3. 运行可视化器

执行 `resolve-profile.mjs` 返回的渲染命令，并报告输出：

```
✔ Parsed base.json (5.2 KB)
✔ Loaded template "modern-clean" (5 partials)
✔ Written to resume-preview.html (18.3 KB)

Dev server running at http://localhost:3000
Watching for changes...
Press Ctrl+C to stop
```

### 4. 告知用户下一步操作

- 如果 dev server 正在运行，分享 URL。
- 如果使用了 `--no-serve`，告诉用户在浏览器中打开 HTML 文件。
- 提醒用户可以通过浏览器打印为 PDF（Ctrl+P / Cmd+P）。

## 可用模板

| 模板 | 布局 | 说明 |
|---|---|---|
| `modern-clean` | 单栏 | 简洁居中布局，支持头像，ATS 友好，已优化打印效果（默认） |
| `modern-professional` | 双栏 | 左侧栏（头像、联系方式、技能、教育）+ 右侧主体（经历、项目）。专业、紧凑。 |

### 头像支持

两个模板都支持在 `personal_info` 中使用可选的 `photo` 字段：

```json
"personal_info": {
  "photo": "https://example.com/photo.jpg",
  ...
}
```

`photo` 字段支持以下形式：
- **URL**（例如：`"https://example.com/photo.jpg"`）
- **base64 data URI**（例如：`"data:image/png;base64,..."`）
- **省略**——visualizer 会自动检测工作目录中的 `profile.png`

**本地文件约定（推荐）：**

在项目根目录放置 `profile.png`（或 `profile.jpg`）。visualizer 会自动：
1. 启动时检测该文件
2. 读取并转换为 base64 data URI
3. 注入到 `personal_info.photo`（仅当该字段为空时）
4. 复制到 `skills/resume-visualizer/` 用于持久保存

这不是必需项——当没有找到头像且 `photo` 为空时，双栏模板会显示占位图标，单栏模板会渲染无头像页头。

如需查看可用模板，请列出 `skills/resume-visualizer/templates/` 下的目录。

## 模板结构

每个模板都是 `templates/` 下的一个目录：

```
templates/<template-name>/
├── template.json      # Metadata: name, version, features
├── template.hbs       # Main HTML frame
├── style.css          # CSS styles (custom properties for theming)
└── partials/          # Reusable template fragments
    ├── header.hbs
    ├── experience-item.hbs
    ├── education-item.hbs
    ├── project-item.hbs
    └── skills.hbs
```

模板使用兼容 Handlebars 的语法。支持的语法子集请参考现有模板。

## 数据映射

visualizer 将 `base.json` 的 section 映射到简历展示 section：

| JSON section | 简历展示区块 | 说明 |
|---|---|---|
| `personal_info` | Header（姓名、headline、联系方式、链接） | 始终显示 |
| `career_objective.summary_facts` | Summary | 仅在非空时显示 |
| `skills` | Skills（按分类展示 tag cloud） | 仅当任意分类有内容时显示 |
| `work_experience` | Experience | 按日期倒序排序；全为空则跳过 |
| `internships` | Internships | 使用与 Experience 相同的样式 |
| `projects` | Projects | 显示问题、动作、结果、技术 |
| `education` | Education | 显示学历、学校、GPA、荣誉 |
| `certifications` | Certifications | 简单列表 |
| `awards` | Awards | 简单列表 |
| `languages` | Languages | 简单列表 |

元数据字段（`raw_sources`、`source_notes`、`metadata`、`resume_preferences`、`confidence`）不会被渲染。

## 限制说明

- 内置模板引擎只支持 Handlebars 语法子集（`{{var}}`、`{{{var}}}`、`{{#if}}`、`{{#each}}`、`{{> partial}}`、`{{join}}`）。不支持完整 Handlebars helpers。
- 实时刷新会监听输入 JSON 文件和当前激活的模板目录。外部 CSS 文件或图片变化不会被监听，除非通过 `--watch` 传入。
- dev server 只提供生成的 HTML 文件和 SSE endpoint。它不是通用静态文件服务器。

## 故障排查

| 现象 | 可能原因 | 解决办法 |
|---|---|---|
| "Input file not found" | 路径错误或 profile 缺失 | 检查路径；通过 `base-profile-editor` 创建 profile |
| "Template not found" | `--template` 名称错误 | 列出 `templates/` 目录查看有效名称 |
| 端口已占用 | 另一个实例正在运行 | 脚本会自动递增端口；查看控制台输出 |
| 浏览器空白页 | profile 数据为空或全是 null | 通过 `base-profile-editor` 填写 profile 数据 |
| 文件变化后浏览器不刷新 | 操作系统文件监听限制 | 手动刷新（F5） |
