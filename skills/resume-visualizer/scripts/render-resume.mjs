#!/usr/bin/env node

/**
 * render-resume.mjs — SuperResume Visualizer
 *
 * Renders a profile-loader base.json into a styled HTML resume page.
 * Starts a dev server with live reload when source files change.
 *
 * Usage:
 *   node render-resume.mjs <input.json> [output.html] [options]
 *   node render-resume.mjs base.json resume-preview.html
 *   node render-resume.mjs base.json resume-preview.html --port 3000 --open
 *   node render-resume.mjs base.json --no-serve        # write HTML only
 *
 * Options:
 *   --port, -p     Dev server port (default: 3000)
 *   --no-serve      Write HTML only, don't start server
 *   --open, -o      Open browser automatically
 *   --watch, -w     Additional glob to watch (repeatable)
 *   --template, -t  Template name (default: modern-clean)
 */

import { readFileSync, writeFileSync, watch, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

// ─── Paths ───────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, '..');
const TEMPLATES_DIR = resolve(SKILL_ROOT, 'templates');

// ─── CLI Argument Parsing ────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    input: null,
    output: 'resume-preview.html',
    port: 3000,
    serve: true,
    open: false,
    template: 'modern-clean',
    extraWatch: [],
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--no-serve') {
      args.serve = false;
    } else if (arg === '--open' || arg === '-o') {
      args.open = true;
    } else if (arg === '--port' || arg === '-p') {
      args.port = parseInt(argv[++i], 10);
    } else if (arg === '--template' || arg === '-t') {
      args.template = argv[++i];
    } else if (arg === '--watch' || arg === '-w') {
      args.extraWatch.push(argv[++i]);
    } else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    } else if (!args.input) {
      args.input = arg;
    } else if (args.output === 'resume-preview.html') {
      args.output = arg;
    }
    i++;
  }

  if (!args.input) {
    console.error('Usage: node render-resume.mjs <input.json> [output.html] [options]');
    console.error('');
    console.error('Options:');
    console.error('  --port, -p     Dev server port (default: 3000)');
    console.error('  --no-serve      Write HTML only, don\'t start server');
    console.error('  --open, -o      Open browser automatically');
    console.error('  --watch, -w     Additional file/glob to watch');
    console.error('  --template, -t  Template name (default: modern-clean)');
    process.exit(1);
  }

  return args;
}

// ─── Date Formatting ──────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return null;
  // "2024-06" → "Jun 2024"
  // "2024-06-15" → "Jun 2024"
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const match = dateStr.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (match) {
    const monthIdx = parseInt(match[2], 10) - 1;
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${months[monthIdx]} ${match[1]}`;
    }
  }
  return dateStr; // Return as-is if we can't parse
}

// ─── Data Transformation ─────────────────────────────────────────────

function transformData(raw) {
  const data = JSON.parse(JSON.stringify(raw)); // Deep clone

  // Format all dates
  for (const key of ['work_experience', 'internships', 'projects', 'education']) {
    if (Array.isArray(data[key])) {
      for (const entry of data[key]) {
        if (entry.start_date) entry.start_date = formatDate(entry.start_date);
        if (entry.end_date) entry.end_date = formatDate(entry.end_date);
      }
    }
  }

  // Format certification dates
  if (Array.isArray(data.certifications)) {
    for (const cert of data.certifications) {
      if (cert.date) cert.date = formatDate(cert.date);
      if (cert.expiry_date) cert.expiry_date = formatDate(cert.expiry_date);
    }
  }

  // Format award dates
  if (Array.isArray(data.awards)) {
    for (const award of data.awards) {
      if (award.date) award.date = formatDate(award.date);
    }
  }

  // Sort work_experience by start_date DESC (most recent first)
  if (Array.isArray(data.work_experience)) {
    data.work_experience.sort((a, b) => {
      const da = a.start_date || '';
      const db = b.start_date || '';
      return db.localeCompare(da);
    });
  }

  // Sort internships by date DESC
  if (Array.isArray(data.internships)) {
    data.internships.sort((a, b) => {
      const da = a.start_date || '';
      const db = b.start_date || '';
      return db.localeCompare(da);
    });
  }

  // Remove empty/irrelevant sections
  const keepIf = (arr) => Array.isArray(arr) && arr.length > 0;
  if (!keepIf(data.work_experience)) delete data.work_experience;
  if (!keepIf(data.internships)) delete data.internships;
  if (!keepIf(data.projects)) delete data.projects;
  if (!keepIf(data.education)) delete data.education;
  if (!keepIf(data.certifications)) delete data.certifications;
  if (!keepIf(data.awards)) delete data.awards;
  if (!keepIf(data.languages)) delete data.languages;
  if (!keepIf(data.publications)) delete data.publications;

  // Remove empty skills categories
  if (data.skills) {
    const cleaned = {};
    for (const [cat, items] of Object.entries(data.skills)) {
      if (Array.isArray(items) && items.length > 0) {
        cleaned[cat] = items;
      }
    }
    data.skills = cleaned;
  }

  // Remove empty links
  if (data.personal_info?.links) {
    const links = data.personal_info.links;
    if (!links.github && !links.linkedin && !links.portfolio && !links.website) {
      links.github = null;
      links.linkedin = null;
    }
  }

  // Ensure career_objective.summary_facts is array
  if (data.career_objective?.summary_facts) {
    if (!Array.isArray(data.career_objective.summary_facts) ||
        data.career_objective.summary_facts.length === 0) {
      delete data.career_objective.summary_facts;
    }
  }

  return data;
}

// ─── Template Engine (Handlebars-compatible subset) ─────────────────

function htmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Resolve a dot-path against the context stack.
 * Example: "personal_info.full_name" → contextStack[top].personal_info.full_name
 */
function resolvePath(path, contextStack) {
  if (path === 'this') return contextStack[contextStack.length - 1];

  const parts = path.split('.');
  // Search from top of stack down
  for (let i = contextStack.length - 1; i >= 0; i--) {
    let val = contextStack[i];
    if (val === null || val === undefined) continue;
    let found = true;
    for (const part of parts) {
      if (val === null || val === undefined || typeof val !== 'object') {
        found = false;
        break;
      }
      val = val[part];
    }
    if (found) return val;
  }
  return undefined;
}

/**
 * Check if a value is truthy (for {{#if}}).
 */
function isTruthy(val) {
  if (val === null || val === undefined || val === false) return false;
  if (Array.isArray(val) && val.length === 0) return false;
  if (typeof val === 'object' && Object.keys(val).length === 0) return false;
  return true;
}

/**
 * Compile a Handlebars-style template string into a render function.
 *
 * Supports:
 *   {{key.path}}        — escaped interpolation
 *   {{{key.path}}}      — raw (unescaped) interpolation
 *   {{#each arr}}...{{/each}} — loop; inside, context is the item
 *   {{#if key}}...{{/if}}
 *   {{#if key}}...{{else}}...{{/if}}
 *   {{> partialName}}   — include partial
 *   {{@first}} {{@last}} — available inside #each
 *   {{join arr ", "}}   — join array with separator
 *
 * @param {string} template
 * @param {Object<string, string>} partials
 * @returns {Function} render(data, extra) → string
 */
function compile(template, partials = {}) {
  // Pre-compile all partials
  const compiledPartials = {};
  for (const [name, src] of Object.entries(partials)) {
    compiledPartials[name] = compile(src, {}); // Partials don't nest in v1
  }

  /**
   * Inner recursive render. Walks the template string, handling blocks.
   */
  function renderBlock(tmpl, contextStack) {
    let output = '';
    let pos = 0;

    // Find the next Handlebars token
    const TOKEN_RE = /\{\{\{?([#/>]?)\s*([^}]+?)\s*\}?\}\}/g;
    let match;

    while ((match = TOKEN_RE.exec(tmpl)) !== null) {
      const [fullMatch, prefix, inner] = match;
      const before = tmpl.slice(pos, match.index);
      output += before;
      pos = match.index + fullMatch.length;

      const trimmed = inner.trim();

      // ─── {{> partialName}} ──────────────────────────────────────
      if (prefix === '>') {
        const partialFn = compiledPartials[trimmed];
        if (partialFn) {
          output += partialFn(contextStack[contextStack.length - 1]);
        }
        continue;
      }

      // ─── {{{raw}}} ──────────────────────────────────────────────
      if (prefix === '' && fullMatch.startsWith('{{{')) {
        const val = resolvePath(trimmed, contextStack);
        output += (val !== undefined && val !== null) ? String(val) : '';
        continue;
      }

      // ─── {{#each array}}...{{/each}} ─────────────────────────────
      if (prefix === '#' && trimmed.startsWith('each ')) {
        const arrayPath = trimmed.slice(5).trim();
        const endTag = '/each';
        const endIdx = findMatchingClose(tmpl, pos, 'each', endTag);
        if (endIdx === -1) { output += fullMatch; continue; }

        const body = tmpl.slice(pos, endIdx);
        pos = endIdx + `{{${endTag}}}`.length;
        TOKEN_RE.lastIndex = pos; // Sync regex position after skip

        const arr = resolvePath(arrayPath, contextStack);
        if (Array.isArray(arr) && arr.length > 0) {
          for (let i = 0; i < arr.length; i++) {
            contextStack.push(arr[i]);
            // Add @first / @last to the item if it's an object
            const item = arr[i];
            const augmented = (typeof item === 'object' && item !== null) ? item : {};
            const origFirst = augmented['@first'];
            const origLast = augmented['@last'];
            augmented['@first'] = i === 0;
            augmented['@last'] = i === arr.length - 1;
            output += renderBlock(body, contextStack);
            if (origFirst !== undefined) augmented['@first'] = origFirst;
            else delete augmented['@first'];
            if (origLast !== undefined) augmented['@last'] = origLast;
            else delete augmented['@last'];
            contextStack.pop();
          }
        }
        continue;
      }

      // ─── {{#if cond}}...{{else}}...{{/if}} ───────────────────────
      if (prefix === '#' && trimmed.startsWith('if ')) {
        const condPath = trimmed.slice(3).trim();
        const endTag = '/if';
        const endIdx = findMatchingClose(tmpl, pos, 'if', endTag);
        if (endIdx === -1) { output += fullMatch; continue; }

        const fullBody = tmpl.slice(pos, endIdx);
        pos = endIdx + `{{${endTag}}}`.length;
        TOKEN_RE.lastIndex = pos; // Sync regex position after skip

        // Check for {{else}} within the body
        const elseMatch = findElse(tmpl.slice(pos - fullBody.length - fullMatch.length, pos));
        let ifBody, elseBody;

        if (elseMatch !== null) {
          // elseMatch is relative to the start of the body
          ifBody = fullBody.slice(0, elseMatch);
          elseBody = fullBody.slice(elseMatch + '{{else}}'.length);
        } else {
          ifBody = fullBody;
          elseBody = null;
        }

        const condVal = resolvePath(condPath, contextStack);
        if (isTruthy(condVal)) {
          output += renderBlock(ifBody, contextStack);
        } else if (elseBody !== null) {
          output += renderBlock(elseBody, contextStack);
        }
        continue;
      }

      // ─── {{join arr separator}} ─────────────────────────────────
      if (prefix === '' && trimmed.startsWith('join ')) {
        const rest = trimmed.slice(5).trim();
        // Parse: join arrayPath "separator"  (separator may contain spaces)
        const sepMatch = rest.match(/^(.+?)\s+["'](.+?)["']$/);
        if (sepMatch) {
          const arrPath = sepMatch[1];
          const sep = sepMatch[2];
          const arr = resolvePath(arrPath, contextStack);
          output += Array.isArray(arr) ? arr.join(sep) : '';
        }
        continue;
      }

      // ─── {{@first}} / {{@last}} ─────────────────────────────────
      if (trimmed === '@first' || trimmed === '@last') {
        const val = resolvePath(trimmed, contextStack);
        output += val ? String(val) : '';
        continue;
      }

      // ─── {{key.path}} (escaped) ─────────────────────────────────
      if (prefix === '') {
        const val = resolvePath(trimmed, contextStack);
        if (val !== undefined && val !== null) {
          output += htmlEscape(String(val));
        }
        continue;
      }

      // Unknown token — output as-is
      output += fullMatch;
    }

    // Remaining text after last token
    output += tmpl.slice(pos);
    return output;
  }

  function findMatchingClose(tmpl, startPos, blockName, endTag) {
    let depth = 1;
    const openRe = new RegExp(`\\{\\{#${blockName}\\s`, 'g');
    const closeRe = new RegExp(`\\{\\{${endTag}\\}\\}`, 'g');

    let searchFrom = startPos;
    while (depth > 0) {
      // Find next open or close
      openRe.lastIndex = searchFrom;
      closeRe.lastIndex = searchFrom;

      const openMatch = openRe.exec(tmpl);
      const closeMatch = closeRe.exec(tmpl);

      if (!closeMatch) return -1; // No matching close

      if (openMatch && openMatch.index < closeMatch.index) {
        depth++;
        searchFrom = openMatch.index + openMatch[0].length;
      } else {
        depth--;
        if (depth === 0) return closeMatch.index;
        searchFrom = closeMatch.index + closeMatch[0].length;
      }
    }
    return -1;
  }

  function findElse(body) {
    // Find {{else}} at the top level (not inside nested blocks)
    let depth = 0;
    const tokenRe = /\{\{(#|\/)(\w+)\s/g;
    const elseRe = /\{\{else\}\}/g;

    let match;
    while ((match = tokenRe.exec(body)) !== null) {
      if (match[1] === '#') depth++;
      else if (match[1] === '/') depth--;
    }

    // Simpler approach: find {{else}} where depth is 0
    const allTokens = [];
    const anyToken = /\{\{(?:#(\w+)\s|\/(\w+)|else)\}\}/g;
    while ((match = anyToken.exec(body)) !== null) {
      if (match[0] === '{{else}}' && depth === 0) return match.index;
      if (match[1]) depth++; // #block
      if (match[2]) depth--; // /block
    }
    return null;
  }

  return (data, extra = {}) => {
    const ctx = { ...data, ...extra };
    return renderBlock(template, [ctx]);
  };
}

// ─── Template Loading ────────────────────────────────────────────────

function loadTemplates(templateName) {
  const templateDir = join(TEMPLATES_DIR, templateName);
  if (!existsSync(templateDir)) {
    console.error(`Template not found: ${templateName} (${templateDir})`);
    process.exit(1);
  }

  const partialsDir = join(templateDir, 'partials');
  const partials = {};

  // Load partials
  if (existsSync(partialsDir)) {
    for (const file of readdirSync(partialsDir)) {
      if (file.endsWith('.hbs')) {
        const name = basename(file, '.hbs');
        partials[name] = readFileSync(join(partialsDir, file), 'utf-8');
      }
    }
  }

  // Load main template
  const mainTemplate = readFileSync(join(templateDir, 'template.hbs'), 'utf-8');

  // Load CSS
  const cssPath = join(templateDir, 'style.css');
  const style = existsSync(cssPath) ? readFileSync(cssPath, 'utf-8') : '';

  return { mainTemplate, partials, style };
}

// ─── HTML Rendering ──────────────────────────────────────────────────

function renderHTML(transformedData, template, liveReload = false) {
  const compiled = compile(template, transformedData.partials);
  const renderData = {
    ...transformedData.data,
    style: transformedData.style,
    liveReload,
  };
  return compiled(renderData);
}

// ─── Live Reload Script Injection ────────────────────────────────────

const LIVE_RELOAD_SCRIPT = `
<script>
(function() {
  var src = new EventSource('/__reload');
  src.onmessage = function() { location.reload(); };
  src.onerror = function() {
    // Reconnect after brief delay
    src.close();
    setTimeout(function() {
      var newSrc = new EventSource('/__reload');
      newSrc.onmessage = function() { location.reload(); };
    }, 1000);
  };
})();
</script>
`;

function injectLiveReload(html) {
  if (html.includes('</body>')) {
    return html.replace('</body>', `${LIVE_RELOAD_SCRIPT}\n</body>`);
  }
  return html + '\n' + LIVE_RELOAD_SCRIPT;
}

// ─── Dev Server ──────────────────────────────────────────────────────

function startServer(port, outputPath, watchPaths, onRebuild, openBrowser) {
  let clients = [];

  // Try ports until one works
  function tryListen(attemptPort) {
    const server = createServer((req, res) => {
      if (req.url === '/__reload') {
        // SSE endpoint
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });
        res.write(':ok\n\n');
        clients.push(res);
        req.on('close', () => {
          clients = clients.filter(c => c !== res);
        });
        return;
      }

      // Serve the output HTML
      try {
        const html = readFileSync(outputPath, 'utf-8');
        const htmlWithReload = injectLiveReload(html);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(htmlWithReload);
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error reading resume HTML');
      }
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`  Port ${attemptPort} in use, trying ${attemptPort + 1}...`);
        tryListen(attemptPort + 1);
      } else {
        console.error(`Server error: ${err.message}`);
      }
    });

    server.listen(attemptPort, () => {
      const actualPort = attemptPort;
      console.log(`\n  Dev server running at http://localhost:${actualPort}`);
      console.log(`  Watching for changes...`);
      console.log(`  Press Ctrl+C to stop\n`);

      // Setup file watchers
      for (const watchPath of watchPaths) {
        if (!existsSync(watchPath)) continue;
        try {
          const watcher = watch(watchPath, { recursive: true }, (eventType, filename) => {
            if (filename && !filename.startsWith('.')) {
              console.log(`  [${new Date().toLocaleTimeString()}] ${filename} changed — rebuilding...`);
              try {
                // Small debounce to avoid double-fires
                if (watcher._timeout) clearTimeout(watcher._timeout);
                watcher._timeout = setTimeout(() => {
                  onRebuild();
                  // Notify all SSE clients
                  for (const client of clients) {
                    client.write('data: reload\n\n');
                  }
                  console.log(`  [${new Date().toLocaleTimeString()}] Reload pushed to browser`);
                }, 150);
              } catch (err) {
                console.error(`  Rebuild error: ${err.message}`);
              }
            }
          });
          watcher.on('error', () => {}); // Suppress watch errors
        } catch {
          // fs.watch may fail on some platforms; silently skip
        }
      }

      if (openBrowser) {
        const { exec } = await_import_or_null();
        if (exec) {
          const cmd = process.platform === 'win32'
            ? `start http://localhost:${actualPort}`
            : process.platform === 'darwin'
              ? `open http://localhost:${actualPort}`
              : `xdg-open http://localhost:${actualPort}`;
          exec(cmd);
        }
      }
    });

    return server;
  }

  return tryListen(port);
}

// Dynamic import for child_process (only when --open is used)
async function await_import_or_null() {
  try {
    return await import('node:child_process');
  } catch {
    return null;
  }
}

// ─── Photo Handling ──────────────────────────────────────────────────

/**
 * Auto-detect profile.png in the working directory, convert to base64
 * data URI, and copy to the visualizer's plugin directory.
 *
 * Returns { dataUri, copied } or null if no photo found.
 */
function detectAndEmbedPhoto() {
  const photoPath = resolve(process.cwd(), 'profile.png');

  if (!existsSync(photoPath)) {
    return null;
  }

  try {
    const imageBuffer = readFileSync(photoPath);
    const ext = extname(photoPath).toLowerCase();
    const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    const dataUri = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

    // Copy to visualizer plugin directory
    const destDir = SKILL_ROOT;
    const destPath = join(destDir, basename(photoPath));
    writeFileSync(destPath, imageBuffer);
    const photoSize = (imageBuffer.length / 1024).toFixed(1);

    console.log(`  📷 Detected profile photo: ${basename(photoPath)} (${photoSize} KB)`);
    console.log(`     → Embedded as base64 data URI`);
    console.log(`     → Copied to ${relative(process.cwd(), destPath)}`);

    return { dataUri, copied: destPath };
  } catch (err) {
    console.error(`  ⚠ Failed to process profile photo: ${err.message}`);
    return null;
  }
}

/**
 * Return a relative path string, or absolute if on different drives.
 */
function relative(from, to) {
  const fromParts = resolve(from).split(/[\\/]/);
  const toParts = resolve(to).split(/[\\/]/);
  // If different roots (e.g., different drives on Windows), return absolute
  if (fromParts[0] !== toParts[0]) return to;
  const rel = join(...toParts.slice(fromParts.length));
  return rel || '.';
}

// ─── Build Pipeline ──────────────────────────────────────────────────

function build(inputPath, outputPath, templateName, serve, photoDataUri) {
  // 1. Read JSON
  let raw;
  try {
    raw = JSON.parse(readFileSync(inputPath, 'utf-8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`Error: Input file not found: ${inputPath}`);
    } else if (err instanceof SyntaxError) {
      console.error(`Error: Invalid JSON in ${inputPath}`);
      console.error(`  ${err.message}`);
    } else {
      console.error(`Error reading ${inputPath}: ${err.message}`);
    }
    process.exit(1);
  }

  const inputSize = (readFileSync(inputPath, 'utf-8').length / 1024).toFixed(1);
  console.log(`  ✓ Parsed ${basename(inputPath)} (${inputSize} KB)`);

  // Inject photo if detected and not already set
  if (photoDataUri) {
    if (!raw.personal_info) raw.personal_info = {};
    if (!raw.personal_info.photo) {
      raw.personal_info.photo = photoDataUri;
      console.log(`  📷 Photo injected into personal_info.photo`);
    } else {
      console.log(`  📷 Photo detected but personal_info.photo already set — skipping auto-inject`);
    }
  }

  // 2. Load template
  const { mainTemplate, partials, style } = loadTemplates(templateName);
  console.log(`  ✓ Loaded template "${templateName}" (${Object.keys(partials).length} partials)`);

  // 3. Transform data
  const data = transformData(raw);

  // 4. Render
  const renderFn = compile(mainTemplate, partials);
  const html = renderFn({ ...data, style });
  const fullHtml = '<!DOCTYPE html>\n' + html;

  // 5. Write
  writeFileSync(outputPath, fullHtml, 'utf-8');
  const outputSize = (fullHtml.length / 1024).toFixed(1);
  console.log(`  ✓ Written to ${basename(outputPath)} (${outputSize} KB)`);

  return { success: true };
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Resolve input path
  const inputPath = resolve(process.cwd(), args.input);
  const outputPath = resolve(process.cwd(), args.output);

  console.log(`\nSuperResume Visualizer`);
  console.log(`  Input:  ${inputPath}`);
  console.log(`  Output: ${outputPath}`);
  console.log(`  Template: ${args.template}\n`);

  // Auto-detect profile photo
  const photoResult = detectAndEmbedPhoto();
  const photoDataUri = photoResult ? photoResult.dataUri : null;

  // Build once
  build(inputPath, outputPath, args.template, args.serve, photoDataUri);

  if (!args.serve) {
    console.log('Done. Open the HTML file in your browser to preview.');
    return;
  }

  // Dev server with live reload
  const watchPaths = [
    inputPath,
    join(TEMPLATES_DIR, args.template),
  ];

  // Add extra watch paths
  for (const w of args.extraWatch) {
    watchPaths.push(resolve(process.cwd(), w));
  }

  const server = startServer(
    args.port,
    outputPath,
    watchPaths,
    () => build(inputPath, outputPath, args.template, true, photoDataUri),
    args.open
  );

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.close();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    server.close();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
