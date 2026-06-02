# SuperResume

A Claude Code plugin that helps you craft better resumes with an **AI-powered multi-phase pipeline**. From researching target companies to iterative self-review and live preview, SuperResume automates the entire resume tailoring workflow.

## How It Works

SuperResume runs a **5-phase pipeline** to transform your base profile into a job-specific, polished resume:

```
Phase 1           Phase 2           Phase 3              Phase 4              Phase 5
┌──────────┐     ┌──────────┐     ┌──────────┐        ┌──────────┐        ┌──────────┐
│  Goal     │ ──▶ │ Research │ ──▶ │ Position │  ────▶ │  Review  │ ────▶ │  Final   │
│ Confirm   │     │  Plan    │     │ & Write  │        │  & Iter. │        │  Save    │
└──────────┘     └──────────┘     └──────────┘        └──────────┘        └──────────┘
 Skills →        4 research       Project ranking      Score rubric        Write-back
 Target ←         tasks auto-     → tailored JSON      Auto-retry          new facts
 Strategy         generated       → live preview       until ≥85          to base.json
```

### Phase 1 — Goal Confirmation (确认目标)

The AI analyzes your background against the target company and proposes a positioning strategy:

- Maps your skills to the company's tech stack and business domains
- Identifies the best-fit role (e.g., "Java Backend" vs "AI Integration Java")
- Proposes a headline and career narrative angle
- Asks clarifying questions before proceeding

### Phase 2 — Research Plan (调研计划)

The AI generates a structured research plan with prioritized tasks:

| Task | Sources | Priority |
|------|---------|----------|
| JD Collection | BOSS Zhipin, Company career site | 🔴 P0 |
| Company Tech Stack | Tech blogs, Zhihu | 🔴 P0 |
| Interview Experience | Niuke, Zhihu | 🟡 P1 |
| Business Direction | Company官网, 36Kr | 🟡 P1 |

You can add, remove, or modify tasks before execution. Reply "执行" to start.

### Phase 3 — Positioning & Writing (定位决策+美化+写入)

- **Project Ranking:** Your experiences are scored by relevance (⭐1-3) and reordered for maximum impact
- **Skill Strategy:** Core skills highlighted; secondary skills placed as bonus sections
- **Headline Generation:** A tailored professional headline is crafted
- **Live Preview:** A dev server starts at `http://localhost:3000` — changes auto-refresh in the browser
- **Output:** Tailored resume written to `data/profiles/targets/{company}-{role}.json`

### Phase 4 — Review & Iteration (简历评审)

The AI self-reviews the resume with a detailed scoring rubric:

| Dimension | Max Score |
|-----------|-----------|
| Job Match (岗位匹配度) | 30 |
| Company & Domain Match (公司与领域匹配度) | 20 |
| Project Support (项目支撑力度) | 20 |
| Skill Relevance (技能相关性) | 15 |
| Expression Quality (表达质量) | 10 |
| Structure Clarity (结构清晰度) | 5 |
| **Total** | **100** |

If the score is below **85**, the AI **automatically retries** (up to 3 times), applying P0/P1/P2 fixes each round. You'll see the score progression (e.g., 80 → 84 → 90).

### Phase 5 — Final Save (最终保存)

The AI identifies **new facts** discovered during tailoring (skills you have but weren't in your master profile) and asks whether to write them back to `base.json`. This way, every job application enriches your master profile for future use.

---

## Installation

```bash
# Via Claude Code plugin registry (recommended)
claude plugins install super-resume
```

Or manually:

```bash
git clone git@github.com:Daydreamer8FuBowen/super-resume.git
claude plugins install ./super-resume
```

## Usage

```
/super-resume
```

You'll be prompted for:
1. Your base profile (or let the AI load it from `base.json`)
2. Target company and role
3. Any specific job description (optional — AI will research if not provided)

Then the pipeline runs automatically. You can intervene at any phase to adjust the plan.

### Other Skills

| Skill | Description |
|-------|-------------|
| `/super-resume` | **Orchestrator** — runs the full 5-phase pipeline |
| `/base-profile-editor` | Edit your base profile (personal info, education, skills, experience) |
| `/profile-loader` | Load and validate your base profile data |
| `/resume-review` | Standalone resume review with the scoring rubric |
| `/resume-beautify` | Improve resume formatting, layout, and visual presentation |
| `/resume-visualizer` | Render resume JSON into live HTML preview with multiple templates |
| `/research-launcher` | Launch targeted research on companies, roles, and job descriptions |
| `/browser` | Web browsing automation for job research |

## Key Features

- **Multi-Agent Research:** Parallel subagents simultaneously gather JD requirements, interview experiences, and company background
- **Iterative Self-Improvement:** AI reviews and rewrites up to 3 times until the resume scores ≥ 85/100
- **Live Preview:** Real-time HTML rendering with auto-refresh on every change
- **Master Profile Learning:** New skills discovered during tailoring are offered back to your `base.json`
- **Prioritized Fixes:** Issues are ranked P0/P1/P2 and addressed in order of impact
- **Structured Scoring:** 6-dimension rubric provides transparent, actionable feedback

## Structure

```
SuperResume/
├── .claude-plugin/          # Plugin manifest
│   └── plugin.json
├── skills/                  # Skill definitions (markdown with YAML frontmatter)
│   ├── super-resume/        # Orchestrator skill
│   ├── base-profile-editor/
│   ├── profile-loader/
│   ├── resume-review/
│   ├── resume-beautify/
│   ├── resume-visualizer/   # JSON→HTML renderer with Handlebars templates
│   ├── research-launcher/
│   └── browser/
├── hooks/                   # Lifecycle hook scripts
│   └── hooks.json
├── .mcp.json
├── CLAUDE.md
└── README.md
```

## Requirements

- [Claude Code](https://claude.ai/code)
- For the `/browser` skill: [Patchright](https://github.com) MCP server (`npx patchright-mcp@latest`)

## License

MIT
