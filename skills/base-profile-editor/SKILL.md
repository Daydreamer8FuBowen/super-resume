---
name: base-profile-editor
description: SuperResume 的基础简历档案补全、导入、添加、编辑与冲突处理工作流。MUST use this skill when the user wants to import an old resume, extract resume facts from messy PDF/Word-converted text, complete missing base resume information, add a described experience/project/education item, correct existing resume facts, or update the user's foundational resume profile. 本技能必须通过 profile-loader 完成所有 resume JSON 的读取/写入/合并，并且只更新 data/profiles/base.json，不写入目标公司/岗位 profile。
---

# 基础档案编辑器

本技能负责把用户提供的简历信息转换为对 SuperResume 基础档案 `data/profiles/base.json` 的准确更新。它是用户基础简历事实的录入与编辑层。

所有 JSON 持久化都应通过 `profile-loader` 完成。本技能负责判断该提取哪些事实、如何修复杂乱输入、何时发起冲突确认以及如何准备更新；`profile-loader` 负责 schema、存储路径与读写协议。

## 适用范围

以下情况应使用本技能：

- 将旧简历内容导入 `data/profiles/base.json`。
- 从粘贴的简历文本、Word 文本、PDF 转 Word 文本、类似 OCR 的文本或碎片化笔记中提取事实。
- 当版式破碎、字符顺序错乱、bullet 合并或多栏内容被拍平时，重建可能的简历 section。
- 从自然语言描述中新增项目、实习、工作经历、教育条目、技能、证书、奖项、作品集链接或联系方式。
- 修改或纠正现有基础 profile 事实。
- 检测与现有基础 profile 的冲突，并在覆盖重要事实前询问用户哪个版本正确。
- 产出简洁的更新摘要，并列出能提升基础 profile 质量的缺失信息。

以下情况不应使用本技能：

- 创建目标公司/岗位简历 profile。此类任务应使用 `profile-loader` 的 targeted profile 流程。
- 撰写最终润色后的简历文档。
- 针对特定 JD 改写 bullet。
- 给简历打分或进行批判性审查。
- 编造事实、日期、指标、学历、公司、title 或工具。

## 必要依赖：profile-loader

读取、创建或修改 resume JSON 前，必须使用 `profile-loader` skill。

固定写入目标：

```text
data/profiles/base.json
```

本技能绝不写入 `data/profiles/targets/` 下的目标版本。如果用户要求公司/岗位适配，先确保 `base.json` 是最新的，再把适配任务交给对应的目标 profile 工作流。

## 操作流程

### 1. 判断用户输入类型

判断当前适用哪种录入模式：

| 模式 | 用户输入示例 | 主要动作 |
|---|---|---|
| 旧简历导入 | “这是我的旧简历”, pasted resume text, PDF/Word text | 提取所有可识别的基础事实并合并进 `base.json`。 |
| 杂乱转换修复 | Broken columns, wrong line order, merged bullets, odd spacing | 推断最可能的简历 section，并保留不确定性。 |
| 自然语言新增 | “我还做过一个项目…”, “把这个实习加进去” | 将描述转换成结构化条目并新增。 |
| 信息纠正 | “时间写错了”, “不是北京，是上海” | 找到最可能的现有条目，只更新被纠正的字段。 |
| 信息补全 | “帮我补全基础简历”, “这些信息写入档案” | 添加缺失 section，并询问高价值缺失事实。 |

### 2. 加载当前基础档案

使用 `profile-loader` 读取 `data/profiles/base.json`。

- 如果文件存在，保留所有无关字段。
- 如果文件不存在，使用 `profile-loader` 的基础 schema 创建。
- 将现有 ID 视为稳定引用。没有必要时不要重命名 ID。

### 3. 重建杂乱的简历文本

当输入看起来来自 PDF、Word 转换、OCR 或复制的简历版式时：

- 查找中英文 section 锚点，例如 `教育经历`、`项目经历`、`实习经历`、`工作经历`、`技能`、`证书`、`Education`、`Projects`、`Experience`、`Skills`。
- 使用日期、公司/学校名称、角色 title、bullet 标记和技术名称重新归组文本。
- 修复常见的多栏复制问题，例如日期、标题和描述出现在分离的行上。
- 当相邻行共享日期、公司或项目名时，在合理情况下视为同一条目。
- 将不确定的重建信息保存在 `source_notes`，不要假装它是确定事实。
- 如果重建结果会影响关键事实，写入前先请用户确认。

不要过度依赖版式。目标是忠实记录基础事实，而不是生成一份漂亮简历。

### 4. 将事实提取到 profile-loader schema 字段

将信息映射到最接近的 `profile-loader` 基础 schema section：

| 信息类型 | 写入位置 |
|---|---|
| 姓名、邮箱、电话、地点、链接 | `personal_info` |
| 目标方向或职业概述事实 | `career_objective` |
| 学校、学历、专业、GPA、课程 | `education` |
| 全职经历 | `work_experience` |
| 实习经历 | `internships` |
| 学术、个人、开源、产品或工程项目 | `projects` |
| 编程语言、框架、工具、平台 | `skills` |
| 证书 | `certifications` |
| 竞赛、奖学金、荣誉 | `awards` |
| 语言能力 | `languages` |
| 网站、GitHub 仓库、demo、作品集 | `portfolio` or `personal_info.links` |

对于每段经历或项目，尽量提取：

- 名称 / title
- 组织 / 公司 / 学校背景
- 角色
- 开始和结束日期
- 问题或背景
- 采取的行动
- 使用的技术
- 结果或指标
- 来自用户原始表述的 source notes
- 可见的证据强度和 ownership 风险：代码/日志/指标/截图强于模糊记忆；团队或平台工作不能记录成单人所有。

### 5. 从自然语言描述中新增内容

当用户以口语化方式描述信息时：

1. 识别最可能的 section。
2. 创建或更新结构化条目。
3. 当有助于保留语义差异时，将用户原话保存在 `source_notes`。
4. 只规范化明显结构；不要编造缺失日期、指标或技术。
5. 只询问会阻碍正确归类或造成歧义的缺失信息。

示例：

输入：

```text
我还做过一个校园二手交易小程序，用 Vue 和 Spring Boot，主要负责前端和商品发布流程。
```

期望的结构化理解：

- Section: `projects`
- Name: `校园二手交易小程序`
- Role: 如果原文支持，可记录为 frontend / product flow contributor
- Technologies: `Vue`, `Spring Boot`
- Actions: front-end implementation, product publishing flow
- Missing: date, measurable result, link

### 6. 覆盖前先检测冲突

当新输入与现有重要值不一致时，视为冲突。

以下字段一旦出现冲突，必须先询问用户再覆盖：

- 姓名
- Email 或 phone
- 学校
- 学历或专业
- 公司
- 角色 / title
- 开始或结束日期
- 地点
- 证书名称或颁发机构
- 项目 ownership 或项目类型
- 指标或量化结果

冲突提问格式：

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

在用户答复前，不要写入冲突字段。非冲突新增内容可以先准备，但必须明确说明哪些部分仍在等待确认。

### 7. 安全合并

遵循以下合并规则：

- 当公司/项目/学校 + 日期/title 表明这是不同条目时，新增条目。
- 当用户明确指向某个已有条目时，更新该条目。
- 追加技术和技能时去重。
- 追加 source notes，而不是替换已有备注。
- 如果新输入很模糊，保留旧事实。
- 用 `confidence: "unknown"` 标记不确定字段，或在 `source_notes` 中说明不确定性。
- 优先使用 `null` 或空数组，不要猜测值。

### 8. 通过 profile-loader 写入

完成提取和冲突解决后：

1. 使用 `profile-loader` 写入或合并到 `data/profiles/base.json`。
2. 确保结果仍是合法 JSON。
3. 保留无关 section。
4. 使用当前日期更新 `metadata.updated_at` 和 `last_updated`。
5. 对大量导入内容，在有用时新增 `raw_sources` 条目。

## 完成回复

处理完成后，按以下结构回复：

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

如果因为冲突需要确认而没有写入文件，必须明确说明。

## 示例

### 示例 1：导入杂乱的旧简历文本

输入：

```text
这是 PDF 转出来的，有点乱：
2022.09-2026.06 计算机科学 本科
张三 phone 138... email ...
项目 经历 SuperResume Claude Code 插件 browser skill profile-loader
React Node.js Python
```

处理方式：

1. 使用 `profile-loader` 读取 `data/profiles/base.json`。
2. 重建可能的个人信息、教育、项目和技能 section。
3. 写入清晰事实。
4. 将不确定的重建细节放入 `source_notes`。
5. 只有关键字段与现有数据冲突时才询问用户。

### 示例 2：从描述中新增一个项目

输入：

```text
把这个项目加到我的基础简历：我做了一个 AI 简历插件 SuperResume，主要实现了浏览器自动化 skill 和 profile-loader，用来保存简历 JSON。
```

处理方式：

1. 使用 `profile-loader` 加载基础 profile。
2. 为 `SuperResume` 新增或更新 `projects` 条目。
3. 只记录明确说明或现有上下文已知的 technologies。
4. 日期/指标缺失时可建议补充，但除非归类有歧义，否则不要阻塞已提供事实的写入。

### 示例 3：纠正冲突信息

输入：

```text
把我的实习地点改成上海。
```

处理方式：

- 如果只有一个实习，通过 `profile-loader` 更新其 location。
- 如果有多个实习，询问要修改哪一个。
- 如果现有 location 不同，询问是替换为上海，还是两者都保留并加备注。

## 测试提示词

可使用以下提示词手动测试本技能：

1. `这是我旧简历复制出来的内容，顺序有点乱：<paste messy resume text>，帮我写入基础简历档案。`
2. `我补充一个项目：<natural language project description>，保存到我的基础简历。`
3. `刚才那个实习时间不是 2024.06-2024.09，是 2025.06-2025.09，帮我改一下。`
