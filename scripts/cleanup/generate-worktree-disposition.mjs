#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const candidate = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const frozenPath =
  '/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify';

const git = (args, cwd = root) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

const records = git(['worktree', 'list', '--porcelain'])
  .split(/\n\n+/)
  .filter(Boolean)
  .map((block) => {
    const lines = block.split('\n');
    const get = (prefix) => lines.find((line) => line.startsWith(prefix))?.slice(prefix.length) ?? null;
    return {
      path: get('worktree '),
      head: get('HEAD '),
      branch: get('branch ')?.replace(/^refs\/heads\//, '') ?? null,
      detached: lines.includes('detached'),
      prunable: get('prunable '),
    };
  });

const tipMultiplicity = new Map();
for (const record of records) {
  tipMultiplicity.set(record.head, (tipMultiplicity.get(record.head) ?? 0) + 1);
}

const isReproducibleIgnoredPath = (entry) => {
  const ignoredPath = entry.slice(3).replace(/\/$/, '');
  return (
    /(^|\/)node_modules$/.test(ignoredPath) ||
    /(^|\/)dist$/.test(ignoredPath) ||
    ignoredPath === 'dev-render/.vite-cache' ||
    ignoredPath === 'junit.xml' ||
    ignoredPath === 'e2e-results.xml' ||
    ignoredPath === 'test-results'
  );
};

for (const record of records) {
  let status = '';
  let statusError = null;
  try {
    status = git(['status', '--porcelain=v1', '--untracked-files=normal'], record.path);
  } catch (error) {
    statusError = String(error?.message ?? error);
  }
  const entries = status ? status.split('\n').filter(Boolean) : [];
  record.statusEntries = entries.length;
  record.trackedEntries = entries.filter((line) => !line.startsWith('??')).length;
  record.untrackedEntries = entries.filter((line) => line.startsWith('??')).length;
  record.conflictEntries = entries.filter((line) => /^(DD|AU|UD|UA|DU|AA|UU)/.test(line)).length;
  record.statusError = statusError;
  record.tipMultiplicity = tipMultiplicity.get(record.head) ?? 1;
  let ignoredEntries = [];
  if (!statusError && entries.length === 0) {
    try {
      const ignoredStatus = git(
        ['status', '--porcelain=v1', '--ignored=matching', '--untracked-files=normal'],
        record.path
      );
      ignoredEntries = ignoredStatus
        ? ignoredStatus.split('\n').filter((line) => line.startsWith('!!'))
        : [];
    } catch (error) {
      record.statusError = String(error?.message ?? error);
    }
  }
  record.ignoredEntries = ignoredEntries;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', record.head, candidate], {
      cwd: root,
      stdio: 'ignore',
    });
    record.representedByCandidate = true;
  } catch {
    record.representedByCandidate = false;
  }

  if (record.path === root) record.decision = 'KEEP_CANONICAL';
  else if (record.path === frozenPath) record.decision = 'QUARANTINE_FROZEN_SOURCE';
  else if (record.prunable) record.decision = 'PRUNE_REGISTRATION_ONLY';
  else if (statusError) record.decision = 'QUARANTINE_STATUS_ERROR';
  else if (entries.length > 0) record.decision = 'QUARANTINE_DIRTY';
  else if (
    ignoredEntries.length > 0 &&
    (!record.representedByCandidate || ignoredEntries.some((entry) => !isReproducibleIgnoredPath(entry)))
  )
    record.decision = 'QUARANTINE_IGNORED_EVIDENCE_REVIEW';
  else if (ignoredEntries.length > 0)
    record.decision = 'PRUNE_READY_REPRESENTED_REPRODUCIBLE_IGNORED_ONLY';
  else if (record.representedByCandidate) record.decision = 'PRUNE_READY_CLEAN_REPRESENTED';
  else if (record.tipMultiplicity > 1) record.decision = 'KEEP_UNMERGED_DUPLICATE_TIP_REVIEW';
  else record.decision = 'KEEP_UNMERGED_UNIQUE_TIP_REVIEW';
}

const counts = Object.fromEntries(
  [...new Set(records.map((record) => record.decision))]
    .sort()
    .map((decision) => [decision, records.filter((record) => record.decision === decision).length])
);
const payload = {
  schemaVersion: 1,
  observedAt: new Date().toISOString(),
  candidate,
  total: records.length,
  counts,
  records,
};

const outDir = path.join(root, 'docs/cleanup/evidence');
mkdirSync(outDir, { recursive: true });
writeFileSync(
  path.join(outDir, 'WORKTREE_DISPOSITION_20260816.json'),
  `${JSON.stringify(payload, null, 2)}\n`
);

const escapeCell = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const markdown = [
  '# Worktree disposition — 2026-08-16',
  '',
  `Candidate: \`${candidate}\``,
  '',
  'This is a generated recovery manifest. `PRUNE_READY` means the checked-out',
  'commit is represented by the candidate and tracked/untracked status is clean;',
  'it does not authorize deleting the preserved branch ref.',
  '',
  '## Counts',
  '',
  '| Decision | Count |',
  '| --- | ---: |',
  ...Object.entries(counts).map(([decision, count]) => `| \`${decision}\` | ${count} |`),
  '',
  '## Records',
  '',
  '| Path | Branch | HEAD | Status | Ignored | Candidate | Tip copies | Decision |',
  '| --- | --- | --- | ---: | ---: | --- | ---: | --- |',
  ...records.map(
    (record) =>
      `| ${escapeCell(record.path)} | ${escapeCell(record.branch ?? '(detached)')} | \`${record.head}\` | ${record.statusEntries} | ${record.ignoredEntries.length} | ${record.representedByCandidate ? 'yes' : 'no'} | ${record.tipMultiplicity} | \`${record.decision}\` |`
  ),
  '',
].join('\n');
writeFileSync(path.join(outDir, 'WORKTREE_DISPOSITION_20260816.md'), markdown);

console.log(JSON.stringify({ candidate, total: records.length, counts }, null, 2));
