#!/usr/bin/env node

/**
 * validate-profile.mjs — SuperResume Profile JSON Validator
 *
 * Validates a profile JSON file for syntax correctness and schema compliance.
 * MUST be used by profile-loader before and after every JSON write operation.
 *
 * Usage:
 *   node skills/profile-loader/validate-profile.mjs <file.json> [--schema base|target]
 *   node skills/profile-loader/validate-profile.mjs data/profiles/base.json --schema base
 *   node skills/profile-loader/validate-profile.mjs data/profiles/targets/foo.json --schema target
 *
 * Exit codes:
 *   0 — valid
 *   1 — validation errors found
 *   2 — usage error (file not found, etc.)
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, basename } from 'node:path';

// ─── Schema Definitions ───────────────────────────────────────────────

const REQUIRED_TOP_KEYS_BASE = [
  'schema_version',
  'profile_type',
  'personal_info',
  'education',
  'work_experience',
  'internships',
  'projects',
  'skills',
  'certifications',
  'awards',
  'languages',
];

const REQUIRED_TOP_KEYS_TARGET = [
  'schema_version',
  'profile_type',
  'profile_id',
  'source_profile',
  'target',
  'selected_profile',
  'tailored_content',
  'fact_traceability',
];

const REQUIRED_PERSONAL_INFO = [
  'full_name', 'email', 'phone', 'location', 'links'
];

const REQUIRED_SKILL_CATEGORIES = [
  'programming_languages', 'frameworks', 'tools', 'platforms',
  'databases', 'methodologies', 'domain_skills', 'soft_skills'
];

const ID_PATTERNS = {
  education: /^edu-\d{3,}$/,
  work_experience: /^work-\d{3,}$/,
  internships: /^intern-\d{3,}$/,
  projects: /^project-\d{3,}$/,
  certifications: /^cert-\d{3,}$/,
  awards: /^award-\d{3,}$/,
};

// ─── Validation Helpers ───────────────────────────────────────────────

const errors = [];
const warnings = [];

function error(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function isObject(val) {
  return val !== null && typeof val === 'object' && !Array.isArray(val);
}

function isArray(val) {
  return Array.isArray(val);
}

function isString(val) {
  return typeof val === 'string';
}

function isStringOrNull(val) {
  return val === null || typeof val === 'string';
}

// ─── Validators ───────────────────────────────────────────────────────

function validateTopLevel(data, requiredKeys) {
  for (const key of requiredKeys) {
    if (!(key in data)) {
      error(`Missing required top-level key: "${key}"`);
    }
  }

  // schema_version must be a string
  if ('schema_version' in data && !isString(data.schema_version)) {
    error(`"schema_version" must be a string, got ${typeof data.schema_version}`);
  }

  // profile_type must match
  if ('profile_type' in data) {
    if (data.profile_type !== 'base' && data.profile_type !== 'targeted') {
      error(`"profile_type" must be "base" or "targeted", got "${data.profile_type}"`);
    }
  }
}

function validatePersonalInfo(pi) {
  if (!isObject(pi)) {
    error('"personal_info" must be an object');
    return;
  }

  for (const key of REQUIRED_PERSONAL_INFO) {
    if (!(key in pi)) {
      error(`Missing required field in personal_info: "${key}"`);
    }
  }

  if ('links' in pi && !isObject(pi.links)) {
    error('"personal_info.links" must be an object');
  }

  // Warn on empty critical fields
  if (!pi.full_name && pi.full_name !== null) {
    error('"personal_info.full_name" should be a string or null');
  }
  if (!pi.email && pi.email !== null) {
    error('"personal_info.email" should be a string or null');
  }
}

function validateEntryArray(data, key, idPattern) {
  const arr = data[key];
  if (!isArray(arr)) {
    error(`"${key}" must be an array`);
    return;
  }

  const seenIds = new Set();
  for (let i = 0; i < arr.length; i++) {
    const entry = arr[i];

    if (!isObject(entry)) {
      error(`"${key}[${i}]" must be an object`);
      continue;
    }

    // Check ID
    if (!('id' in entry)) {
      error(`"${key}[${i}]" missing "id" field`);
    } else {
      const id = entry.id;
      if (!isString(id)) {
        error(`"${key}[${i}].id" must be a string, got ${typeof id}`);
      } else if (idPattern && !idPattern.test(id)) {
        error(`"${key}[${i}].id" "${id}" does not match pattern ${idPattern}`);
      } else if (seenIds.has(id)) {
        error(`"${key}[${i}].id" "${id}" is duplicated`);
      } else {
        seenIds.add(id);
      }
    }

    // Check dates if present
    for (const dateField of ['start_date', 'end_date']) {
      if (dateField in entry && entry[dateField] !== null) {
        const d = entry[dateField];
        if (!isString(d)) {
          error(`"${key}[${i}].${dateField}" must be a string or null`);
        } else if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(d) && d !== 'present') {
          error(`"${key}[${i}].${dateField}" "${d}" is not a valid date format (expected YYYY, YYYY-MM, or YYYY-MM-DD)`);
        }
      }
    }

    // Check source_notes if present
    if ('source_notes' in entry && !isArray(entry.source_notes)) {
      error(`"${key}[${i}].source_notes" must be an array`);
    }
  }
}

function validateSkills(skills) {
  if (!isObject(skills)) {
    error('"skills" must be an object');
    return;
  }

  for (const cat of REQUIRED_SKILL_CATEGORIES) {
    if (!(cat in skills)) {
      error(`Missing required skill category: "skills.${cat}"`);
    } else if (!isArray(skills[cat])) {
      error(`"skills.${cat}" must be an array`);
    }
  }

  // Check for unknown categories
  for (const key of Object.keys(skills)) {
    if (!REQUIRED_SKILL_CATEGORIES.includes(key)) {
      error(`Unknown skill category: "skills.${key}" (allowed: ${REQUIRED_SKILL_CATEGORIES.join(', ')})`);
    }
  }
}

function validateBaseSpecific(data) {
  // education entries
  for (let i = 0; i < (data.education || []).length; i++) {
    const edu = data.education[i];
    if (!isObject(edu)) continue;
    for (const field of ['school', 'degree', 'major']) {
      if (field in edu && !isStringOrNull(edu[field])) {
        error(`"education[${i}].${field}" must be a string or null`);
      }
    }
  }

  // work_experience entries
  for (let i = 0; i < (data.work_experience || []).length; i++) {
    const work = data.work_experience[i];
    if (!isObject(work)) continue;
    if ('is_current' in work && typeof work.is_current !== 'boolean') {
      error(`"work_experience[${i}].is_current" must be a boolean`);
    }
    if ('achievements' in work) {
      if (!isArray(work.achievements)) {
        error(`"work_experience[${i}].achievements" must be an array`);
      } else {
        for (let j = 0; j < work.achievements.length; j++) {
          const ach = work.achievements[j];
          if (!isObject(ach)) continue;
          if ('confidence' in ach && !['high', 'medium', 'low', 'unknown'].includes(ach.confidence)) {
            error(`"work_experience[${i}].achievements[${j}].confidence" must be one of: high, medium, low, unknown`);
          }
        }
      }
    }
  }

  // Internships and projects use same entry validation
  validateEntryArray(data, 'internships');
  validateEntryArray(data, 'projects');
  validateEntryArray(data, 'certifications');
  validateEntryArray(data, 'awards');

  // languages
  if (isArray(data.languages)) {
    for (let i = 0; i < data.languages.length; i++) {
      const lang = data.languages[i];
      if (!isObject(lang)) continue;
      if ('proficiency' in lang && lang.proficiency !== null) {
        const valid = ['native', 'fluent', 'professional', 'intermediate', 'basic'];
        const lower = String(lang.proficiency).toLowerCase();
        if (!valid.some(v => lower.includes(v))) {
          warn(`"languages[${i}].proficiency" "${lang.proficiency}" — consider using one of: ${valid.join(', ')}`);
        }
      }
    }
  }
}

function validateTargetSpecific(data) {
  // target section
  if (!isObject(data.target)) {
    error('"target" must be an object');
  } else {
    if (!('company' in data.target)) error('Missing "target.company"');
    if (!('role' in data.target)) error('Missing "target.role"');
    if ('keywords' in data.target && !isArray(data.target.keywords)) {
      error('"target.keywords" must be an array');
    }
    if ('priorities' in data.target && !isArray(data.target.priorities)) {
      error('"target.priorities" must be an array');
    }
  }

  // selected_profile section
  if (!isObject(data.selected_profile)) {
    error('"selected_profile" must be an object');
  } else {
    const idFields = ['education_ids', 'work_experience_ids', 'internship_ids',
                      'project_ids', 'certification_ids', 'award_ids'];
    for (const field of idFields) {
      if (field in data.selected_profile && !isArray(data.selected_profile[field])) {
        error(`"selected_profile.${field}" must be an array`);
      }
    }
  }

  // tailored_content section
  if (!isObject(data.tailored_content)) {
    error('"tailored_content" must be an object');
  } else {
    for (const field of ['experience_bullets', 'project_bullets', 'skills_section', 'notes_for_resume_writer']) {
      if (field in data.tailored_content && !isArray(data.tailored_content[field])) {
        error(`"tailored_content.${field}" must be an array`);
      }
    }
  }

  // fact_traceability
  if (!isArray(data.fact_traceability)) {
    error('"fact_traceability" must be an array');
  } else {
    for (let i = 0; i < data.fact_traceability.length; i++) {
      const ft = data.fact_traceability[i];
      if (!isObject(ft)) continue;
      if ('confidence' in ft && !['high', 'medium', 'low', 'unknown'].includes(ft.confidence)) {
        error(`"fact_traceability[${i}].confidence" must be one of: high, medium, low, unknown`);
      }
    }
  }
}

function validateMetadata(data) {
  if ('last_updated' in data) {
    const d = data.last_updated;
    if (d !== null && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      error(`"last_updated" "${d}" is not a valid date (expected YYYY-MM-DD)`);
    }
  }
  if (isObject(data.metadata)) {
    if ('created_at' in data.metadata && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.metadata.created_at || ''))) {
      error(`"metadata.created_at" must be YYYY-MM-DD format`);
    }
    if ('updated_at' in data.metadata && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.metadata.updated_at || ''))) {
      error(`"metadata.updated_at" must be YYYY-MM-DD format`);
    }
  }
}

// ─── Duplicate ID Check ──────────────────────────────────────────────

function checkCrossSectionDuplicateIds(data) {
  const sections = ['education', 'work_experience', 'internships', 'projects', 'certifications', 'awards'];
  const globalIds = new Map(); // id → [section, index]

  for (const section of sections) {
    const arr = data[section];
    if (!isArray(arr)) continue;
    for (let i = 0; i < arr.length; i++) {
      const entry = arr[i];
      if (!isObject(entry) || !entry.id) continue;
      const key = `${section}:${entry.id}`;
      if (globalIds.has(entry.id)) {
        const [otherSection, otherIdx] = globalIds.get(entry.id);
        error(`Duplicate ID "${entry.id}" found in "${section}[${i}]" and "${otherSection}[${otherIdx}]" (IDs should be unique across sections or at minimum prefixed uniquely)`);
      }
      globalIds.set(entry.id, [section, i]);
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node validate-profile.mjs <file.json> [--schema base|target]');
    console.error('');
    console.error('Options:');
    console.error('  --schema base    Validate against base profile schema (default)');
    console.error('  --schema target  Validate against target profile schema');
    console.error('  --quiet          Only output errors, no success message');
    process.exit(2);
  }

  const filePath = resolve(process.cwd(), args[0]);

  // Parse options
  let schemaType = 'base'; // default
  let quiet = false;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--schema' && args[i + 1]) {
      schemaType = args[i + 1];
      i++;
    } else if (args[i] === '--quiet') {
      quiet = true;
    }
  }

  if (!['base', 'target'].includes(schemaType)) {
    console.error(`Invalid schema type: "${schemaType}". Must be "base" or "target".`);
    process.exit(2);
  }

  // Check file exists
  if (!existsSync(filePath)) {
    console.error(`ERROR: File not found: ${filePath}`);
    process.exit(2);
  }

  // Read and parse JSON
  let data;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    data = JSON.parse(raw);
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error(`SYNTAX ERROR: ${err.message}`);
      console.error(`File: ${basename(filePath)}`);
      process.exit(1);
    }
    console.error(`READ ERROR: ${err.message}`);
    process.exit(2);
  }

  const fileName = basename(filePath);
  const fileSize = (readFileSync(filePath, 'utf-8').length / 1024).toFixed(1);

  // Validate
  if (schemaType === 'base') {
    validateTopLevel(data, REQUIRED_TOP_KEYS_BASE);
  } else {
    validateTopLevel(data, REQUIRED_TOP_KEYS_TARGET);
  }

  validatePersonalInfo(data.personal_info || {});
  validateSkills(data.skills || {});

  // Section entry validation
  if (schemaType === 'base') {
    validateEntryArray(data, 'education', ID_PATTERNS.education);
    validateEntryArray(data, 'work_experience', ID_PATTERNS.work_experience);
    validateBaseSpecific(data);
    checkCrossSectionDuplicateIds(data);
  } else {
    validateTargetSpecific(data);
  }

  validateMetadata(data);

  // Report warnings (non-blocking)
  if (warnings.length > 0) {
    console.error(`\n💡 WARNINGS — ${warnings.length} advisory issue(s)`);
    for (let i = 0; i < warnings.length; i++) {
      console.error(`  ${i + 1}. ${warnings[i]}`);
    }
  }

  // Report errors (blocking)
  if (errors.length > 0) {
    console.error(`\n❌ VALIDATION FAILED — ${errors.length} error(s) found`);
    console.error(`   File: ${fileName} (${fileSize} KB)`);
    console.error(`   Schema: ${schemaType}`);
    console.error('');
    for (let i = 0; i < errors.length; i++) {
      console.error(`  ${i + 1}. ${errors[i]}`);
    }
    console.error('');
    process.exit(1);
  }

  if (!quiet) {
    const warnSummary = warnings.length > 0 ? ` (${warnings.length} warning(s))` : '';
    console.log(`✅ VALID — ${fileName} (${fileSize} KB, schema: ${schemaType})${warnSummary}`);
  }
  process.exit(0);
}

main();
