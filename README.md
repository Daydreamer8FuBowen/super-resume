<div align="center">

# SuperResume

**Evidence-bound resume tailoring for Codex and Claude Code.**

一个面向求职场景的 AI 简历工作流插件：从目标岗位调研、基础档案维护、岗位定制写作，到 HTML 预览、风险审查和最终保存。

<br>

![Type](https://img.shields.io/badge/type-Codex%20%2F%20Claude%20Code%20Plugin-111827)
![Focus](https://img.shields.io/badge/focus-Resume%20Tailoring-4f46e5)
![Method](https://img.shields.io/badge/method-Evidence%20Bound-f59e0b)
![Preview](https://img.shields.io/badge/preview-Live%20HTML-10b981)
![Tests](https://img.shields.io/badge/tests-node%20--test-2563eb)
![License](https://img.shields.io/badge/license-MIT-blue)

[Overview](#overview) · [Screenshots](#screenshots) · [Quick Start](#quick-start) · [Workflow](#workflow) · [Data Model](#data-model) · [Development](#development)

</div>

---

## Overview

SuperResume turns resume tailoring into a structured, auditable workflow.

It is designed for cases where a user has a base resume and a target role, but needs help with:

- researching the company, JD, technology stack, and interview signals;
- preserving a reusable base profile instead of rewriting resumes from scratch;
- generating a target-specific resume without fabricating facts;
- previewing the result as a printable HTML resume;
- reviewing risky claims before they become interview liabilities.

The core rule is simple:

```text
Facts live in base.json.
Target resumes adapt presentation, not truth.
Strong claims require evidence.
```

## What SuperResume Produces

| Input | Output |
| --- | --- |
| Old resume, notes, project descriptions | `data/profiles/base.json` |
| Company, role, JD, research results | `data/profiles/targets/<company>-<role>.json` |
| Target profile JSON | Live HTML preview |
| Review score below threshold | Prioritized fix plan and next iteration input |
| New verified facts discovered during tailoring | Optional write-back to `base.json` |

## Screenshots

<table>
  <tr>
    <td width="50%">
      <strong>Parallel research agents</strong><br>
      <sub>Independent browser tasks collect JD, interview, and business signals.</sub>
      <img src="docs/assets/research-agents.png" alt="Parallel research agents">
    </td>
    <td width="50%">
      <strong>Live resume preview</strong><br>
      <sub>Target JSON renders into a printable HTML resume with live reload.</sub>
      <img src="docs/assets/live-preview.png" alt="Live resume preview">
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Review repair loop</strong><br>
      <sub>P0/P1/P2 fixes drive the next resume iteration.</sub>
      <img src="docs/assets/review-fixes.png" alt="Review fixes">
    </td>
    <td width="50%">
      <strong>Final save and write-back</strong><br>
      <sub>Target profile is saved; new facts can be written back after confirmation.</sub>
      <img src="docs/assets/final-save.png" alt="Final save">
    </td>
  </tr>
</table>

## Quick Start

### 1. Install

```bash
git clone git@github.com:Daydreamer8FuBowen/super-resume.git
claude plugins install ./super-resume
```

For Codex local development, this repository includes Patchright MCP config:

```toml
[mcp_servers.patchright]
command = "npx"
args = ["patchright-mcp@latest"]
```

### 2. Create or import the base profile

```text
/base-profile-editor

这是我的旧简历内容，请写入基础档案。
不要编造经历；缺失信息用 null、空数组或 source_notes 标注。
```

Expected output:

```text
data/profiles/base.json
```

### 3. Run the full tailoring workflow

```text
/super-resume

目标公司：海康威视
目标岗位：Java 后端开发工程师
JD：如果我没有提供，请先调研。
```

### 4. Preview a profile

```text
/resume-visual

预览最新 target 简历。
```

Under the hood, SuperResume resolves the correct file before rendering:

```bash
node skills/resume-visualizer/scripts/resolve-profile.mjs latest --json
```

## Workflow

```text
Base Profile
    |
    v
Research Plan -> Parallel Browser Agents
    |
    v
Positioning + Target JSON
    |
    v
Live Preview
    |
    v
Review / Repair Loop
    |
    v
Final Save + Optional Base Write-back
```

| Phase | Skill | Responsibility |
| --- | --- | --- |
| 1 | `base-profile-editor`, `profile-loader` | Build or update the factual base profile |
| 2 | `research-launcher` | Plan and run isolated browser research tasks |
| 3 | `resume-beautify` | Create the target profile and tailored content |
| 4 | `resume-visual` | Render and serve an HTML preview |
| 5 | `resume-review` | Score the resume and expose risky claims |
| 6 | `super-resume` | Orchestrate final save and optional write-back |

## Evidence Boundary

SuperResume uses a compact Evidence Contract in `fact_traceability`:

| Field | Values |
| --- | --- |
| `claim_level` | `C0` aware/participated, `C1` owned module, `C2` designed/optimized, `C3` measured impact |
| `truth_status` | `supported`, `careful`, `needs_evidence`, `unsupported`, `unknown` |
| `interview_risk` | `low`, `medium`, `high` |
| `safe_wording` | A lower-risk version of the claim |

Examples of unsafe upgrades:

| Unsafe | Safer |
| --- | --- |
| 本地 demo -> 企业级系统上线 | 完成 demo / 内部验证 |
| 无评测数据 -> 准确率提升 30% | 整理 bad cases / 建立评测口径 |
| 团队项目 -> 独立主导 | 负责某模块 / 参与某阶段 |

## Data Model

User resume data lives outside plugin internals:

```text
data/
└── profiles/
    ├── base.json
    └── targets/
        ├── hikvision-java-backend.json
        └── <company>-<role>.json
```

Plugin implementation and examples live under:

```text
skills/
docs/
evals/
tests/
```

`base.json` is the source of truth. Target profiles may select, reorder, and rewrite presentation, but they should not mutate core facts such as company, role, dates, education, or ownership.

## Stable Tooling

Large JSON files are not hand-written by the agent. SuperResume uses small deterministic tools for fragile operations.

### Merge and validate profile JSON

```bash
node skills/profile-loader/profile-store.mjs merge --profile base --patch patch.json
node skills/profile-loader/profile-store.mjs merge --profile target --id hikvision-java-backend --patch patch.json
```

### Validate schemas

```bash
node skills/profile-loader/validate-profile.mjs data/profiles/base.json --schema base
node skills/profile-loader/validate-profile.mjs data/profiles/targets/hikvision-java-backend.json --schema target
```

### Resolve and render previews

```bash
node skills/resume-visualizer/scripts/resolve-profile.mjs latest --json
node skills/resume-visualizer/scripts/render-resume.mjs data/profiles/base.json resume-preview.html
```

## Skill Reference

| Skill | Use |
| --- | --- |
| `/super-resume` | Main workflow entry |
| `/base-profile-editor` | Import, complete, or correct base resume facts |
| `/profile-loader` | Profile schema, persistence, validation |
| `/research-launcher` | Company/JD/role research scheduling |
| `/resume-beautify` | Targeted resume generation |
| `/resume-visual` | HTML preview and live reload |
| `/resume-review` | Scoring, claim risk, next-iteration fixes |
| `/browser` | Browser automation support |

## Repository Layout

```text
SuperResume/
├── .claude-plugin/                 # Claude Code plugin manifest
├── .codex/                         # Codex local configuration
├── hooks/                          # Plugin hooks
├── skills/
│   ├── super-resume/               # Main orchestrator
│   ├── base-profile-editor/        # Base profile intake
│   ├── profile-loader/             # JSON schema and persistence tools
│   ├── research-launcher/          # Parallel research protocol
│   ├── resume-beautify/            # Target resume generation
│   ├── resume-review/              # Review orchestration
│   └── resume-visualizer/          # HTML renderer and templates
├── docs/
│   ├── assets/                     # README screenshots
│   └── superpowers/                # Design and implementation notes
├── evals/                          # Manual regression scenarios
├── tests/                          # Node test suite
└── README.md
```

## Development

Run the current automated checks:

```bash
node --test tests/profile-tools.test.mjs
```

What this verifies:

- profile patches merge without losing unrelated fields;
- target profile resolution chooses the newest target correctly;
- documented target schemas validate without base-only fields;
- evidence contract enums are enforced;
- target profiles render tailored content instead of blank pages.

Manual regression cases live in:

```text
evals/manual-eval-suite.md
```

## Roadmap

- More resume templates with print-focused QA.
- Stronger target profile normalization for multiple layout styles.
- Optional export pipeline for PDF artifacts.
- Richer evidence collection during base profile intake.
- More manual evals for research isolation and review loops.

## FAQ

### Is SuperResume a resume generator?

It is closer to a resume workflow engine. It stores a factual base profile, researches target requirements, creates a tailored profile, previews it, and reviews risky claims.

### Can it invent metrics or production impact?

No. Impact claims should be supported by evidence. Unsupported metrics are downgraded or written as `safe_wording`.

### Where does user data go?

User resume data is stored under `data/profiles/` in the working project. Plugin templates and sample data stay under `skills/`.

### Why use JSON instead of directly writing Markdown or PDF?

JSON keeps facts, target adaptation, traceability, and rendering separate. This makes later edits, previews, reviews, and write-back safer.

## Contributing

Good contributions usually improve one of these areas:

- skill clarity without adding unnecessary prompt bulk;
- deterministic tools for fragile operations;
- profile schema validation;
- resume templates and rendering tests;
- manual eval scenarios that catch unsafe resume behavior.

Please keep the project bias: small tools for deterministic work, concise skills for judgment, and explicit evidence boundaries for strong claims.

## License

MIT
