#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'docs/cleanup/evidence/WORKTREE_DISPOSITION_20260816.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const expectedDecision = 'PRUNE_READY_REPRESENTED_REPRODUCIBLE_IGNORED_ONLY';
const candidates = manifest.records.filter((record) => record.decision === expectedDecision);

const git = (args, cwd = root) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

const isAllowedIgnoredPath = (entry) => {
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

for (const record of candidates) {
  if (!path.isAbsolute(record.path) || record.path === root || record.path === '/') {
    throw new Error(`Unsafe worktree target: ${record.path}`);
  }
  const liveHead = git(['rev-parse', 'HEAD'], record.path);
  if (liveHead !== record.head) throw new Error(`HEAD drift at ${record.path}`);
  const ordinary = git(['status', '--porcelain=v1', '--untracked-files=normal'], record.path);
  if (ordinary) throw new Error(`Worktree became dirty: ${record.path}`);
  const ignored = git(
    ['status', '--porcelain=v1', '--ignored=matching', '--untracked-files=normal'],
    record.path
  )
    .split('\n')
    .filter((line) => line.startsWith('!!'));
  if (ignored.some((entry) => !isAllowedIgnoredPath(entry))) {
    throw new Error(`Non-reproducible ignored content appeared: ${record.path}`);
  }
  execFileSync('git', ['merge-base', '--is-ancestor', liveHead, 'HEAD'], {
    cwd: root,
    stdio: 'ignore',
  });
}

for (const record of candidates) {
  execFileSync('git', ['worktree', 'remove', '--force', record.path], {
    cwd: root,
    stdio: 'inherit',
  });
  console.log(`retired checkout; branch preserved: ${record.path} @ ${record.head}`);
}

console.log(`Retired ${candidates.length} represented worktree checkouts; no branch refs deleted.`);
