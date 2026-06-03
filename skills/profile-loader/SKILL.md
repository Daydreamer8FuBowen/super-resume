---
name: profile-loader
description: SuperResume 的简历 profile JSON 读取与持久化协议技能。底层持久化层——提供 schema、存储路径以及简历 profile JSON 的读写/合并操作，供 base-profile-editor、resume-beautify 和 super-resume 内部调用。不要用于工作流级简历操作；完整流程请使用 /super-resume。
---

# Profile Loader 持久化协议

本技能定义 SuperResume 如何存储、读取、提取和更新简历 profile JSON 文件。它是一个持久化与 schema 层技能：把简历事实保存在稳定结构中，让其他简历技能在写作、定制、审查或格式化时复用这些事实，同时不丢失来源信息。

## 适用范围

以下情况应使用本技能：

- 从粘贴文本、上传简历、笔记、聊天记录或现有 profile JSON 中提取简历事实。
- 在依赖已保存事实的简历工作开始前，读取基础档案或目标档案。
- 将新事实写入正确的 JSON profile。
- 将更新合并到现有 profile 中，同时不删除未知或无关信息。
- 为特定公司、岗位、JD 或简历版本创建目标 JSON profile。
- 说明 profile JSON 文件存放在哪里，以及下一步应该使用哪个文件。

以下情况不应使用本技能：

- 编造经历、指标、日期、学校、公司、证书或技能。
- 单独撰写最终润色后的简历内容。
- 单独判断简历质量。
- 单独格式化简历文档。
- 单独抓取职位描述。

如果任务既涉及持久化，又涉及写作、审查或定制，应先使用本技能加载或更新 profile JSON，再交给对应的写作/审查/定制流程。

## 工具限制

本技能只允许读取 profile JSON 文件，并且只运行仓库内置的 profile 持久化工具。避免使用临时 shell 管道或外部 JSON 改写器。

| 允许 | 禁止 |
|---------|-----------|
| 读取 profile JSON 文件 | 无关 shell 命令 |
| 创建小型 patch JSON 文件 | `jq`、一次性 Python 改写脚本或自定义 shell 文本处理 |
| 运行 `node skills/profile-loader/profile-store.mjs ...` | 当小 patch 足够时，手工编辑大型 profile JSON |
| 运行 `node skills/profile-loader/validate-profile.mjs ...` | 任何抓取器、浏览器操作或简历写作动作 |

**规则：**
- 写入时尽可能使用 `profile-store.mjs`。
- 凡是没有通过 `profile-store.mjs` 处理的写入路径，都要使用 `validate-profile.mjs` 校验。
- 不要从这个持久化层调用无关命令或其他技能。
- 当冲突影响重要事实时，写入冲突字段前必须先询问用户。

## 稳定的持久化工具链

大型简历 JSON 文件由 Agent 整体重写时很容易出错。优先使用仓库内置的持久化工具：

```bash
# 将一个小 patch 合并进基础 profile，并自动校验。
node skills/profile-loader/profile-store.mjs merge --profile base --patch patch.json

# 将一个小 patch 合并进目标 profile，并自动校验。
node skills/profile-loader/profile-store.mjs merge --profile target --id <company-role> --patch patch.json

# 合并到显式指定的文件。
node skills/profile-loader/profile-store.mjs merge --file data/profiles/base.json --schema base --patch patch.json
```

**对 Agent 的强制要求：**

- 生成尽可能小的 patch JSON，不要重写整个 profile。
- 让 `profile-store.mjs` 负责合并、格式化、原子写入和校验。
- 如果校验失败，修复 patch 后重新运行同一条命令。
- patch 中的 `null` 表示删除；只有确实要删除字段时才使用。
- patch 中的数组会替换 profile 中的数组；修改数组时必须包含完整的目标数组。

## JSON 校验

每次 JSON 写入后，都必须使用内置脚本执行校验：

```
node skills/profile-loader/validate-profile.mjs <file.json> --schema <base|target>
```

| 文件类型 | Schema 参数 |
|-----------|-------------|
| `data/profiles/base.json` | `--schema base` |
| `data/profiles/targets/*.json` | `--schema target` |

**校验规则：**
- **写入前：** 不强制要求（数据还在构造中）。
- **写入后：** 强制执行——调用方必须运行校验器。如果校验失败（退出码 1），必须修复写入内容并重新校验后才能继续。
- **Warnings**（💡）是建议项，不阻塞写入。**Errors**（❌）是阻塞项，必须修复。

**示例校验流程：**

```
1. 本技能通过 Write/Edit tool 写入 base.json
2. 调用方运行：node skills/profile-loader/validate-profile.mjs data/profiles/base.json --schema base
3. 如果 ❌ → 读取错误，修复 JSON，重新写入，重新校验
4. 如果 ✅ → 持久化完成
```

校验器会检查：
- JSON 语法（可解析、有效 UTF-8、无尾随逗号、无注释）
- 每类 schema 要求的顶层 key
- 字段类型（string / array / object）
- 日期格式是否符合 YYYY-MM-DD
- 同一 section 内以及跨 section 的 ID 唯一性
- `confidence` 字段枚举值
- 已知技能分类名称

## 存储结构

用户简历 profile 存放在项目工作目录下，而不是插件的 `skills/` 目录中：

```text
<项目根目录>/
└── data/profiles/
    ├── base.json
    └── targets/
        ├── <company>-<role>.json
        └── <company>-<role>-<date>.json
```

> 这与插件内部使用的 JSON 文件不同（例如 `skills/resume-visualizer/sample-base.json` 和模板元数据）。插件内部 JSON 属于 visualizer 自身，绝不包含用户数据。

### 文件含义

| 文件 | 含义 | 适用场景 |
|---|---|---|
| `data/profiles/base.json` | 最完整、直接、保留事实的来源 profile。 | 用户提供新的简历事实、要求保存信息，或需要一个通用简历事实源。 |
| `data/profiles/targets/<company>-<role>.json` | 从 `base.json` 派生、面向特定公司/岗位/JD 的定制 profile。 | 用户要求为特定目标适配、优化或维护简历内容。 |

基础 profile 是唯一事实源。目标 profile 可以筛选、重排、强调或重写定位表达，但不能改变事实。目标 profile 中的每条 claim 都应能追溯到 `base.json`，或追溯到清楚记录的用户来源。

## 证据约定

对高强度简历 claim 使用以下简洁标签：

| 字段 | 取值 |
|---|---|
| `claim_level` | `C0` aware/participated, `C1` owned module, `C2` designed/optimized, `C3` measured impact |
| `truth_status` | `supported`, `careful`, `needs_evidence`, `unsupported`, `unknown` |
| `interview_risk` | `low`, `medium`, `high` |

没有指标证据时，不要写入 C3 级影响类 claim。若当前证据只支持更保守的说法，应使用 `safe_wording`。

## 读写协议

只要涉及 profile JSON，就遵循以下协议。

1. **判断请求类型**
   - 通用事实、原始简历录入、长期事实源更新使用 `base.json`。
   - 公司/岗位特定适配使用 `targets/<company>-<role>.json`。
   - 如果用户提到公司或岗位，但目标 profile 不存在，并且信息足够，则创建一个从 `base.json` 派生的目标 profile。

2. **修改前先读取**
   - 更新现有 JSON 文件前必须先读取它。
   - 保留与本次更新无关的字段。
   - 如果文件不存在，按下面的 schema 创建。

3. **保守提取事实**
   - 原始事实内容尽量贴近来源。
   - 缺失信息使用 `null`、空数组或 `confidence: "unknown"`。
   - 除非来源明确说明，不要推断日期、公司名、学历、指标或技术。

4. **优先合并，不要整体替换**
   - 描述不同经历时新增条目。
   - 用户澄清同一段经历时更新现有条目。
   - 除非用户明确要求删除，否则保留既有原始来源备注。

5. **通过持久化工具写入**
   - 优先使用 `profile-store.mjs` + 小 patch，不要整文件重写。
   - 该工具会原子写入并自动校验。
   - 如果调用方通过其他方式写入，必须手动运行 `validate-profile.mjs`。

6. **写入合法 JSON**
   - JSON 必须可解析。
   - 使用双引号。
   - JSON 文件中不得包含注释。
   - 可重复引用的条目尽量保持稳定 ID。
   - 写入后，调用方必须运行 `node skills/profile-loader/validate-profile.mjs <file> --schema <base|target>`。校验错误（❌）是阻塞项。

6. **汇报持久化结果**
   - 说明读取或写入了哪个文件。
   - 汇总新增、更新和未变化的 section。
   - 列出仍缺失或不确定、可能需要用户澄清的字段。

## 基础 Profile Schema

对 `data/profiles/base.json` 使用如下结构。

```json
{
  "schema_version": "1.0.0",
  "profile_type": "base",
  "profile_id": "base",
  "last_updated": "YYYY-MM-DD",
  "personal_info": {
    "full_name": null,
    "preferred_name": null,
    "headline": null,
    "location": null,
    "phone": null,
    "email": null,
    "links": {
      "github": null,
      "linkedin": null,
      "portfolio": null,
      "website": null,
      "other": []
    }
  },
  "career_objective": {
    "target_roles": [],
    "target_industries": [],
    "summary_facts": []
  },
  "education": [
    {
      "id": "edu-001",
      "school": null,
      "degree": null,
      "major": null,
      "minor": null,
      "location": null,
      "start_date": null,
      "end_date": null,
      "gpa": null,
      "courses": [],
      "honors": [],
      "activities": [],
      "source_notes": []
    }
  ],
  "work_experience": [
    {
      "id": "work-001",
      "company": null,
      "role": null,
      "employment_type": null,
      "location": null,
      "start_date": null,
      "end_date": null,
      "is_current": false,
      "team": null,
      "business_context": null,
      "responsibilities": [],
      "achievements": [
        {
          "claim": null,
          "metric": null,
          "evidence": null,
          "technologies": [],
          "confidence": "unknown"
        }
      ],
      "source_notes": []
    }
  ],
  "internships": [
    {
      "id": "intern-001",
      "company": null,
      "role": null,
      "location": null,
      "start_date": null,
      "end_date": null,
      "responsibilities": [],
      "achievements": [],
      "technologies": [],
      "source_notes": []
    }
  ],
  "projects": [
    {
      "id": "project-001",
      "name": null,
      "type": null,
      "role": null,
      "start_date": null,
      "end_date": null,
      "context": null,
      "problem": null,
      "actions": [],
      "results": [],
      "metrics": [],
      "technologies": [],
      "links": [],
      "source_notes": []
    }
  ],
  "skills": {
    "programming_languages": [],
    "frameworks": [],
    "tools": [],
    "platforms": [],
    "databases": [],
    "methodologies": [],
    "domain_skills": [],
    "soft_skills": []
  },
  "certifications": [
    {
      "id": "cert-001",
      "name": null,
      "issuer": null,
      "date": null,
      "expiry_date": null,
      "credential_id": null,
      "url": null,
      "source_notes": []
    }
  ],
  "awards": [
    {
      "id": "award-001",
      "name": null,
      "issuer": null,
      "date": null,
      "description": null,
      "source_notes": []
    }
  ],
  "languages": [
    {
      "language": null,
      "proficiency": null,
      "evidence": null
    }
  ],
  "publications": [],
  "portfolio": [],
  "resume_preferences": {
    "preferred_language": null,
    "resume_length": null,
    "tone": null,
    "constraints": [],
    "avoid": []
  },
  "raw_sources": [
    {
      "id": "source-001",
      "type": "paste | file | chat | url | manual",
      "description": null,
      "captured_at": "YYYY-MM-DD",
      "content_summary": null,
      "path_or_url": null
    }
  ],
  "metadata": {
    "created_at": "YYYY-MM-DD",
    "updated_at": "YYYY-MM-DD",
    "notes": []
  }
}
```

## 目标 Profile Schema

对 `data/profiles/targets/<company>-<role>.json` 使用如下结构。

```json
{
  "schema_version": "1.0.0",
  "profile_type": "targeted",
  "profile_id": "<company>-<role>",
  "source_profile": "data/profiles/base.json",
  "last_updated": "YYYY-MM-DD",
  "target": {
    "company": null,
    "role": null,
    "industry": null,
    "job_description_source": null,
    "job_description_summary": null,
    "keywords": [],
    "priorities": [],
    "adaptation_notes": []
  },
  "selected_profile": {
    "personal_info": {},
    "summary_positioning": [],
    "education_ids": [],
    "work_experience_ids": [],
    "internship_ids": [],
    "project_ids": [],
    "skill_groups": {},
    "certification_ids": [],
    "award_ids": []
  },
  "tailored_content": {
    "headline": null,
    "summary": null,
    "experience_bullets": [],
    "project_bullets": [],
    "skills_section": [],
    "notes_for_resume_writer": []
  },
  "fact_traceability": [
    {
      "tailored_claim": null,
      "source_profile_path": "data/profiles/base.json",
      "source_section": null,
      "source_id": null,
      "confidence": "unknown",
      "claim_level": "C0",
      "truth_status": "unknown",
      "safe_wording": null,
      "interview_risk": "medium"
    }
  ],
  "metadata": {
    "created_at": "YYYY-MM-DD",
    "updated_at": "YYYY-MM-DD",
    "notes": []
  }
}
```

## 提取规则

将简历内容转换为 JSON 时：

- 将事实拆分到最具体的匹配 section。
- 如果同时提供了中文和英文姓名或标题，都要保留。
- 当日期无法确定如何规范化时，按原文保留。
- 可量化结果写入 `achievements[].metric` 或 `projects[].metrics`。
- 对后续验证有帮助的证据或来源措辞写入 `source_notes`。
- 如果一个 bullet 同时包含动作、技术和结果，尽可能拆成 `actions`、`technologies` 和 `results`。
- 如果某个细节很重要但不适配 schema，放入 `metadata.notes` 或最接近条目的 `source_notes`，不要丢弃。

## 更新示例

### 示例 1：保存一个新项目到基础 profile

输入：

```text
保存这个项目：SuperResume，Claude Code 插件，负责简历写作、评价和岗位适配。我做了 browser skill 和 profile-loader skill。
```

处理动作：

1. 如果 `data/profiles/base.json` 存在，先读取它。
2. 在 `projects` 中新增或更新一个条目。
3. 写入 `data/profiles/base.json`。
4. 汇报变更的项目字段，以及缺失的日期、指标、技术等细节。

### 示例 2：创建一个目标 profile

输入：

```text
基于我的基础简历，为字节跳动前端开发岗位维护一个 JSON 版本。
```

处理动作：

1. 读取 `data/profiles/base.json`。
2. 创建 `data/profiles/targets/bytedance-frontend-developer.json`。
3. 填写 `target.company`、`target.role`、选中的 ID、关键词和适配备注。
4. 不要编造缺失的 JD 细节；如有需要，向用户索要 JD。

### 示例 3：合并澄清后的信息

输入：

```text
刚才那个实习是 2025 年 6 月到 2025 年 9 月，在上海，不是北京。
```

处理动作：

1. 找到最可能对应的实习条目。
2. 读取当前 profile JSON。
3. 只更新该条目的 `start_date`、`end_date` 和 `location`。
4. 保留无关的职责和成果。
5. 如果多个条目都可能匹配，写入前先询问用户是哪一个。

## 歧义处理

以下情况中，写入前应先进行简短澄清：

- 多个现有条目都可能匹配用户的更新。
- 用户想创建目标 profile，但缺少公司或岗位。
- 某个事实会覆盖冲突的现有值。
- 来源暗示敏感或高影响 claim，但证据不足。

除此之外，应写入当前最合理的结构化版本，并清楚标注不确定字段。

## 完成消息

任何读写操作后，按以下结构回复：

```text
已处理 profile JSON。

读取：<paths>
写入：<paths>

更新摘要：
- <section>: <added/updated/unchanged>

仍缺信息：
- <field or section, if any>

下一步建议：<what resume workflow can use this profile next>
```
