---
name: profile-loader
description: Resume profile JSON loader and persistence protocol for SuperResume. Low-level persistence skill — provides schema, storage paths, and read/write/merge operations for resume profile JSON files. Called internally by base-profile-editor, resume-beautify, and super-resume. Do NOT use for workflow-level resume operations; use /super-resume for the full workflow.
---

# Profile Loader

This skill defines how SuperResume stores, reads, extracts, and updates resume profile JSON files. It is a persistence and schema skill: it keeps resume facts in a stable structure so other resume skills can write, tailor, review, or format resumes without losing source information.

## Scope

Use this skill to:

- Extract resume facts from pasted text, uploaded resumes, notes, chats, or existing profile JSON.
- Read the base profile or a targeted profile before resume work that depends on saved facts.
- Write new facts into the correct JSON profile.
- Merge updates into an existing profile without deleting unknown or unrelated information.
- Create targeted JSON profiles for a specific company, role, job description, or resume version.
- Explain where profile JSON files live and which file should be used next.

Do not use this skill to:

- Invent experience, metrics, dates, schools, companies, certificates, or skills.
- Write the final polished resume content by itself.
- Judge resume quality by itself.
- Format a resume document by itself.
- Scrape job descriptions by itself.

If a task combines persistence with writing/reviewing/tailoring, use this skill first to load or update profile JSON, then hand off to the relevant writing/review/tailoring workflow.

## Tool Restrictions

This skill is allowed to read profile JSON files and to run only the bundled
profile persistence tools. Avoid ad hoc shell pipelines or external JSON
rewriters.

| Allowed | Forbidden |
|---------|-----------|
| Read profile JSON files | Unrelated shell commands |
| Create a small patch JSON file | `jq`, Python one-off rewrites, or custom shell text manipulation |
| Run `node skills/profile-loader/profile-store.mjs ...` | Editing large profile JSON by hand when a patch is sufficient |
| Run `node skills/profile-loader/validate-profile.mjs ...` | Any scraper, browser, or resume-writing action |

**Rules:**
- Use `profile-store.mjs` for writes whenever possible.
- Use `validate-profile.mjs` for any write path not handled by `profile-store.mjs`.
- Do not invoke unrelated commands or other skills from this persistence layer.
- When conflicts affect important facts, ask before writing the conflicting field.

## Stable Persistence Tooling

Large resume JSON files are error-prone when an agent rewrites the whole file.
Use the bundled persistence tool whenever possible:

```bash
# Merge a small patch into the base profile, then validate automatically.
node skills/profile-loader/profile-store.mjs merge --profile base --patch patch.json

# Merge a small patch into a target profile, then validate automatically.
node skills/profile-loader/profile-store.mjs merge --profile target --id <company-role> --patch patch.json

# Merge into an explicit file.
node skills/profile-loader/profile-store.mjs merge --file data/profiles/base.json --schema base --patch patch.json
```

**Required behavior for agents:**

- Produce the smallest possible patch JSON instead of rewriting a whole profile.
- Let `profile-store.mjs` merge, format, write atomically, and validate.
- If validation fails, fix the patch and rerun the same command.
- Treat `null` in a patch as deletion. Use it only when deleting a field is intended.
- Arrays in a patch replace arrays in the profile; include the full intended array when changing one.

## JSON Validation

Every JSON write operation MUST be followed by validation using the bundled script:

```
node skills/profile-loader/validate-profile.mjs <file.json> --schema <base|target>
```

| File type | Schema flag |
|-----------|-------------|
| `data/profiles/base.json` | `--schema base` |
| `data/profiles/targets/*.json` | `--schema target` |

**Validation rules:**
- **Before write:** Not required (data is being constructed).
- **After write:** MANDATORY — the caller runs the validator. If validation fails (exit code 1), the write MUST be fixed and re-validated before proceeding.
- **Warnings** (💡) are advisory and do not block writes. **Errors** (❌) are blocking and must be fixed.

**Example validation flow:**

```
1. This skill writes base.json via Write/Edit tool
2. Caller runs: node skills/profile-loader/validate-profile.mjs data/profiles/base.json --schema base
3. If ❌ → read errors, fix the JSON, re-write, re-validate
4. If ✅ → persist complete
```

The validator checks:
- JSON syntax (parseable, valid UTF-8, no trailing commas, no comments)
- Required top-level keys per schema type
- Field types (string vs array vs object)
- Date format compliance (YYYY-MM-DD)
- ID uniqueness within and across sections
- `confidence` field enum values
- Known skill category names

## Storage Layout

User resume profiles are stored under the project working directory (NOT inside the plugin's `skills/` folder):

```text
<项目根目录>/
└── data/profiles/
    ├── base.json
    └── targets/
        ├── <company>-<role>.json
        └── <company>-<role>-<date>.json
```

> This is distinct from plugin-internal JSON files (e.g., `skills/resume-visualizer/sample-base.json` and template metadata), which are part of the visualizer itself and never contain user data.

### File Meanings

| File | Meaning | Use when |
|---|---|---|
| `data/profiles/base.json` | The most complete, direct, fact-preserving source profile. | The user provides new resume facts, asks to save information, or wants a general resume source of truth. |
| `data/profiles/targets/<company>-<role>.json` | A tailored profile derived from `base.json` for a specific company/role/job description. | The user asks to adapt, optimize, or maintain resume content for a specific target. |

The base profile is the source of truth. Targeted profiles may select, reorder, emphasize, or rewrite positioning, but they must not change facts. When a target profile makes a claim, that claim should be traceable to `base.json` or to a clearly recorded user-provided source.

## Evidence Contract

Use these compact labels for strong resume claims:

| Field | Values |
|---|---|
| `claim_level` | `C0` aware/participated, `C1` owned module, `C2` designed/optimized, `C3` measured impact |
| `truth_status` | `supported`, `careful`, `needs_evidence`, `unsupported`, `unknown` |
| `interview_risk` | `low`, `medium`, `high` |

Do not write C3 impact claims without metric evidence. Use `safe_wording` when
the current evidence only supports a weaker claim.

## Read / Write Protocol

Follow this protocol whenever profile JSON is involved.

1. **Classify the request**
   - Use `base.json` for general facts, raw resume intake, and long-term source-of-truth updates.
   - Use `targets/<company>-<role>.json` for company/role-specific adaptations.
   - If the user names a company or role but no target profile exists, create one derived from `base.json` when enough information is available.

2. **Read before modifying**
   - Before updating an existing JSON file, read it first.
   - Preserve fields that are not related to the current update.
   - If the file does not exist, create it from the schema below.

3. **Extract facts conservatively**
   - Keep raw factual content as close to the source as possible.
   - Use `null`, empty arrays, or `confidence: "unknown"` for missing information.
   - Do not infer dates, company names, degrees, metrics, or technologies unless the source clearly states them.

4. **Merge instead of replacing**
   - Add new entries when they describe distinct experiences.
   - Update existing entries when the user clarifies the same experience.
   - Keep previous raw source notes unless the user explicitly asks to remove them.

5. **Write through the persistence tool**
   - Prefer `profile-store.mjs` with a small patch over a full-file rewrite.
   - The tool writes atomically and runs validation automatically.
   - If the caller writes by any other route, it MUST run `validate-profile.mjs` manually.

6. **Write valid JSON**
   - JSON must be parseable.
   - Use double quotes.
   - Do not include comments in JSON files.
   - Keep stable IDs for repeatable entries when possible.
   - After writing, the caller MUST run `node skills/profile-loader/validate-profile.mjs <file> --schema <base|target>`. Validation errors (❌) are blocking.

6. **Report the persistence result**
   - State which file was read or written.
   - Summarize added, updated, and unchanged sections.
   - List missing or uncertain fields that may need user clarification.

## Base Profile Schema

Use this structure for `data/profiles/base.json`.

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

## Target Profile Schema

Use this structure for `data/profiles/targets/<company>-<role>.json`.

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

## Extraction Rules

When converting resume content into JSON:

- Split facts into the most specific matching section.
- Preserve both Chinese and English names or titles if provided.
- Keep dates as written when exact normalization is uncertain.
- Store measurable outcomes in `achievements[].metric` or `projects[].metrics`.
- Store evidence or source wording in `source_notes` when useful for later verification.
- If a bullet combines action, technology, and result, split them into `actions`, `technologies`, and `results` where possible.
- If a detail is important but does not fit the schema, place it in `metadata.notes` or the closest entry's `source_notes` rather than dropping it.

## Update Examples

### Example 1: Save a new project to the base profile

Input:

```text
保存这个项目：SuperResume，Claude Code 插件，负责简历写作、评价和岗位适配。我做了 browser skill 和 profile-loader skill。
```

Action:

1. Read `data/profiles/base.json` if it exists.
2. Add or update an entry in `projects`.
3. Write `data/profiles/base.json`.
4. Report the changed project fields and missing details such as dates, metrics, and technologies.

### Example 2: Create a targeted profile

Input:

```text
基于我的基础简历，为字节跳动前端开发岗位维护一个 JSON 版本。
```

Action:

1. Read `data/profiles/base.json`.
2. Create `data/profiles/targets/bytedance-frontend-developer.json`.
3. Fill `target.company`, `target.role`, selected IDs, keywords, and adaptation notes.
4. Do not invent missing job description details; ask for the JD if needed.

### Example 3: Merge clarified information

Input:

```text
刚才那个实习是 2025 年 6 月到 2025 年 9 月，在上海，不是北京。
```

Action:

1. Identify the likely internship entry.
2. Read the current profile JSON.
3. Update only `start_date`, `end_date`, and `location` for that entry.
4. Preserve unrelated responsibilities and achievements.
5. If multiple entries could match, ask the user which one before writing.

## Ambiguity Handling

Ask a short clarification before writing when:

- Multiple existing entries could match the user's update.
- The user wants a target profile but company or role is missing.
- A fact would overwrite a conflicting existing value.
- The source suggests a sensitive or high-impact claim without enough evidence.

Otherwise, write the best structured version and mark uncertain fields clearly.

## Completion Message

After any read/write operation, respond with this structure:

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
