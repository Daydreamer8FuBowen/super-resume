# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SuperResume is a Claude Code plugin that helps users craft better resumes. It provides skills and hooks for resume writing, critique, formatting, and tailoring to specific job descriptions.

## Plugin Structure

```
.husky/           - Claude Code plugin manifest(s), if needed (toml/json)
skills/           - Markdown skill files; each exposes a slash command
hooks/            - Hook scripts (SessionStart, etc.) installed by the plugin
CLAUDE.md         - This file
```

## Skill Authoring

Skills live in `skills/` as `.md` files with YAML frontmatter. Each skill must define:

```yaml
---
name: skill-name
description: Short summary shown in the slash command palette
---
```

Follow these conventions for all skills in this plugin:
- Use **rigid** style when the skill enforces a specific resume-writing methodology (checklists, structured reviews). Use **flexible** style when providing general advice or templates the user adapts.
- Include concrete resume examples and counter-examples within the skill body.
- Skills should request user input (upload, paste) for the resume content rather than assuming it exists in the workspace.
- Prefer structured output: use tables for scoring rubrics, numbered lists for step-by-step workflows, and code fences for ASCII resume mockups.

## Hook Authoring

Hooks in `hooks/` run at lifecycle events (e.g., `SessionStart`). They are scripts or markdown that inject context into the session. Hooks for this plugin should focus on gathering resume-related context (role, industry, target companies) without being intrusive.

## Development Workflow

No build step is required — plugin skills are plain markdown, hooks are scripts or markdown. To test a skill:
1. Copy or symlink the plugin directory into Claude Code's plugin search path.
2. Type `/skill-name` in a Claude Code session to invoke it.
3. Iterate on the markdown directly.

If a plugin manifest is needed, create it at the repo root following the Claude Code plugin specification.
