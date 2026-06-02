# SuperResume

A Claude Code plugin that helps you craft better resumes. Provides a suite of skills for resume writing, critique, formatting, visual rendering, and tailoring to specific job descriptions.

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

## Skills

| Skill | Description |
|---|---|
| `/super-resume` | Orchestrator — runs the full resume optimization pipeline |
| `/base-profile-editor` | Edit your base profile (personal info, education, skills, experience) |
| `/profile-loader` | Load and validate your base profile data |
| `/resume-review` | Comprehensive resume review with scoring rubrics |
| `/resume-beautify` | Improve resume formatting, layout, and visual presentation |
| `/resume-visualizer` | Render resume JSON into live HTML preview with multiple templates |
| `/research-launcher` | Launch targeted research on companies, roles, and job descriptions |
| `/browser` | Web browsing automation for job research |

## Structure

```
.claude-plugin/    - Plugin manifest
skills/            - Skill definitions (markdown with YAML frontmatter)
hooks/             - Lifecycle hook scripts
CLAUDE.md          - Development guide for this plugin
```

## Requirements

- [Claude Code](https://claude.ai/code)
- For the `/browser` skill: [Patchright](https://github.com) MCP server (`npx patchright-mcp@latest`)

## License

MIT
