# SuperResume Stability Tools Design

## Goal

Stabilize three unreliable workflow points without building a full MCP server:
parallel web research, large profile JSON writes, and choosing the correct JSON
for resume visualization.

## Design

### Parallel Research

`research-launcher` now uses a parallel isolated-subagent protocol. Each
research task maps to one browser subagent, and each subagent must create and
use one dedicated browser tab. The skill still requires user approval before
execution and still treats blocked pages as valid best-effort outcomes.

### Profile Persistence

Agents should stop rewriting large resume JSON files. The new
`skills/profile-loader/profile-store.mjs` tool accepts a small JSON merge patch,
merges it into the chosen base or target profile, writes atomically, and runs
`validate-profile.mjs`. This keeps the model responsible for structured intent,
not byte-perfect large JSON output.

### Visualization Resolution

The new `skills/resume-visualizer/scripts/resolve-profile.mjs` tool resolves
`latest`, `base`, `target:<slug>`, or an explicit JSON path, validates it, and
returns the exact render command. `render-resume.mjs` also normalizes targeted
profiles into the existing template view model so target previews do not render
as blank base views.

## Non-Goals

- No full MCP server in this pass.
- No new template system.
- No unrelated resume-writing methodology changes.
