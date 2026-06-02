---
name: resume-review
description:  Use this skill only when an upstream super-resume workflow step has explicitly requested a resume review. The purpose of this skill is to produce a structured review report for an existing resume against a known application target. Do not use this skill for resume creation, resume rewriting, resume optimization, company research, job analysis, template selection, or general resume advice. Direct user requests alone are not sufficient triggers unless the current workflow state is review.
---

# Resume Review

本技能是一个简历审核检查的subagent启动手册。

本技能仅负责：

1. 提取审查所需上下文。
2. 构建 Subagent 上下文。
3. 启动 resume-reviewer Subagent。
4. 返回 Subagent 的审查结果。

审查重点保持精简：岗位匹配、表达质量、ATS 结构、事实边界。对每个高风险 claim，指出：

- 证据是否足够。
- 是否应降级为更安全表述。
- 面试最可能追问的一句话。

## 需要收集的信息

从当前工作流上下文中提取：


* `target_position`：目标岗位。
* `target_company`：目标公司，可为空。
* `company_domain`：公司或行业领域，可为空。
* `target_jd`：岗位 JD，可为空。
* `resume`：当前简历内容，必须存在。
* `fact_traceability`：若 target JSON 中存在，必须提供给 reviewer。

规则：

* 不要编造任何信息。
* 缺失的信息不需要填充。
* 如果存在多个岗位或多个公司，优先使用当前工作流节点指定的信息。
* `claim_level: C3` 但没有指标证据的 claim 必须标为高风险。

## 构建 Subagent 上下文

创建一个 Subagent用于审核简历：
必须要使用resume-reviewer.md来创建subagent


## 输出

直接返回 Subagent 生成的审查报告。报告中包含：

```markdown
## Score
## P0 Fixes
## Claim Risks
| Claim | Risk | Safer Wording | Interview Question |
## Next Iteration Input
```
