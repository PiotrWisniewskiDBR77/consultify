#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const git = (args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const head = git(['rev-parse', 'HEAD']);
const tracked = git(['ls-files']).split('\n').filter(Boolean);

const shared = [
  /^package(?:-lock)?\.json$/,
  /^server\/package(?:-lock)?\.json$/,
  /^src\/routes\/(?:AppRoutes\.tsx|routeConfig\.ts)$/,
  /^server\/src\/(?:Gateway|index)\.ts$/,
  /^server\/scripts\/migrate\.postgres\.ts$/,
  /^scripts\/cleanup\//,
  /^docs\/cleanup\//,
  /(?:^|\/)\.env/,
];

const activeRoot = /^(?:src|server\/(?:src|migrations|scripts)|tests|scripts)\//;
const laneMatchers = {
  a: [
    /(?:^|\/)(?:assessment|Assessment|DiscoveryTools)(?:\/|\.|-)/,
    /(?:auditPrograms?|audit-programs?|audit_programs?|auditsFive|CriterionWorkspace)/i,
    /discoverytools/i,
    /method-core/i,
    /tool(?:controller|output|initiative|session|registry|catalog|definition|pack)/i,
    /interview/i,
  ],
  bStrong: [/transformation.?case/i, /caseworkspace/i],
  b: [/mywork/i, /my-work/i, /initiative/i, /execution/i, /pmo/i],
  c: [
    /idea/i,
    /artifact/i,
    /document/i,
    /presentations?/i,
    /pptx/i,
    /workbook/i,
    /spreadsheet/i,
    /xlsx/i,
    /aichat/i,
    /chat/i,
    /organization/i,
    /meeting/i,
  ],
  d: [
    /(?:^|\/)(?:Results|resultsVnext|results-vnext)(?:\/|\.|-)/,
    /(?:^|\/)(?:Finance|Economics|finance)(?:\/|\.|-)/,
    /(?:^|\/)(?:Admin|SuperAdmin|Settings|Partner|Security|Auth)(?:\/|\.|-)/,
    /(?:resultsVNext|financeV[234810]|financial-model|skills-gap|saml|sso|security|privacy|partner)/i,
  ],
};

const lanes = {
  a: {
    branch: 'codex/closure-claude-a-method-evidence',
  },
  b: {
    branch: 'codex/closure-claude-b-transformation',
  },
  c: {
    branch: 'codex/closure-claude-c-ideas-documents',
  },
  d: {
    branch: 'codex/recovery-canonical-20260816',
  },
};

const matches = (file, expressions) => expressions.some((expression) => expression.test(file));
const isShared = (file) => matches(file, shared);
const ownerFor = (file) => {
  if (!activeRoot.test(file) || isShared(file)) return null;
  if (matches(file, laneMatchers.d)) return 'd';
  if (matches(file, laneMatchers.a)) return 'a';
  if (matches(file, laneMatchers.bStrong)) return 'b';
  if (matches(file, laneMatchers.c)) return 'c';
  if (matches(file, laneMatchers.b)) return 'b';
  return null;
};

for (const [lane, config] of Object.entries(lanes)) {
  const files = tracked
    .filter((file) => ownerFor(file) === lane)
    .sort();
  const tests = files.filter((file) => /^(tests|server\/.*(?:__tests__|\.test\.)|src\/.*(?:__tests__|\.test\.))/.test(file));
  const vitest = tests.filter((file) => !/^tests\/(?:e2e|visual)\//.test(file));
  const playwright = tests.filter((file) => /^tests\/(?:e2e|visual)\//.test(file));
  const source = files.filter((file) => !tests.includes(file));
  const sha256 = createHash('sha256').update(`${files.join('\n')}\n`).digest('hex');
  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    authorityHead: head,
    lane: lane === 'd' ? 'codex' : lane,
    branch: config.branch,
    rule: 'Only listed tracked paths may be changed. Shared files require an integrator request. New files must live under an already-listed domain directory or the reserved migration/evidence namespace.',
    sha256,
    counts: { all: files.length, source: source.length, tests: tests.length, vitest: vitest.length, playwright: playwright.length },
    files,
    source,
    tests: { vitest, playwright },
  };
  const dir = path.join(root, 'docs/cleanup/agents/generated');
  mkdirSync(dir, { recursive: true });
  const stem = lane === 'd' ? 'CODEX_INTEGRATOR_PATH_LEASE' : `CLAUDE_LANE_${lane.toUpperCase()}_PATH_LEASE`;
  writeFileSync(path.join(dir, `${stem}.json`), `${JSON.stringify(payload, null, 2)}\n`);
  const md = [
    `# ${lane === 'd' ? 'Codex integrator' : `Claude lane ${lane.toUpperCase()}`} — resolved path lease`,
    '',
    `Authority HEAD: \`${head}\``,
    '',
    `Branch: \`${config.branch}\``,
    '',
    `Lease SHA-256: \`${sha256}\``,
    '',
    `Counts: ${files.length} tracked paths; ${source.length} source/docs; ${vitest.length} Vitest; ${playwright.length} Playwright/visual.`,
    '',
    'Only the paths below may be modified. Shared files require an integrator',
    'request. New files must live below an already-listed domain directory or',
    'the lane reserved migration/evidence namespace.',
    '',
    '## Resolved paths',
    '',
    ...files.map((file) => `- \`${file}\``),
    '',
  ].join('\n');
  writeFileSync(path.join(dir, `${stem}.md`), md);
  console.log(`${lane}: ${files.length} paths, ${vitest.length} vitest, ${playwright.length} playwright, ${sha256}`);
}
