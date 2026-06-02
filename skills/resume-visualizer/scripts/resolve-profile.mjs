#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_SCRIPT = join(__dirname, 'render-resume.mjs');
const VALIDATOR = resolve(__dirname, '../../profile-loader/validate-profile.mjs');

function usage(exitCode = 2) {
  console.error(`Usage:
  node skills/resume-visualizer/scripts/resolve-profile.mjs [input] [--json] [--no-validate]

Inputs:
  base                 data/profiles/base.json
  latest               newest JSON under data/profiles/targets, falling back to base
  target:<slug>        data/profiles/targets/<slug>.json
  <path.json>          explicit JSON file

Options:
  --json               Print machine-readable resolution output
  --no-validate        Skip profile validation
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    input: null,
    json: false,
    validate: true,
  };

  for (const arg of argv) {
    if (arg === '--json') args.json = true;
    else if (arg === '--no-validate') args.validate = false;
    else if (arg.startsWith('-')) usage();
    else if (!args.input) args.input = arg;
    else usage();
  }

  return args;
}

function newestTarget() {
  const targetDir = resolve(process.cwd(), 'data/profiles/targets');
  if (!existsSync(targetDir)) return null;
  const files = readdirSync(targetDir)
    .filter(file => extname(file).toLowerCase() === '.json')
    .map(file => {
      const fullPath = join(targetDir, file);
      return { path: fullPath, mtimeMs: statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0]?.path ?? null;
}

function resolveInput(input) {
  if (!input || input === 'latest') {
    const target = newestTarget();
    if (target) return target;
    return resolve(process.cwd(), 'data/profiles/base.json');
  }

  if (input === 'base') {
    return resolve(process.cwd(), 'data/profiles/base.json');
  }

  if (input.startsWith('target:')) {
    const slug = input.slice('target:'.length);
    if (!slug) usage();
    return resolve(process.cwd(), 'data/profiles/targets', `${slug}.json`);
  }

  return resolve(process.cwd(), input);
}

function schemaForPath(filePath) {
  return filePath.includes(`${join('data', 'profiles', 'targets')}`) ? 'target' : 'base';
}

function validate(filePath, schema) {
  const result = spawnSync(process.execPath, [
    VALIDATOR,
    filePath,
    '--schema',
    schema,
    '--quiet',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const profilePath = resolveInput(args.input);

  if (!existsSync(profilePath)) {
    console.error(`ERROR: Profile JSON not found: ${profilePath}`);
    process.exit(2);
  }

  const schema = schemaForPath(profilePath);
  if (args.validate) validate(profilePath, schema);

  const outputPath = resolve(process.cwd(), `${schema === 'target' ? 'target' : 'base'}-preview.html`);
  const renderCommand = [
    'node',
    RENDER_SCRIPT,
    profilePath,
    outputPath,
  ];

  const result = {
    path: profilePath,
    schema,
    output: outputPath,
    render_command: renderCommand,
  };

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`Profile: ${profilePath}`);
  console.log(`Schema: ${schema}`);
  console.log(`Render: ${renderCommand.join(' ')}`);
}

main();
