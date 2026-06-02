#!/usr/bin/env node

import { existsSync, renameSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VALIDATOR = join(__dirname, 'validate-profile.mjs');

function usage(exitCode = 2) {
  console.error(`Usage:
  node skills/profile-loader/profile-store.mjs merge --profile base --patch patch.json
  node skills/profile-loader/profile-store.mjs merge --profile target --id company-role --patch patch.json
  node skills/profile-loader/profile-store.mjs merge --file data/profiles/base.json --schema base --patch patch.json

Options:
  --profile base|target   Resolve the standard profile path under data/profiles
  --id <slug>             Target profile slug when --profile target is used
  --file <path>           Explicit output JSON path
  --schema base|target    Validation schema for explicit --file
  --patch <path>          Small JSON merge patch file
  --dry-run               Validate and print without writing
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    command: argv[0],
    profile: null,
    id: null,
    file: null,
    schema: null,
    patch: null,
    dryRun: false,
  };

  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--profile') args.profile = argv[++i];
    else if (arg === '--id') args.id = argv[++i];
    else if (arg === '--file') args.file = argv[++i];
    else if (arg === '--schema') args.schema = argv[++i];
    else if (arg === '--patch') args.patch = argv[++i];
    else if (arg === '--dry-run') args.dryRun = true;
    else usage();
  }

  if (args.command !== 'merge') usage();
  if (!args.patch) usage();
  if (args.file && !args.schema) usage();
  if (!args.file && !args.profile) usage();
  return args;
}

function resolveDestination(args) {
  if (args.file) {
    return {
      filePath: resolve(process.cwd(), args.file),
      schema: args.schema,
    };
  }

  if (args.profile === 'base') {
    return {
      filePath: resolve(process.cwd(), 'data/profiles/base.json'),
      schema: 'base',
    };
  }

  if (args.profile === 'target') {
    if (!args.id) {
      console.error('ERROR: --id is required when --profile target is used');
      process.exit(2);
    }
    return {
      filePath: resolve(process.cwd(), 'data/profiles/targets', `${args.id}.json`),
      schema: 'target',
    };
  }

  console.error(`ERROR: Unknown profile: ${args.profile}`);
  process.exit(2);
}

async function readJson(filePath, label) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`ERROR: ${label} not found: ${filePath}`);
      process.exit(2);
    }
    if (err instanceof SyntaxError) {
      console.error(`ERROR: ${label} is not valid JSON: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergePatch(target, patch) {
  if (!isPlainObject(patch)) return patch;
  const base = isPlainObject(target) ? { ...target } : {};

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete base[key];
    } else if (isPlainObject(value)) {
      base[key] = mergePatch(base[key], value);
    } else {
      base[key] = value;
    }
  }

  return base;
}

function validate(filePath, schema) {
  const result = spawnSync(process.execPath, [
    VALIDATOR,
    filePath,
    '--schema',
    schema,
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function writeAtomic(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  await writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  renameSync(tmpPath, filePath);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { filePath, schema } = resolveDestination(args);
  const patchPath = resolve(process.cwd(), args.patch);
  const current = existsSync(filePath) ? await readJson(filePath, 'profile') : {};
  const patch = await readJson(patchPath, 'patch');
  const merged = mergePatch(current, patch);

  if (args.dryRun) {
    const tmpPath = `${filePath}.dry-run-${process.pid}`;
    await writeAtomic(tmpPath, merged);
    validate(tmpPath, schema);
    process.stdout.write(JSON.stringify(merged, null, 2));
    return;
  }

  await writeAtomic(filePath, merged);
  validate(filePath, schema);
  console.log(`Wrote ${relative(process.cwd(), filePath)}`);
}

main().catch(err => {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
});
