#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repository = resolve(process.argv[2] || process.cwd());

function git(args, cwd = repository, { allowFailure = false } = {}) {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(' ')} failed in ${cwd}: ${run.stderr.trim()}`);
  }
  return { status: run.status, stdout: run.stdout || '', stderr: run.stderr || '' };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseWorktrees(text) {
  return text
    .trim()
    .split(/\n\n+/)
    .filter(Boolean)
    .map((block) =>
      Object.fromEntries(
        block.split('\n').map((line) => {
          const splitAt = line.indexOf(' ');
          return splitAt === -1 ? [line, true] : [line.slice(0, splitAt), line.slice(splitAt + 1)];
        })
      )
    );
}

const rootHead = git(['rev-parse', 'HEAD']).stdout.trim();
const rootCommonDir = git(['rev-parse', '--git-common-dir']).stdout.trim();
const entries = parseWorktrees(git(['worktree', 'list', '--porcelain']).stdout);

const worktrees = entries.map((entry) => {
  const path = entry.worktree;
  const linkedMarker = existsSync(join(path, '.git'));
  const bareMarker = existsSync(join(path, 'HEAD')) && existsSync(join(path, 'objects'));
  const validLinkedWorktree =
    linkedMarker &&
    git(['rev-parse', '--is-inside-work-tree'], path, { allowFailure: true }).stdout.trim() === 'true';

  if ((!linkedMarker && !bareMarker) || (linkedMarker && !validLinkedWorktree)) {
    return {
      path,
      head: entry.HEAD || null,
      branch: null,
      bare: false,
      unavailable: true,
      detached: Boolean(entry.detached),
      locked: entry.locked || false,
      prunable: entry.prunable || false,
      dirty: null,
      statusEntries: 0,
      trackedChanges: 0,
      untrackedChanges: 0,
      aheadOfRoot: null,
      behindRoot: null,
      trackedDiffSha256: sha256('UNAVAILABLE'),
      stagedDiffSha256: sha256('UNAVAILABLE'),
      statusShapeSha256: sha256('UNAVAILABLE'),
    };
  }
  // A linked bare recovery vault may be listed without an explicit `bare`
  // marker by older/newer Git versions, so ask the repository itself.
  const bare = bareMarker;
  if (bare) {
    const head = git(['--git-dir', path, 'rev-parse', 'HEAD']).stdout.trim();
    return {
      path,
      head,
      branch: null,
      bare: true,
      unavailable: false,
      detached: false,
      locked: entry.locked || false,
      prunable: entry.prunable || false,
      dirty: false,
      statusEntries: 0,
      trackedChanges: 0,
      untrackedChanges: 0,
      aheadOfRoot: Number(
        git(['--git-dir', path, 'rev-list', '--count', `${rootHead}..${head}`], repository, {
          allowFailure: true,
        }).stdout.trim() || 0
      ),
      behindRoot: Number(
        git(['--git-dir', path, 'rev-list', '--count', `${head}..${rootHead}`], repository, {
          allowFailure: true,
        }).stdout.trim() || 0
      ),
      trackedDiffSha256: sha256(''),
      stagedDiffSha256: sha256(''),
      statusShapeSha256: sha256(''),
    };
  }
  const statusLines = git(['status', '--short', '--untracked-files=all'], path).stdout
    .split('\n')
    .filter(Boolean);
  const trackedDiff = git(['diff', '--binary', '--no-ext-diff'], path).stdout;
  const stagedDiff = git(['diff', '--binary', '--cached', '--no-ext-diff'], path).stdout;
  const branch = git(['symbolic-ref', '--short', '-q', 'HEAD'], path, { allowFailure: true }).stdout.trim() || null;
  const head = git(['rev-parse', 'HEAD'], path).stdout.trim();
  const aheadOfRoot = Number(
    git(['rev-list', '--count', `${rootHead}..${head}`], path, { allowFailure: true }).stdout.trim() || 0
  );
  const behindRoot = Number(
    git(['rev-list', '--count', `${head}..${rootHead}`], path, { allowFailure: true }).stdout.trim() || 0
  );

  return {
    path,
    head,
    branch,
    bare: false,
    unavailable: false,
    detached: Boolean(entry.detached),
    locked: entry.locked || false,
    prunable: entry.prunable || false,
    dirty: statusLines.length > 0,
    statusEntries: statusLines.length,
    trackedChanges: statusLines.filter((line) => !line.startsWith('??')).length,
    untrackedChanges: statusLines.filter((line) => line.startsWith('??')).length,
    aheadOfRoot,
    behindRoot,
    // Fingerprints prove whether tracked/staged WIP changes between inventories
    // without writing diff content or potentially sensitive values to reports.
    trackedDiffSha256: sha256(trackedDiff),
    stagedDiffSha256: sha256(stagedDiff),
    statusShapeSha256: sha256(statusLines.join('\n')),
  };
});

const result = {
  generatedFrom: repository,
  rootHead,
  rootCommonDir,
  totals: {
    worktrees: worktrees.length,
    dirty: worktrees.filter((entry) => entry.dirty).length,
    clean: worktrees.filter((entry) => entry.dirty === false && !entry.unavailable).length,
    unavailable: worktrees.filter((entry) => entry.unavailable).length,
    statusEntries: worktrees.reduce((sum, entry) => sum + entry.statusEntries, 0),
  },
  worktrees,
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
