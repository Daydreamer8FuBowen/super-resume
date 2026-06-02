---
name: base-profile-editor
description: Personal base resume profile completion, intake, add, edit, and conflict-resolution workflow for SuperResume. MUST use this skill when the user wants to import an old resume, extract resume facts from messy PDF/Word-converted text, complete missing base resume information, add a described experience/project/education item, correct existing resume facts, or update the user's foundational resume profile. This skill MUST use profile-loader for every read/write/merge of resume JSON and only updates data/profiles/base.json, not targeted company/role profiles.
---

# Base Profile Editor

This skill turns user-provided resume information into accurate updates to the foundational SuperResume profile at `data/profiles/base.json`. It is the intake and editing layer for the user's base resume facts.

Use `profile-loader` for all JSON persistence. This skill decides what facts to extract, how to repair messy input, when to ask conflict questions, and how to prepare the update; `profile-loader` provides the schema, storage paths, and read/write protocol.

## Scope

Use this skill to:

- Import old resume content into `data/profiles/base.json`.
- Extract facts from pasted resume text, Word text, PDF-to-Word text, OCR-like text, or fragmented notes.
- Reconstruct likely sections when layout is broken, characters are out of order, bullets are merged, or columns were flattened.
- Add a new project, internship, work experience, education item, skill, certificate, award, portfolio link, or contact detail from natural-language descriptions.
- Modify or correct existing base profile facts.
- Detect conflicts with the existing base profile and ask the user which version is correct before overwriting important facts.
- Produce a concise update summary and list missing information that would improve the base profile.

Do not use this skill to:

- Create targeted company/role resume profiles. Use `profile-loader` targeted profile flow for that.
- Write the final polished resume document.
- Rewrite bullets for a specific job description.
- Score or critique the resume.
- Invent facts, dates, metrics, degrees, companies, titles, or tools.

## Required Dependency: profile-loader

Before reading, creating, or modifying resume JSON, use the `profile-loader` skill.

Required storage target:

```text
data/profiles/base.json
```

This skill never writes targeted versions under `data/profiles/targets/`. If the user asks for company/role adaptation, first ensure `base.json` is up to date, then route the adaptation to the appropriate targeted-profile workflow.

## Operating Workflow

### 1. Classify the user input

Decide which intake mode applies:

| Mode | User input examples | Main action |
|---|---|---|
| Old resume import | “这是我的旧简历”, pasted resume text, PDF/Word text | Extract all identifiable base facts and merge into `base.json`. |
| Messy conversion repair | Broken columns, wrong line order, merged bullets, odd spacing | Infer the most likely resume sections and preserve uncertainty. |
| Natural-language add | “我还做过一个项目…”, “把这个实习加进去” | Convert the description into a structured entry and add it. |
| Correction | “时间写错了”, “不是北京，是上海” | Find the likely existing entry and update only the corrected fields. |
| Completion | “帮我补全基础简历”, “这些信息写入档案” | Add missing sections and ask for high-value missing facts. |

### 2. Load the current base profile

Use `profile-loader` to read `data/profiles/base.json`.

- If it exists, preserve all unrelated fields.
- If it does not exist, create it using the base schema from `profile-loader`.
- Treat existing IDs as stable references. Do not rename IDs without need.

### 3. Reconstruct messy resume text

When input appears to come from PDF, Word conversion, OCR, or copied resume layout:

- Look for section anchors in Chinese and English, such as `教育经历`, `项目经历`, `实习经历`, `工作经历`, `技能`, `证书`, `Education`, `Projects`, `Experience`, `Skills`.
- Use dates, company/school names, role titles, bullet markers, and technology names to regroup text.
- Repair common column-copy issues where dates, titles, and descriptions appear on separate lines.
- Treat adjacent lines with shared dates/company/project names as the same entry when reasonable.
- Preserve uncertain reconstruction in `source_notes` rather than pretending it is certain.
- If reconstruction affects a critical fact, ask the user to confirm before writing.

Do not overfit to layout. The goal is a faithful base fact record, not a pretty resume.

### 4. Extract facts into profile-loader schema fields

Map information to the closest `profile-loader` base schema section:

| Information | Destination |
|---|---|
| Name, email, phone, location, links | `personal_info` |
| Target direction or career summary facts | `career_objective` |
| School, degree, major, GPA, courses | `education` |
| Full-time roles | `work_experience` |
| Internships | `internships` |
| Academic, personal, open-source, product, or engineering projects | `projects` |
| Programming languages, frameworks, tools, platforms | `skills` |
| Certificates | `certifications` |
| Competitions, scholarships, honors | `awards` |
| Languages | `languages` |
| Websites, GitHub repos, demos, portfolios | `portfolio` or `personal_info.links` |

For each experience or project, try to capture:

- Name/title
- Organization/company/school context
- Role
- Start and end dates
- Problem or background
- Actions taken
- Technologies used
- Results or metrics
- Source notes from the user's original wording

### 5. Add from natural-language descriptions

When the user describes something conversationally:

1. Identify the most likely section.
2. Create or update a structured entry.
3. Keep the user's original wording in `source_notes` when it helps preserve nuance.
4. Normalize only obvious structure; do not fabricate missing dates, metrics, or technology.
5. Ask only for missing information that blocks correct placement or causes ambiguity.

Example:

Input:

```text
我还做过一个校园二手交易小程序，用 Vue 和 Spring Boot，主要负责前端和商品发布流程。
```

Expected structured interpretation:

- Section: `projects`
- Name: `校园二手交易小程序`
- Role: frontend / product flow contributor, if the wording supports it
- Technologies: `Vue`, `Spring Boot`
- Actions: front-end implementation, product publishing flow
- Missing: date, measurable result, link

### 6. Detect conflicts before overwriting

A conflict exists when new input disagrees with an existing important value.

Always ask the user before overwriting conflicts in:

- Name
- Email or phone
- School
- Degree or major
- Company
- Role/title
- Start or end date
- Location
- Certificate name or issuer
- Project ownership or project type
- Metrics or quantified outcomes

Conflict question format:

```text
我发现这次信息和现有基础档案有冲突：

字段：<field>
现有：<existing value>
新输入：<new value>

请确认以哪个为准？
1. 保留现有
2. 使用新输入
3. 两者都保留，并加备注说明
```

Do not write the conflicting field until the user answers. Non-conflicting additions can still be prepared, but make clear what is waiting on confirmation.

### 7. Merge safely

Use these merge rules:

- Add a new entry when company/project/school + dates/title indicate a distinct item.
- Update an existing entry when the user clearly refers to it.
- Append technologies and skills without duplicates.
- Append source notes rather than replacing them.
- Preserve old facts if the new input is vague.
- Mark uncertain fields with `confidence: "unknown"` or note uncertainty in `source_notes`.
- Prefer `null` or empty arrays over guessed values.

### 8. Write through profile-loader

After extraction and conflict resolution:

1. Use `profile-loader` to write or merge into `data/profiles/base.json`.
2. Ensure the result remains valid JSON.
3. Preserve unrelated sections.
4. Update `metadata.updated_at` and `last_updated` using the current date.
5. Add a `raw_sources` entry for substantial imported content when useful.

## Completion Response

After processing, respond in this structure:

```text
已更新基础简历档案。

使用的 skill：profile-loader
读取：data/profiles/base.json
写入：data/profiles/base.json

更新摘要：
- 个人信息：<added/updated/unchanged>
- 教育经历：<added/updated/unchanged>
- 工作/实习：<added/updated/unchanged>
- 项目：<added/updated/unchanged>
- 技能/证书/奖项：<added/updated/unchanged>

需要确认的冲突：
- <conflict list, if any>

建议补充的信息：
- <missing high-value fields, if any>
```

If no file was written because conflicts require confirmation, say so clearly.

## Examples

### Example 1: Import messy old resume text

Input:

```text
这是 PDF 转出来的，有点乱：
2022.09-2026.06 计算机科学 本科
张三 phone 138... email ...
项目 经历 SuperResume Claude Code 插件 browser skill profile-loader
React Node.js Python
```

Behavior:

1. Use `profile-loader` to read `data/profiles/base.json`.
2. Reconstruct likely personal, education, project, and skill sections.
3. Write clear facts.
4. Put uncertain reconstruction details in `source_notes`.
5. Ask only if a critical field conflicts with existing data.

### Example 2: Add a project from description

Input:

```text
把这个项目加到我的基础简历：我做了一个 AI 简历插件 SuperResume，主要实现了浏览器自动化 skill 和 profile-loader，用来保存简历 JSON。
```

Behavior:

1. Use `profile-loader` to load base profile.
2. Add or update `projects` entry for `SuperResume`.
3. Capture technologies only if stated or already known from existing context.
4. Ask for missing date/metrics if useful, but do not block writing the provided facts unless placement is ambiguous.

### Example 3: Correct conflicting information

Input:

```text
把我的实习地点改成上海。
```

Behavior:

- If there is one internship, update its location through `profile-loader`.
- If there are multiple internships, ask which internship to modify.
- If existing location is different, ask whether to replace it with 上海 or keep both with notes.

## Test Prompts

Use these prompts to test the skill manually:

1. `这是我旧简历复制出来的内容，顺序有点乱：<paste messy resume text>，帮我写入基础简历档案。`
2. `我补充一个项目：<natural language project description>，保存到我的基础简历。`
3. `刚才那个实习时间不是 2024.06-2024.09，是 2025.06-2025.09，帮我改一下。`
