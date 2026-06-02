# SuperResume Stability Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lightweight tools plus skill controls for stable research, profile JSON persistence, and visualization.

**Architecture:** Keep skills as orchestration/control documents and move fragile file/path operations into small Node CLI tools. Tests use Node's built-in test runner and temporary workspaces.

**Tech Stack:** Node.js ESM, `node:test`, existing SuperResume skill markdown.

---

### Task 1: Persistence Tool

**Files:**
- Create: `skills/profile-loader/profile-store.mjs`
- Test: `tests/profile-tools.test.mjs`

- [x] Write a failing test showing a small patch merges into `data/profiles/base.json` while preserving unrelated fields.
- [x] Implement `profile-store.mjs merge`.
- [x] Run `node --test tests/profile-tools.test.mjs`.

### Task 2: Profile Resolver

**Files:**
- Create: `skills/resume-visualizer/scripts/resolve-profile.mjs`
- Test: `tests/profile-tools.test.mjs`

- [x] Write a failing test showing omitted input resolves to newest target profile.
- [x] Implement resolver support for `latest`, `base`, `target:<slug>`, and explicit paths.
- [x] Run `node --test tests/profile-tools.test.mjs`.

### Task 3: Target Rendering Normalization

**Files:**
- Modify: `skills/resume-visualizer/scripts/render-resume.mjs`
- Test: `tests/profile-tools.test.mjs`

- [x] Write a failing test showing target profile tailored content renders into HTML.
- [x] Add target-to-template view-model normalization.
- [x] Run `node --test tests/profile-tools.test.mjs`.

### Task 4: Skill Controls

**Files:**
- Modify: `skills/research-launcher/SKILL.md`
- Modify: `skills/profile-loader/SKILL.md`
- Modify: `skills/resume-visualizer/SKILL.md`
- Modify: `skills/resume-beautify/SKILL.md`
- Modify: `skills/super-resume/SKILL.md`

- [x] Replace research launcher control text with parallel isolated browser subagent rules.
- [x] Document `profile-store.mjs` as the preferred write path.
- [x] Document `resolve-profile.mjs` as the preferred visualization path.
- [x] Update orchestrator references to the stable tools.

### Task 5: Verification

**Files:**
- Test: `tests/profile-tools.test.mjs`

- [x] Run `node --test tests/profile-tools.test.mjs`.
- [x] Review git diff for unintended changes.
