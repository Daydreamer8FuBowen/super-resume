import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import assert from 'node:assert/strict';

const execFileAsync = promisify(execFile);
const repoRoot = resolve(import.meta.dirname, '..');
const profileStore = join(repoRoot, 'skills/profile-loader/profile-store.mjs');
const resolveProfile = join(repoRoot, 'skills/resume-visualizer/scripts/resolve-profile.mjs');
const renderResume = join(repoRoot, 'skills/resume-visualizer/scripts/render-resume.mjs');
const validateProfile = join(repoRoot, 'skills/profile-loader/validate-profile.mjs');

function baseProfile(overrides = {}) {
  return {
    schema_version: '1.0.0',
    profile_type: 'base',
    profile_id: 'base',
    last_updated: '2026-06-01',
    personal_info: {
      full_name: null,
      preferred_name: null,
      headline: null,
      location: null,
      phone: null,
      email: null,
      links: {
        github: null,
        linkedin: null,
        portfolio: null,
        website: null,
        other: [],
      },
    },
    career_objective: {
      target_roles: [],
      target_industries: [],
      summary_facts: [],
    },
    education: [],
    work_experience: [],
    internships: [],
    projects: [],
    skills: {
      programming_languages: [],
      frameworks: [],
      tools: [],
      platforms: [],
      databases: [],
      methodologies: [],
      domain_skills: [],
      soft_skills: [],
    },
    certifications: [],
    awards: [],
    languages: [],
    publications: [],
    portfolio: [],
    resume_preferences: {
      preferred_language: null,
      resume_length: null,
      tone: null,
      constraints: [],
      avoid: [],
    },
    raw_sources: [],
    metadata: {
      created_at: '2026-06-01',
      updated_at: '2026-06-01',
      notes: [],
    },
    ...overrides,
  };
}

async function tempWorkspace() {
  return mkdtemp(join(tmpdir(), 'superresume-profile-tools-'));
}

test('profile-store applies a small merge patch and preserves unrelated profile fields', async () => {
  const cwd = await tempWorkspace();
  const basePath = join(cwd, 'data/profiles/base.json');
  const patchPath = join(cwd, 'patch.json');
  await mkdir(dirname(basePath), { recursive: true });
  await writeFile(basePath, JSON.stringify(baseProfile({
    personal_info: {
      ...baseProfile().personal_info,
      full_name: 'Old Name',
      email: 'old@example.com',
    },
  }), null, 2));
  await writeFile(patchPath, JSON.stringify({
    personal_info: {
      full_name: 'Ada Lovelace',
    },
    skills: {
      programming_languages: ['JavaScript'],
    },
  }));

  const { stdout } = await execFileAsync('node', [
    profileStore,
    'merge',
    '--profile',
    'base',
    '--patch',
    patchPath,
  ], { cwd });

  const updated = JSON.parse(await readFile(basePath, 'utf8'));
  assert.equal(updated.personal_info.full_name, 'Ada Lovelace');
  assert.equal(updated.personal_info.email, 'old@example.com');
  assert.deepEqual(updated.skills.programming_languages, ['JavaScript']);
  assert.match(stdout, /VALID/);
  assert.match(stdout, /Wrote data[\\/]profiles[\\/]base\.json/);
});

test('resolve-profile chooses the newest target profile when no explicit input is provided', async () => {
  const cwd = await tempWorkspace();
  const targetDir = join(cwd, 'data/profiles/targets');
  await mkdir(targetDir, { recursive: true });
  await writeFile(join(cwd, 'data/profiles/base.json'), JSON.stringify(baseProfile(), null, 2));
  await writeFile(join(targetDir, 'older.json'), JSON.stringify({
    schema_version: '1.0.0',
    profile_type: 'targeted',
    profile_id: 'older',
    source_profile: 'data/profiles/base.json',
    personal_info: baseProfile().personal_info,
    skills: baseProfile().skills,
    target: { company: 'A', role: 'Engineer', keywords: [], priorities: [] },
    selected_profile: {},
    tailored_content: {},
    fact_traceability: [],
    metadata: { created_at: '2026-06-01', updated_at: '2026-06-01', notes: [] },
  }, null, 2));
  await new Promise(resolveTimer => setTimeout(resolveTimer, 20));
  const newestPath = join(targetDir, 'newest.json');
  await writeFile(newestPath, JSON.stringify({
    schema_version: '1.0.0',
    profile_type: 'targeted',
    profile_id: 'newest',
    source_profile: 'data/profiles/base.json',
    personal_info: baseProfile().personal_info,
    skills: baseProfile().skills,
    target: { company: 'B', role: 'Engineer', keywords: [], priorities: [] },
    selected_profile: {},
    tailored_content: {},
    fact_traceability: [],
    metadata: { created_at: '2026-06-02', updated_at: '2026-06-02', notes: [] },
  }, null, 2));

  const { stdout } = await execFileAsync('node', [
    resolveProfile,
    '--json',
  ], { cwd });

  const result = JSON.parse(stdout);
  assert.equal(result.schema, 'target');
  assert.equal(result.path, newestPath);
  assert.match(result.render_command.join(' '), /render-resume\.mjs/);
});

test('validate-profile accepts documented target schema without base-only top-level fields', async () => {
  const cwd = await tempWorkspace();
  const targetPath = join(cwd, 'data/profiles/targets/documented-target.json');
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, JSON.stringify({
    schema_version: '1.0.0',
    profile_type: 'targeted',
    profile_id: 'documented-target',
    source_profile: 'data/profiles/base.json',
    last_updated: '2026-06-02',
    target: {
      company: 'Acme',
      role: 'Frontend Engineer',
      industry: null,
      job_description_source: null,
      job_description_summary: null,
      keywords: [],
      priorities: [],
      adaptation_notes: [],
    },
    selected_profile: {
      personal_info: {},
      summary_positioning: [],
      education_ids: [],
      work_experience_ids: [],
      internship_ids: [],
      project_ids: [],
      skill_groups: {},
      certification_ids: [],
      award_ids: [],
    },
    tailored_content: {
      headline: null,
      summary: null,
      experience_bullets: [],
      project_bullets: [],
      skills_section: [],
      notes_for_resume_writer: [],
    },
    fact_traceability: [],
    metadata: {
      created_at: '2026-06-02',
      updated_at: '2026-06-02',
      notes: [],
    },
  }, null, 2));

  await execFileAsync('node', [
    validateProfile,
    targetPath,
    '--schema',
    'target',
  ], { cwd });
});

test('validate-profile enforces optional evidence contract enums on target traceability', async () => {
  const cwd = await tempWorkspace();
  const targetPath = join(cwd, 'data/profiles/targets/evidence-target.json');
  await mkdir(dirname(targetPath), { recursive: true });
  const target = {
    schema_version: '1.0.0',
    profile_type: 'targeted',
    profile_id: 'evidence-target',
    source_profile: 'data/profiles/base.json',
    target: { company: 'Acme', role: 'Engineer', keywords: [], priorities: [] },
    selected_profile: {},
    tailored_content: {},
    fact_traceability: [
      {
        tailored_claim: 'Improved ranking quality by 30%',
        source_profile_path: 'data/profiles/base.json',
        source_section: 'projects',
        source_id: 'project-001',
        confidence: 'low',
        claim_level: 'C3',
        truth_status: 'needs_evidence',
        safe_wording: 'Analyzed ranking quality issues and proposed evaluation metrics.',
        interview_risk: 'high',
      },
    ],
    metadata: { created_at: '2026-06-02', updated_at: '2026-06-02', notes: [] },
  };
  await writeFile(targetPath, JSON.stringify(target, null, 2));

  await execFileAsync('node', [
    validateProfile,
    targetPath,
    '--schema',
    'target',
  ], { cwd });

  target.fact_traceability[0].claim_level = 'C9';
  await writeFile(targetPath, JSON.stringify(target, null, 2));
  await assert.rejects(
    execFileAsync('node', [validateProfile, targetPath, '--schema', 'target'], { cwd }),
    /claim_level/,
  );
});

test('render-resume renders targeted profile tailored content instead of a blank base view', async () => {
  const cwd = await tempWorkspace();
  const targetPath = join(cwd, 'data/profiles/targets/acme-frontend.json');
  const outputPath = join(cwd, 'preview.html');
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, JSON.stringify({
    schema_version: '1.0.0',
    profile_type: 'targeted',
    profile_id: 'acme-frontend',
    source_profile: 'data/profiles/base.json',
    target: {
      company: 'Acme',
      role: 'Frontend Engineer',
      keywords: ['React'],
      priorities: ['UI performance'],
    },
    selected_profile: {
      personal_info: {
        full_name: 'Ada Lovelace',
        headline: 'Frontend Engineer',
        email: 'ada@example.com',
        phone: null,
        location: null,
        links: {},
      },
      education_ids: [],
      work_experience_ids: [],
      internship_ids: [],
      project_ids: [],
      skill_groups: {},
      certification_ids: [],
      award_ids: [],
    },
    tailored_content: {
      headline: 'Frontend Engineer | React',
      summary: 'Builds fast React interfaces for data-heavy products.',
      experience_bullets: [
        {
          title: 'Acme-ready experience',
          bullets: ['Improved dashboard rendering performance with React memoization.'],
        },
      ],
      project_bullets: [
        {
          title: 'Resume Visualizer',
          bullets: ['Rendered targeted resume JSON into stable HTML previews.'],
          technologies: ['Node.js', 'HTML'],
        },
      ],
      skills_section: ['React', 'Node.js'],
      notes_for_resume_writer: [],
    },
    fact_traceability: [],
    metadata: { created_at: '2026-06-02', updated_at: '2026-06-02', notes: [] },
  }, null, 2));

  await execFileAsync('node', [
    renderResume,
    targetPath,
    outputPath,
    '--no-serve',
  ], { cwd });

  const html = await readFile(outputPath, 'utf8');
  assert.match(html, /Ada Lovelace/);
  assert.match(html, /Builds fast React interfaces/);
  assert.match(html, /Improved dashboard rendering performance/);
  assert.match(html, /Resume Visualizer/);
});
