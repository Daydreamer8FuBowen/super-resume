---
name: resume-review
description:  仅当上游 super-resume 工作流明确请求简历评审时使用。本技能用于针对已知投递目标，对现有简历生成结构化评审报告。不要用于简历创建、简历重写、简历优化、公司调研、岗位分析、模板选择或泛化简历建议。仅有用户直接请求并不足以触发，除非当前工作流状态已进入 review。
---

# 简历评审

本技能是一个简历审核检查的子代理启动手册。

本技能仅负责：

1. 提取审查所需上下文。
2. 构建子代理上下文。
3. 启动 resume-reviewer 子代理。
4. 返回子代理的审查结果。

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

## 构建子代理上下文

创建一个子代理用于审核简历：
必须使用 `resume-reviewer.md` 来创建子代理


## 输出

直接返回 Subagent 生成的审查报告。报告中包含：

```markdown
## Score
## P0 Fixes
## Claim Risks
| Claim | Risk | Safer Wording | Interview Question |
## Next Iteration Input
```
