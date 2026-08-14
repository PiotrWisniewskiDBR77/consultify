#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const outputDir = path.join(root, 'docs/cleanup/generated');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
const head = git('rev-parse', 'HEAD');
const refs = git('for-each-ref', '--format=%(refname)', 'refs/remotes/origin')
  .split('\n').filter((ref) => ref && ref !== 'refs/remotes/origin/HEAD');

function category(ref, subject) {
  const value = `${ref} ${subject}`.toLowerCase();
  if (value.includes('/backup/') || value.includes('stash')) return 'HISTORICAL_BACKUP';
  if (/dependabot|renovate|dependency|deps:/.test(value)) return 'DEPENDENCY_UPDATE';
  if (/docs|handoff|checkpoint|recovery|review/.test(value)) return 'DOCUMENTATION_OR_RECOVERY';
  if (/wip|partial|checkpoint/.test(value)) return 'WIP_REVIEW';
  if (/test|e2e|proof|harness/.test(value)) return 'TEST_OR_EVIDENCE';
  return 'FEATURE_OR_HISTORICAL_REVIEW';
}

function patchState(sha) {
  const parentResult = spawnSync('git', ['rev-parse', `${sha}^`], { cwd: root, encoding: 'utf8' });
  if (parentResult.status !== 0) return 'ROOT_COMMIT_REVIEW';
  const parent = parentResult.stdout.trim();
  const numstat = git('diff', '--numstat', parent, sha).split('\n').filter(Boolean);
  let changedLines = 0;
  let hasBinary = false;
  for (const line of numstat) {
    const [added, deleted] = line.split('\t');
    if (added === '-' || deleted === '-') hasBinary = true;
    else changedLines += Number(added || 0) + Number(deleted || 0);
  }
  if (hasBinary || numstat.length > 500 || changedLines > 100_000) return 'LARGE_PATCH_REVIEW';
  const diff = execFileSync('git', ['diff', '--binary', parent, sha], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
  if (diff.length === 0) return 'EMPTY';
  if (diff.length > 16 * 1024 * 1024) return 'LARGE_PATCH_REVIEW';
  const reverse = spawnSync('git', ['apply', '--reverse', '--check', '--whitespace=nowarn', '-'], {
    cwd: root, input: diff, encoding: null,
  });
  if (reverse.status === 0) return 'PATCH_PRESENT';
  const forward = spawnSync('git', ['apply', '--check', '--whitespace=nowarn', '-'], {
    cwd: root, input: diff, encoding: null,
  });
  if (forward.status === 0) return 'PATCH_APPLICABLE';
  return 'DIVERGED_REVIEW';
}

const records = [];
for (const ref of refs) {
  const tip = git('rev-parse', ref);
  const integrated = spawnSync('git', ['merge-base', '--is-ancestor', tip, head], { cwd: root }).status === 0;
  const subject = git('show', '-s', '--format=%s', tip);
  const date = git('show', '-s', '--format=%cI', tip);
  const mergeBase = integrated ? tip : git('merge-base', head, tip);
  const commits = integrated ? [] : git('rev-list', '--reverse', `${head}..${ref}`).split('\n').filter(Boolean);
  const commitAudit = commits.length <= 25
    ? commits.map((sha) => ({ sha, subject: git('show', '-s', '--format=%s', sha), patchState: patchState(sha) }))
    : [];
  records.push({
    ref,
    tip,
    date,
    subject,
    integrated,
    mergeBase,
    aheadCommits: commits.length,
    category: integrated ? 'INTEGRATED' : category(ref, subject),
    patchAuditScope: commits.length <= 25 ? 'ALL_AHEAD_COMMITS' : 'SKIPPED_OVER_25_REQUIRES_MODULE_DIFF',
    commitAudit,
  });
}

records.sort((a, b) => a.ref.localeCompare(b.ref));
const notIntegrated = records.filter((record) => !record.integrated);
const counts = {
  totalRemoteRefs: records.length,
  integratedRemoteRefs: records.length - notIntegrated.length,
  notIntegratedRemoteRefs: notIntegrated.length,
  notIntegratedCommitsUnion: notIntegrated.length
    ? Number(git('rev-list', '--count', ...notIntegrated.map((record) => record.tip), '--not', head))
    : 0,
};
const patchStates = {};
for (const record of notIntegrated) for (const commit of record.commitAudit) {
  patchStates[commit.patchState] = (patchStates[commit.patchState] ?? 0) + 1;
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  canonicalHead: head,
  warnings: [
    'PATCH_PRESENT proves textual patch equivalence only; it does not prove semantic equivalence.',
    'DIVERGED_REVIEW may already be represented by later rewritten code and requires module-level comparison.',
    'Branches with more than 25 ahead commits are not patch-applied commit-by-commit to avoid false confidence and excessive destructive-looking operations.',
  ],
  counts,
  auditedPatchStates: patchStates,
  records,
};
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'git-ref-inventory.json'), JSON.stringify(report, null, 2) + '\n');
const categoryCounts = notIntegrated.reduce((acc, record) => {
  acc[record.category] = (acc[record.category] ?? 0) + 1;
  return acc;
}, {});
const markdown = [
  '# Git ref inventory', '',
  `Canonical head: \`${head}\`. Generated at ${report.generatedAt}.`, '',
  `- Remote refs: ${counts.totalRemoteRefs}`,
  `- Fully integrated tips: ${counts.integratedRemoteRefs}`,
  `- Tips not ancestral to canon: ${counts.notIntegratedRemoteRefs}`,
  '', '## Non-integrated categories', '',
  ...Object.entries(categoryCounts).sort().map(([name, count]) => `- ${name}: ${count}`),
  '', '## Commit patch states for bounded branches', '',
  ...Object.entries(patchStates).sort().map(([name, count]) => `- ${name}: ${count}`),
  '', 'Exact refs, SHAs, subjects, merge bases and bounded commit audits are stored in `git-ref-inventory.json`.', '',
  ...report.warnings.map((warning) => `- ${warning}`), '',
];
fs.writeFileSync(path.join(outputDir, 'git-ref-inventory.md'), markdown.join('\n'));
console.log(JSON.stringify({ counts, categoryCounts, patchStates }, null, 2));
