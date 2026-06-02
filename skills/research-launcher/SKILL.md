---
name: research-launcher
description: >-
  Use when the SuperResume workflow requires structured research on target companies, job descriptions,
  or role-specific resume priorities. Also use when the user directly requests company/industry/role
  research before resume writing or tailoring. Do NOT use for single-URL quick lookups or simple
  fact-checking that doesn't need a research plan.
---

# Research Launcher

本技能是 SuperResume 工作流中的调研调度器。不直接访问网页，只负责：确定目标 → 制定计划 → 用户确认 → 调度 subagent 执行 → 整理结果。

调研是**尽力而为**的信息收集——网站打不开、需要登录、信息不存在都是正常结果，不强求完整，不反复重试。遇到困难如实记录即可。

## When to Use

- SuperResume 工作流调度调研节点
- 用户主动请求："帮我研究这家公司"、"这个 JD 需要关注什么"
- 用户已有目标但缺少足够信息开始写简历

**不使用：** 单个 URL 浏览（用 `browser` 技能）、用户已提供完整 JD 和公司信息、简单事实查询。

## The Process

严格顺序的 5 阶段流程。不可跳过，不可并行。

### 阶段 1：确定目标

从上下文或用户输入中提取目标。缺失则直接提问。

| 字段 | 必须 |
|------|------|
| `target_company` | 条件必须（至少有一个目标） |
| `target_role` | 条件必须（至少有一个目标） |
| `target_jd` | 可选（有则跳过 JD 调研） |

**规则：** 不编造信息。用户已有 JD 则跳过 JD 调研。公司和岗位都缺失时提问。

### 阶段 2：制定计划

```text
目标公司：<company> | 目标岗位：<role>

| # | 任务 | 目标网站 | 调研内容 | 优先级 |
|---|------|----------|----------|--------|
| 1 | ...  | ...      | ...      | 高/中/低 |
```

**约束：** 总任务 3-6 个。每个任务有明确的调研内容（禁止"看看网站"）。只调研与简历直接相关的：技术栈、业务方向、岗位核心要求、团队文化、关键词。不调研融资、股价等无关信息。

**建议来源：** 根据调研角度选择平台：

| 角度 | 来源 |
|------|------|
| JD / 岗位要求 | 招聘网站（BOSS 直聘、公司招聘官网） |
| 公司评价 / 技术氛围 / 面试经验 | 知乎 |
| 公司文化 / 职场日常 / 办公环境 | 小红书 |
| 技术栈 / 业务方向 | 公司技术博客、GitHub、官网 |

优先选信息密度高的平台，每个角度 1-2 个来源即可。

### 阶段 3：用户确认

呈现计划，等待用户选择：**执行**（进入阶段 4）/ **调整**（回到阶段 2）/ **补充**（更新阶段 1 后回到阶段 2）。

未确认绝不执行。

### 阶段 4：调度 Subagent

**核心规则：** 每个任务一个独立 subagent，一次只跑一个，等上一个完成再启动下一个。

#### ⚠️ Subagent 提示词构建规范

> **这是阶段 4 最重要的规则。遗漏 `research-launcher.md` 会导致 subagent 行为完全失控（无搜索预算、不会终止、编造信息）。**

**每个 subagent 的提示词必须包含以下 4 项，不可跳过任何一项：**

| # | 内容 | 来源 | 作用 |
|---|------|------|------|
| 1 | 行为规范 | `skills/research-launcher/research-launcher.md` 全文 | 工具限制、登录检测、搜索预算、证据规则、完成规则 |
| 2 | 浏览器工具 | `browser` 技能 | 提供 Playwright MCP 浏览器自动化能力 |
| 3 | 上下文 | 阶段 1 输出 | 目标公司、岗位、已有 JD |
| 4 | 本次任务 | 阶段 2 计划中的对应行 | 目标 URL、调研内容、预期输出格式 |

**必须使用以下模板构建 subagent 提示词（逐项填充，不可省略）：**

```text
你是网页信息检索 subagent。

## 行为规范（最高优先级，覆盖所有其他指令）
复制 skills/research-launcher/research-launcher.md 的全部内容到此处。

## 工具
加载 browser 技能。

## 上下文
- 目标公司：<fill>
- 目标岗位：<fill>
- 已有 JD：<fill 或 "无">

## 本次任务
- 目标网站：<fill>
- 调研内容：<fill>
- 预期输出：<fill>
```

#### 调度前自检清单

每次创建 subagent 前，逐一确认：

- [ ] 提示词中包含 `research-launcher.md` 全文？（不是引用路径，是完整内容）
- [ ] 提示词中包含 `browser` 技能？
- [ ] 提示词中包含目标公司和岗位？
- [ ] 提示词中包含本次任务的具体 URL 和调研内容？

**任何一项未满足 → 补充后再调度。不允许带缺陷调度。**

加载顺序：先加载 `research-launcher.md` 建立行为约束，再加载 `browser` 技能提供工具，最后注入本次任务上下文。顺序颠倒会导致约束无法生效。

**中断处理：** subagent 返回人工介入请求时，通知用户并等待确认后重新调度。

**失败处理：** 单个任务失败时问用户：重试 / 跳过 / 换网站。超时 5 分钟报告用户。

### 阶段 5：整理结果

按以下结构整理，标注每个信息的获取状态（已获取 / 部分 / 未获取）：

```markdown
## 调研结果

### <company> - <role>

**岗位核心要求**：<关键要求、技术栈、经验>
**公司技术方向**：<业务、技术栈、团队方向、匹配点>
**简历关注重点**：<应突出的技能、经历类型、关键词>
**补充**：<文化、团队规模等影响简历风格的信息>
```

## Anti-Patterns

| 禁止 | 正确做法 |
|------|----------|
| 跳过计划直接执行 | 严格按阶段顺序 |
| 不断追加任务"再多查一点" | 计划即边界，完成后停止 |
| 单 subagent 打包所有任务 | 每个任务一个独立 subagent |
| 自行决定下一步（工作流调度时） | 交还控制权给 SuperResume 主流程 |
| 遗漏 `research-launcher.md` 就调度 subagent | 每次调度前完成自检清单，确认 4 项提示词内容齐全 |
| 用引用路径代替完整内容 | 必须加载 `research-launcher.md` **全文**，不是"参考 research-launcher.md" |

## 退出

**SuperResume 工作流调度时：** 返回调研结果和控制权，不自行决定下一步。

```text
调研节点完成。目标：<company> - <role>
任务：<N> 个 | 成功：<N> | 部分：<N> | 未获取：<N>
返回 SuperResume 主流程。
```

**用户直接调用时：** 输出总结 + 关键发现表后结束，等待用户下一步指令。

```text
调研完成。目标：<company> - <role>
任务：<N> 个 | 成功：<N> | 部分：<N> | 未获取：<N>

## 关键发现
| 类别 | 核心信息 |
|------|----------|
| 技术栈 | ... |
| 岗位重点 | ... |
| 匹配点 | ... |
```
