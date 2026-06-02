---
name: resume-visual
description: Resume JSON visual renderer for SuperResume. MUST use this skill when the user wants to preview a resume profile as a styled HTML page, visualize base.json or a target profile, start a live-preview dev server, export resume to HTML, or see what their resume looks like. Triggers on requests like "预览我的简历", "render my resume", "show my resume", "生成简历页面", "打开简历预览", "visualize the resume JSON", or any workflow step that produces a resume JSON file and needs visual feedback.
---

# Resume Visualizer

This skill renders a profile-loader JSON file (`base.json` or a target profile) into a polished, styled HTML resume page. It starts a dev server with live reload so you can tweak the JSON and see changes instantly.

## Scope

Use this skill to:

- Render `data/profiles/base.json` into a visual HTML resume for preview.
- Render any target profile JSON (`data/profiles/targets/*.json`) into HTML.
- Start a live-reload dev server that watches the JSON file and auto-refreshes the browser.
- Export the resume as a self-contained HTML file (openable in any browser, printable as PDF).
- Preview how changes to the profile JSON affect the final resume appearance.

Do NOT use this skill to:

- Edit or modify the profile JSON (use `profile-loader` or `base-profile-editor`).
- Write resume content (use resume writing skills).
- Judge resume quality (use review skills).
- Create new resume templates (templates are HTML/CSS; editing them is a separate concern).

## Path Convention

Two distinct locations for JSON files — do NOT mix them:

| Location | Directory | Purpose | Examples |
|----------|-----------|---------|----------|
| **Plugin data** | `skills/resume-visualizer/` | Template metadata, sample/test data for the visualizer itself | `sample-base.json`, `templates/*/template.json` |
| **User data** | `data/profiles/` (project root) | User's actual resume profiles — the source of truth | `base.json`, `targets/<company>-<role>.json` |

**Rules:**
- The visualizer's own JSON files (samples, template configs) stay in the plugin directory — never write user data there.
- User resume JSONs always live under `data/profiles/` in the project root — the visualizer reads them from there.
- The visualizer script accepts any path as input, so user files can be anywhere, but the **convention** is `data/profiles/`.

## Stable Profile Resolution

Do not guess which profile JSON to visualize, and do not copy profile JSON into
the visualizer folder. Resolve the input first:

```bash
node skills/resume-visualizer/scripts/resolve-profile.mjs [input] --json
```

Supported inputs:

| Input | Meaning |
|---|---|
| omitted or `latest` | Newest `data/profiles/targets/*.json`, falling back to `data/profiles/base.json` |
| `base` | `data/profiles/base.json` |
| `target:<slug>` | `data/profiles/targets/<slug>.json` |
| `<path.json>` | Explicit JSON file |

The resolver validates the chosen profile and returns the exact
`render-resume.mjs` command. Use that command for preview/export.

## How It Works

The visualizer script reads a profile JSON, transforms it into a view model, renders it through a Handlebars-compatible template engine, and writes a self-contained HTML file. If `--no-serve` is not passed, it starts a local HTTP server with Server-Sent Events (SSE) for live reload.

### Command

```bash
node skills/resume-visualizer/scripts/render-resume.mjs <input.json> [output.html] [options]
```

### Options

| Flag | Description |
|---|---|
| `--port, -p <N>` | Dev server port (default: 3000, auto-increments if busy) |
| `--no-serve` | Write HTML file only, do not start the dev server |
| `--open, -o` | Automatically open the browser when the server starts |
| `--template, -t <name>` | Template to use (default: `modern-clean`) |
| `--watch, -w <path>` | Additional file or glob to watch for changes |

### Examples

```bash
# Preview the base profile with live reload
node skills/resume-visualizer/scripts/render-resume.mjs data/profiles/base.json resume-preview.html

# Quick test with sample data
node skills/resume-visualizer/scripts/render-resume.mjs skills/resume-visualizer/sample-base.json

# Export only (no server)
node skills/resume-visualizer/scripts/render-resume.mjs base.json export.html --no-serve

# Custom port, auto-open browser
node skills/resume-visualizer/scripts/render-resume.mjs base.json preview.html --port 8080 --open
```

## Workflow

### 1. Resolve the input JSON path

Check the user's request and context:

- If the user says "preview my resume" or similar without specifying a file, run `resolve-profile.mjs latest --json`.
- If the user names a specific profile, run `resolve-profile.mjs target:<slug> --json` or pass an explicit JSON path.
- If a profile was just created or updated by a previous workflow step, pass that exact file path to `resolve-profile.mjs`.
- If no profile JSON exists yet, tell the user to create one first (via `base-profile-editor`).

### 1.5. Photo Check (non-mandatory)

**Before running the visualizer**, check for a resume photo and inform the user:

```
📷 简历头像提示：
   在工作目录下放置一张 profile.png（或 .jpg）即可作为简历头像。
   当前状态：<检测到 / 未检测到>
```

- If `profile.png` (or `profile.jpg`) exists in the current working directory → the visualizer auto-detects it, converts to base64, and injects it into the resume.
- If no photo file is found → display the reminder once, then proceed. The user can add one later and the live-reload will pick it up.
- The user can also explicitly request: "帮我添加简历头像" — then guide them to place `profile.png` in the project directory and re-run the visualizer.
- The photo file is automatically copied to `skills/resume-visualizer/` for persistence.

This step is **non-blocking** — the visualizer works fine without a photo.

### 2. Choose the output path

- Default: `<input-basename>-preview.html` in the current working directory.
- The user may specify a custom path.

### 3. Run the visualizer

Execute the render command returned by `resolve-profile.mjs`. Report the output:

```
✔ Parsed base.json (5.2 KB)
✔ Loaded template "modern-clean" (5 partials)
✔ Written to resume-preview.html (18.3 KB)

Dev server running at http://localhost:3000
Watching for changes...
Press Ctrl+C to stop
```

### 4. Tell the user what to do

- Share the URL if the dev server is running.
- If `--no-serve` was used, tell the user to open the HTML file in their browser.
- Remind them that they can print to PDF from the browser (Ctrl+P / Cmd+P).

## Available Templates

| Template | Layout | Description |
|---|---|---|
| `modern-clean` | Single column | Clean centered layout, photo support, ATS-friendly, print-optimized (default) |
| `modern-professional` | Double column | Left sidebar (photo, contact, skills, education) + right main (experience, projects). Professional and compact. |

### Photo Support

Both templates support an optional `photo` field in `personal_info`:

```json
"personal_info": {
  "photo": "https://example.com/photo.jpg",
  ...
}
```

The `photo` value can be:
- A **URL** (e.g., `"https://example.com/photo.jpg"`)
- A **base64 data URI** (e.g., `"data:image/png;base64,..."`)
- **Omitted** — then the visualizer auto-detects `profile.png` in the working directory

**Local file convention (recommended):**

Place a `profile.png` (or `profile.jpg`) in the project root directory. The visualizer automatically:
1. Detects the file at startup
2. Reads it and converts to a base64 data URI
3. Injects it into `personal_info.photo` (only if the field is empty)
4. Copies it to `skills/resume-visualizer/` for persistence

This is non-mandatory — when no photo is found and `photo` is empty, a placeholder icon is shown (double-column template) or the header renders without a photo (single-column template).

To see what templates are available, list the directories under `skills/resume-visualizer/templates/`.

## Template Structure

Each template is a directory under `templates/`:

```
templates/<template-name>/
├── template.json      # Metadata: name, version, features
├── template.hbs       # Main HTML frame
├── style.css          # CSS styles (custom properties for theming)
└── partials/          # Reusable template fragments
    ├── header.hbs
    ├── experience-item.hbs
    ├── education-item.hbs
    ├── project-item.hbs
    └── skills.hbs
```

Templates use a Handlebars-compatible syntax. See existing templates for the supported subset.

## Data Mapping

The visualizer maps `base.json` sections to resume display sections:

| JSON section | Resume section | Notes |
|---|---|---|
| `personal_info` | Header (name, headline, contact, links) | Always shown |
| `career_objective.summary_facts` | Summary | Shown only if non-empty |
| `skills` | Skills (tag cloud by category) | Shown only if any category has items |
| `work_experience` | Experience | Sorted by date DESC; skipped if all null |
| `internships` | Internships | Uses same style as Experience |
| `projects` | Projects | Shows problem, actions, results, tech |
| `education` | Education | Shows degree, school, GPA, honors |
| `certifications` | Certifications | Simple list |
| `awards` | Awards | Simple list |
| `languages` | Languages | Simple list |

Metadata fields (`raw_sources`, `source_notes`, `metadata`, `resume_preferences`, `confidence`) are not rendered.

## Limitations

- The built-in template engine supports a subset of Handlebars syntax (`{{var}}`, `{{{var}}}`, `{{#if}}`, `{{#each}}`, `{{> partial}}`, `{{join}}`). Full Handlebars helpers are not supported.
- Live reload watches the input JSON file and the active template directory. Changes to external CSS files or images are not watched unless passed via `--watch`.
- The dev server serves ONLY the generated HTML file and the SSE endpoint. It is not a general-purpose static file server.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Input file not found" | Wrong path or missing profile | Check path; create profile via `base-profile-editor` |
| "Template not found" | Wrong `--template` name | List `templates/` directory for valid names |
| Port already in use | Another instance running | The script auto-increments the port; check the console output |
| Blank page in browser | Empty or all-null profile data | Fill in profile data via `base-profile-editor` |
| Browser doesn't reload on change | File watcher limitation on your OS | Refresh manually (F5) |
