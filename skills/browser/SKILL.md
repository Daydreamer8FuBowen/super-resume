---
name: browser
description: 基于 Patchright的浏览器自动化技能。凡是访问网页内容时都应使用本技能，包括 JDs、公司页面、招聘平台和职位调研。
---

# 浏览器技能

通过 **patchright-mcp** 提供浏览器自动化能力。Patchright 是 Playwright 的去检测 fork，自带反自动化指纹（`navigator.webdriver`、`window.chrome` 等泄露点均已被 patch）。

## 强制规则

**任何需要访问网页的操作，必须通过本 skill 的 MCP 工具完成。** 不允许跳过浏览器直接发 HTTP 请求、不允许用 WebFetch 代替。

**标签页确认** — Patchright 打开的浏览器是多标签页浏览器。每次开始操作前必须先用 `browser_tabs { "action": "list" }` 确认当前标签页，并在需要时用 `browser_tabs { "action": "select", "index": N }` 切换到正确标签页。不要在未确认标签页的情况下点击、输入或提取内容。

**标签页清理** — 如果本次任务由 Agent 新建标签页，任务完成后必须关闭该标签页，把浏览器恢复到不打扰用户的状态。不要关闭用户原本打开的标签页。

**人工操作优先** — 遇到登录、验证码、App 扫码、短信/手机号验证、滑块、人机验证、反爬拦截或任何需要真实用户完成的步骤时，立即停止自动化操作并提醒用户需要人工处理。不要尝试绕过、模拟、破解或反复刷新。

**subagent/snbagent 终止** — 如果当前执行者是 subagent 或 snbagent，遇到登录或人机验证后必须直接退出当前任务，并返回“需要人工验证，可在用户完成验证后继续”的说明；不要继续浏览其他页面。

## 如何调用

所有工具以 `mcp__patchright__` 为前缀，参数为 JSON 对象：

```
mcp__patchright__<工具名> { "参数": "值" }
```

例如导航到 Boss 直聘的一个 JD 页面：

```
mcp__patchright__browser_navigate { "url": "https://www.zhipin.com/job_detail/xxx.html" }
```

## 核心工作流

每次浏览网页遵循这个模式：

```
导航 → 等待加载 → 快照（获取元素引用） → 交互/提取
```

**步骤 1：导航**

```
mcp__patchright__browser_navigate { "url": "https://目标网址" }
```

**步骤 2：等待页面就绪**

```
mcp__patchright__browser_wait_for { "text": "页面中期待出现的文本" }
mcp__patchright__browser_wait_for { "time": 3 }    // 或者简单等几秒
```

**步骤 3：获取页面结构**

```
mcp__patchright__browser_snapshot {}
```

快照返回页面可访问性树，每个交互元素带有唯一 `ref` 标识（如 `e42`）。**后续操作通过 ref 定位元素**，精准且不受 DOM 变动影响。

**步骤 4：交互或提取内容**

交互——用 ref 点击、输入：

```
mcp__patchright__browser_click { "ref": "e42" }
mcp__patchright__browser_type { "ref": "e10", "text": "前端开发工程师" }
```

提取——用 JS 精确拿数据，避免拉整页快照浪费 token：

```
mcp__patchright__browser_evaluate { "function": "() => document.querySelector('.job-detail')?.innerText" }
mcp__patchright__browser_evaluate { "function": "() => [...document.querySelectorAll('.job-title')].map(e => e.textContent)" }
```

## 完整工具列表

### 导航
| 工具 | 说明 |
|------|------|
| `browser_navigate` | 导航到 URL |
| `browser_navigate_back` | 后退 |

### 交互
| 工具 | 说明 | 关键参数 |
|------|------|----------|
| `browser_click` | 点击元素 | `ref` 或 `element`（元素描述） |
| `browser_type` | 输入文本 | `ref` + `text` |
| `browser_press_key` | 按键 | `key`（如 `"Enter"`） |
| `browser_hover` | 悬停 | `ref` |
| `browser_select_option` | 下拉选择 | `ref` + `values`（选项值数组） |
| `browser_file_upload` | 上传文件 | `paths`（文件路径数组） |
| `browser_handle_dialog` | 处理弹窗 | `accept`（true=确认/false=取消） |

### 内容读取
| 工具 | 说明 |
|------|------|
| `browser_snapshot` | 可访问性快照——页面结构化文本，含 ref |
| `browser_take_screenshot` | 截图保存为文件 |
| `browser_evaluate` | 执行 JS 并返回结果——精确提取首选 |
| `browser_console_messages` | 读取浏览器控制台输出 |
| `browser_network_requests` | 查看网络请求列表 |

### 标签页
| 工具 | 说明 |
|------|------|
| `browser_tabs { "action": "list" }` | 列出所有标签页 |
| `browser_tabs { "action": "new", "url": "..." }` | 新建标签页 |
| `browser_tabs { "action": "select", "index": 0 }` | 切换到第 N 个标签页 |
| `browser_tabs { "action": "close" }` | 关闭当前标签页 |

### 其他
| 工具 | 说明 |
|------|------|
| `browser_wait_for` | `{ "time": 3 }` / `{ "text": "..." }` / `{ "textGone": "..." }` |
| `browser_resize` | 调整窗口 `{ "width": 1920, "height": 1080 }` |
| `browser_close` | 关闭浏览器 |
| `browser_mouse_click_xy` | 坐标点击（CSS/ref 无法定位时的最后手段） |

## SuperResume 典型场景

### 场景 1：抓取职位描述

```
mcp__patchright__browser_navigate { "url": "JD页面URL" }
mcp__patchright__browser_wait_for { "text": "职位描述" }
mcp__patchright__browser_evaluate { "function": "() => document.querySelector('.job-detail, .job-desc, .description')?.innerText" }
```

### 场景 2：搜索职位

```
mcp__patchright__browser_navigate { "url": "https://www.zhipin.com/web/geek/jobs" }
mcp__patchright__browser_snapshot {}
// 从快照找到搜索框的 ref，假设是 e5
mcp__patchright__browser_type { "ref": "e5", "text": "前端开发工程师" }
mcp__patchright__browser_press_key { "key": "Enter" }
mcp__patchright__browser_wait_for { "time": 3 }
mcp__patchright__browser_snapshot {}
// 从快照读取搜索结果，或 evaluate 提取
```

### 场景 3：浏览公司官网

```
mcp__patchright__browser_navigate { "url": "https://公司官网/about" }
mcp__patchright__browser_wait_for { "time": 2 }
mcp__patchright__browser_evaluate { "function": "() => document.querySelector('main, .about-content, .company-intro')?.innerText" }
mcp__patchright__browser_take_screenshot { "filename": "company-about.png" }
```

## 使用规范

**标签页安全** — 浏览前先列出标签页并确认目标页；跨任务切换时重新确认。只操作当前任务所属标签页。如果是自己创建的新标签页，结束时关闭；如果是用户已有标签页，保留并说明。

**操作节奏** — 每次操作之间间隔 2-5 秒。用 `browser_wait_for { "time": 3 }` 控制，模拟人类操作节奏。不要连续高速点击。

**内容读取效率** — 优先 `browser_evaluate` 精确提取目标数据。需要了解页面布局、找 ref 时才用 `browser_snapshot`。截图用于留档，不是每次都要。

**失败处理** — 页面打不开最多重试 2 次然后换来源。遇到验证码、人机验证或登录墙时立即停止并告知用户，不尝试绕过。需要登录时暂停，等待用户人工完成后再继续；如果是 subagent/snbagent，直接退出并报告限制。

**ref 有效期** — ref 来自最近一次快照。导航到新页面后旧 ref 失效，必须重新 `browser_snapshot` 获取。
