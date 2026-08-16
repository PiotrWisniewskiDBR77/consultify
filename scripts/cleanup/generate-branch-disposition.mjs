#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const candidate = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const git = (args) =>
  execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).trim();

const rows = git(['for-each-ref', '--format=%(refname:short)%09%(objectname)', 'refs/heads'])
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [branch, head] = line.split('\t');
    return { branch, head };
  });

const multiplicity = new Map();
for (const row of rows) multiplicity.set(row.head, (multiplicity.get(row.head) ?? 0) + 1);

for (const row of rows) {
  row.tipMultiplicity = multiplicity.get(row.head) ?? 1;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', row.head, candidate], {
      cwd: root,
      stdio: 'ignore',
    });
    row.representedByCandidate = true;
  } catch {
    row.representedByCandidate = false;
  }

  if (row.representedByCandidate) row.decision = 'REPRESENTED_ANCESTOR_KEEP_REF';
  else if (row.tipMultiplicity > 1) row.decision = 'QUARANTINE_DUPLICATE_TIP_KEEP_REF';
  else row.decision = 'QUARANTINE_UNIQUE_TIP_BACKLOG_KEEP_REF';
}

const counts = Object.fromEntries(
  [...new Set(rows.map((row) => row.decision))]
    .sort()
    .map((decision) => [decision, rows.filter((row) => row.decision === decision).length])
);
const uniqueTips = new Set(rows.map((row) => row.head)).size;
const unrepresentedUniqueTips = new Set(
  rows.filter((row) => !row.representedByCandidate).map((row) => row.head)
).size;
const payload = {
  schemaVersion: 1,
  observedAt: new Date().toISOString(),
  candidate,
  totalRefs: rows.length,
  uniqueTips,
  unrepresentedUniqueTips,
  counts,
  semantics: {
    quarantine:
      'Preserved and excluded from canonical execution; not reviewed, disposable, prune-ready, or authorized for deletion.',
    represented:
      'Commit is an ancestor of the candidate; branch ref remains preserved until a separately authorized retirement.',
  },
  records: rows,
};

const outDir = path.join(root, 'docs/cleanup/evidence');
mkdirSync(outDir, { recursive: true });
writeFileSync(
  path.join(outDir, 'BRANCH_DISPOSITION_20260816.json'),
  `${JSON.stringify(payload, null, 2)}\n`
);

const md = [
  '# Local branch disposition — 2026-08-16',
  '',
  `Candidate observed: \`${candidate}\``,
  '',
  'This generated manifest accounts for every local branch ref. Quarantine is a',
  'recoverable control state: it is not semantic review, prune readiness, or',
  'authorization to delete a branch or commit.',
  '',
  `- Local refs: ${rows.length}`,
  `- Unique tip SHAs: ${uniqueTips}`,
  `- Unrepresented unique tip SHAs retained in quarantine: ${unrepresentedUniqueTips}`,
  '',
  '| Decision | Refs |',
  '| --- | ---: |',
  ...Object.entries(counts).map(([decision, count]) => `| \`${decision}\` | ${count} |`),
  '',
  '| Branch | HEAD | Tip copies | Candidate ancestor | Decision |',
  '| --- | --- | ---: | --- | --- |',
  ...rows.map(
    (row) =>
      `| ${row.branch.replaceAll('|', '\\|')} | \`${row.head}\` | ${row.tipMultiplicity} | ${row.representedByCandidate ? 'yes' : 'no'} | \`${row.decision}\` |`
  ),
  '',
].join('\n');
writeFileSync(path.join(outDir, 'BRANCH_DISPOSITION_20260816.md'), md);

console.log(
  JSON.stringify(
    { candidate, totalRefs: rows.length, uniqueTips, unrepresentedUniqueTips, counts },
    null,
    2
  )
);
