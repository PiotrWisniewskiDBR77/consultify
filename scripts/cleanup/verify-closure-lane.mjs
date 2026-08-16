#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const lane = process.argv[2]?.toLowerCase();
const baseline = process.argv[3];
if (!['a', 'b', 'c'].includes(lane) || !baseline) {
  console.error('usage: node scripts/cleanup/verify-closure-lane.mjs <a|b|c> <baseline-sha>');
  process.exit(2);
}

const git = (args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const manifestPath = path.join(
  root,
  'docs/cleanup/agents/generated',
  `CLAUDE_LANE_${lane.toUpperCase()}_PATH_LEASE.json`
);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const leased = new Set(manifest.files);
const changed = new Set();
for (const command of [
  ['diff', '--name-only', `${baseline}...HEAD`],
  ['diff', '--name-only'],
  ['diff', '--name-only', '--cached'],
  ['ls-files', '--others', '--exclude-standard'],
]) {
  const output = git(command);
  if (output) for (const file of output.split('\n')) changed.add(file);
}

const reservedMigration = new RegExp(`^server/migrations/2026091${lane === 'a' ? '0' : lane === 'b' ? '1' : '2'}_claude_${lane}_[^/]+\\.sql$`);
const reservedEvidence = new RegExp(`^docs/program/evidence/closure/${lane}/[^/]+/`);
const allowedNewRoots = {
  a: [
    /^src\/(?:components\/(?:assessment|Assessment|DiscoveryTools|Audit|Interview)|method-core|toolPacks|toolOutputs)\//,
    /^server\/src\/(?:controllers|routes|services)\/(?:assessment|auditPrograms?|interview|tool)[^/]*\//i,
    /^(?:tests|server\/tests)\/(?:assessment|auditPrograms?|interview|tool)[^/]*/i,
  ],
  b: [
    /^src\/components\/(?:MyWork|Initiatives|Execution|CaseWorkspace)\//,
    /^server\/src\/(?:controllers|routes|services)\/(?:caseWorkspace|myWork|initiative|execution|inbox|task|decision)[^/]*\//i,
    /^(?:tests|server\/tests)\/(?:caseWorkspace|myWork|initiative|execution|inbox|task|decision)[^/]*/i,
  ],
  c: [
    /^src\/components\/(?:AIChat|Chat|DocumentStudio|Presentations|PresentationStudio|Organization|Meeting)\//,
    /^server\/src\/(?:controllers|routes|services)\/(?:artifact|document|presentation|workbook|chat|organization|meeting|idea)[^/]*\//i,
    /^(?:tests|server\/tests)\/(?:artifact|document|presentation|workbook|chat|organization|meeting|idea)[^/]*/i,
  ],
};
const isTracked = (file) => {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', file], { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const violations = [...changed].filter((file) => {
  if (leased.has(file) || reservedMigration.test(file) || reservedEvidence.test(file)) return false;
  const isNew = !isTracked(file);
  return !(isNew && allowedNewRoots[lane].some((rootPattern) => rootPattern.test(file)));
});

if (violations.length > 0) {
  console.error(`lane ${lane.toUpperCase()} lease violation (${violations.length}):`);
  for (const file of violations) console.error(`- ${file}`);
  process.exit(1);
}
console.log(
  `lane ${lane.toUpperCase()} lease PASS: ${changed.size} changed paths; manifest ${manifest.sha256}`
);
