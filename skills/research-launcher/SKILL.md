---
name: research-launcher
description: >-
  当 SuperResume 工作流需要对目标公司、职位描述或岗位侧重点进行结构化网页调研时使用。
  本技能负责制定调研计划、征得用户确认，并串行派发相互隔离的浏览器 subagents 执行。
  不要用于单个 URL 的快速查看。
---

# 调研调度器

本技能是 SuperResume 的调研调度器。它会把目标公司 / 岗位 / JD 拆分成有边界的调研任务，通过相互隔离的浏览器 subagents 串行执行，并汇总为有证据支撑的调研摘要。

调研结果遵循尽力而为原则。登录墙、验证码、页面缺失和来源质量不足都属于正常结果。记录一次后继续推进，不要反复纠缠。

## 必须遵循的控制模型

网页收集必须使用**串行且相互隔离的 subagents**。完成一个浏览任务并关闭/释放其任务标签页后，才能开启下一个浏览任务。

| 规则 | 要求 |
|---|---|
| 一个任务，一个 subagent | 每一行调研任务只分配给一个 subagent。 |
| 一个 subagent，一个标签页 | 每个 subagent 启动时必须打开自己的浏览器标签页，并且只使用该标签页。 |
| 不共享浏览器状态 | subagent 不得点击、关闭、复用或检查其他 subagent 的标签页。 |
| 串行启动 | 用户批准计划后，按优先级逐个派发 subagents。上一个任务完成、退出或受限报告返回后，才启动下一个任务。 |
| 有边界地工作 | 每个 subagent 必须遵守 `research-launcher.md` 中的搜索预算。 |
| 控制浏览步长 | 每个任务最多发生 5 次页面跳转；达到上限后必须停止该任务并报告已获取的信息。 |
| 证据优先 | 每条有用结论都要包含来源 URL 和置信度。 |

不要并行启动多个浏览任务。即使宿主环境支持并行 subagents，也必须串行执行，保持“一任务一标签页”和“任务完成后再开启下一个任务”的隔离规则。

## 执行流程

### 阶段 1：确定目标

从用户请求或工作流上下文中提取以下字段：

| 字段 | 是否必需 | 说明 |
|---|---:|---|
| `target_company` | 条件必需 | 如果任务与具体公司相关，则必需。 |
| `target_role` | 条件必需 | 如果任务与具体岗位相关，则必需。 |
| `target_jd` | 可选 | 如果已提供，则跳过 JD 发现，除非用户要求验证。 |

如果公司和岗位都缺失，先进行一次简短澄清，再开始规划。

### 阶段 2：制定调研计划

创建 3-6 个相互独立的任务。每个任务都必须围绕一个明确问题，并给出可能的来源。避免使用“随便看看网站”这类模糊任务。

```markdown
目标公司：<company or unknown>
目标岗位：<role or unknown>

| # | task_id | 调研问题 | 起始来源/搜索词 | 输出 | 优先级 |
|---|---|---|---|---|---|
| 1 | jd-core | ... | ... | ... | P0 |
```

推荐的任务类型：

| 调研角度 | 推荐来源 |
|---|---|
| JD / role requirements | Company careers page, recruiting sites, user-provided JD |
| Technology stack | Company engineering blog, GitHub, official docs, credible interviews |
| Business/domain context | Official website, product pages, reliable company profiles |
| Interview/resume signals | Niuke, Zhihu, Glassdoor-like sources, marked as lower confidence |
| Resume examples/keywords | Public resume advice, role descriptions, job postings |

### 阶段 3：用户确认

展示计划后，等待用户选择：

- `执行`: 运行已批准的计划。
- `调整`: 修改任务行。
- `补充`: 更新目标上下文并重新制定计划。

在得到批准前，不要开始浏览网页。

### 阶段 4：串行派发隔离的浏览器 subagents

每个 subagent prompt 都必须包含下列四个区块。不要只引用 `research-launcher.md` 的路径，必须把它的完整内容粘贴进 prompt。

```text
你是 SuperResume 网页信息检索 subagent。

## 行为规范
<paste the full contents of skills/research-launcher/research-launcher.md>

## 浏览器隔离要求
- 启动后立即创建或选择一个全新的浏览器标签页。
- 本任务期间只使用这个标签页。
- 不读取、不关闭、不复用其他 subagent 的标签页。
- 任务结束时关闭自己创建的标签页；如果遇到登录/验证/人机验证，立即退出并报告需要人工处理。
- 每次导航后先检查 URL 和页面主体，确认没有登录/验证/付费墙。

## 上下文
- target_company: <company or unknown>
- target_role: <role or unknown>
- target_jd: <provided JD summary or none>

## 本次单一任务
- task_id: <task_id>
- research_question: <question>
- starting_sources_or_queries: <sources/queries>
- expected_output: <specific output>
- budget: max 3 query sets, max 3 results per query, max 5 page transitions
```

每次派发 subagent 前的检查清单：

- [ ] 已粘贴完整 `research-launcher.md` 内容。
- [ ] 已说明 browser skill/tool 可用性。
- [ ] 已包含全新标签页隔离规则。
- [ ] 已声明本次调研必须串行执行，不得并行派发。
- [ ] 已声明每个任务最多 5 次页面跳转。
- [ ] 已提供目标公司/岗位/JD 上下文。
- [ ] 单一任务已包含 `task_id`、问题、来源、输出和预算。

执行顺序规则：

1. 按调研计划优先级选择第一个任务。
2. 派发一个 subagent 并等待其返回结果、退出或受限报告。
3. 合并该任务的原始结果到临时摘要。
4. 确认该任务标签页已关闭或不再被使用。
5. 再派发下一个任务。

### 阶段 5：合并结果

当 subagents 返回后，将它们的报告合并成一份调研摘要。必须保留任务状态，不要隐藏失败。

```markdown
## 调研结果

### <company> - <role>

| task_id | 状态 | 关键结论 | 证据质量 |
|---|---|---|---|
| jd-core | 已获取/部分/未获取 | ... | high/medium/low |

### 岗位核心要求
- ...

### 公司/业务/技术方向
- ...

### 简历关注重点
- ...

### 受限或未获取信息
- ...

### Sources
- <title> - <url> - <used for>
```

## 反模式

| 错误做法 | 正确做法 |
|---|---|
| 一个 subagent 处理所有调研 | 每个任务分配一个 subagent |
| 多个 subagents 共用同一个浏览器标签页 | 每个 subagent 创建并拥有自己的标签页 |
| 同时启动多个浏览任务 | 串行执行，完成一个再开启下一个 |
| 单个任务连续跳转很多页面 | 页面跳转最多 5 次，达到上限就停止并报告 |
| 用户批准计划前就开始浏览 | 等待用户输入 `执行` |
| 对登录/验证码页面反复重试 | 停止并报告限制 |
| 编造事实填补空白 | 标记为未找到或低置信度 |
| 把简历写作混入调研 | 只返回调研结果 |

## 退出方式

当由 `/super-resume` 调用时，返回合并后的调研摘要，并把控制权交回主流程。当用户直接调用时，输出摘要并等待用户的下一步指令。
