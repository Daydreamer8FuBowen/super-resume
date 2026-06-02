---
name: research-launcher
description: >-
  Use when the SuperResume workflow requires structured web research on target
  companies, job descriptions, or role-specific resume priorities. This skill
  plans research, gets user confirmation, and dispatches isolated browser
  subagents in parallel. Do NOT use for single-URL quick lookups.
---

# Research Launcher

This skill is the SuperResume research scheduler. It turns a target
company/role/JD into bounded research tasks, runs those tasks through isolated
browser subagents, and returns an evidence-backed research summary.

Research is best-effort. Login walls, captchas, missing pages, and weak sources
are normal results. Record them once and move on.

## Required Control Model

Use **parallel isolated subagents** for web collection.

| Rule | Requirement |
|---|---|
| One task, one subagent | Each research row is assigned to exactly one subagent. |
| One subagent, one tab | Each subagent must open its own browser tab at startup and use only that tab. |
| No shared browser state | A subagent must not click, close, reuse, or inspect another subagent's tab. |
| Parallel launch | After the user approves the plan, dispatch independent subagents in parallel when the platform supports it. |
| Bounded work | Each subagent follows the search budget in `research-launcher.md`. |
| Evidence first | Every useful conclusion includes source URL and confidence. |

If true parallel subagents are not available in the host environment, run the
same task prompts sequentially, but keep the one-task/one-tab isolation rule.

## Process

### Phase 1: Determine Target

Extract these fields from the user request or workflow context:

| Field | Required | Notes |
|---|---:|---|
| `target_company` | Conditional | Required if the task is company-specific. |
| `target_role` | Conditional | Required if the task is role-specific. |
| `target_jd` | Optional | If present, skip JD discovery unless the user requests verification. |

If both company and role are missing, ask one short clarification before planning.

### Phase 2: Build Research Plan

Create 3-6 independent tasks. Each task must have a narrow question and likely
sources. Avoid vague tasks such as "look around the website."

```markdown
目标公司：<company or unknown>
目标岗位：<role or unknown>

| # | task_id | 调研问题 | 起始来源/搜索词 | 输出 | 优先级 |
|---|---|---|---|---|---|
| 1 | jd-core | ... | ... | ... | P0 |
```

Recommended task types:

| Angle | Sources |
|---|---|
| JD / role requirements | Company careers page, recruiting sites, user-provided JD |
| Technology stack | Company engineering blog, GitHub, official docs, credible interviews |
| Business/domain context | Official website, product pages, reliable company profiles |
| Interview/resume signals | Niuke, Zhihu, Glassdoor-like sources, marked as lower confidence |
| Resume examples/keywords | Public resume advice, role descriptions, job postings |

### Phase 3: User Confirmation

Show the plan and wait for the user to choose:

- `执行`: run the approved plan.
- `调整`: revise task rows.
- `补充`: update target context and rebuild the plan.

Do not browse before approval.

### Phase 4: Dispatch Isolated Browser Subagents

Each subagent prompt must include all four blocks below. Do not reference
`research-launcher.md` by path only; paste its full content into the prompt.

```text
你是 SuperResume 网页信息检索 subagent。

## 行为规范
<paste the full contents of skills/research-launcher/research-launcher.md>

## 浏览器隔离要求
- 启动后立即创建或选择一个全新的浏览器标签页。
- 本任务期间只使用这个标签页。
- 不读取、不关闭、不复用其他 subagent 的标签页。
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
- budget: max 3 query sets, max 3 results per query, max 5 pages
```

Dispatch checklist before every subagent:

- [ ] Full `research-launcher.md` content is pasted.
- [ ] Browser skill/tool availability is stated.
- [ ] A fresh-tab isolation rule is present.
- [ ] Target company/role/JD context is present.
- [ ] The single task has a `task_id`, question, sources, output, and budget.

### Phase 5: Merge Results

After subagents return, merge their reports into one research summary. Keep task
status visible and do not hide failures.

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

## Anti-Patterns

| Forbidden | Correct |
|---|---|
| One subagent handles all research | One task per subagent |
| Multiple subagents share the same browser tab | Each subagent creates and owns one tab |
| Browse before user approves the plan | Wait for `执行` |
| Keep retrying login/captcha pages | Stop and report restriction |
| Invent facts to fill gaps | Mark as not found or low confidence |
| Mix resume writing into research | Return research only |

## Exit

When called by `/super-resume`, return the merged research summary and control
back to the main workflow. When called directly, output the summary and wait for
the user's next instruction.
