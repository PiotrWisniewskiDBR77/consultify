// checkActionsStagedScope.test.mjs
//
// Regression guard for TRI-OBS-17 (2026-08-25): scripts/check-actions.sh R10
// used to call scripts/check-action-coverage.sh WITHOUT arguments in
// pre-commit mode. That companion script re-derives the staged diff itself
// and filters out __tests__ files — so a commit touching ONLY a file under
// src/components/MyWork/**/__tests__/*.tsx produced an EMPTY list after the
// filter, which tripped the companion script's built-in "empty staging ->
// full repo scan" fallback. The full scan then surfaced pre-existing,
// unrelated debt (ClosureDecisionQueue.tsx, EffectivenessClosureQueue.tsx,
// NotebookExportMenu.tsx, NotebookHamburgerMenu.tsx, NotebookInlineAIMenu.tsx)
// and blocked commits that never touched those files.
//
// Fix: check-actions.sh now resolves the staged MyWork *.tsx files itself
// and passes them EXPLICITLY as positional arguments to
// check-action-coverage.sh. That invocation mode ("pliki z argumentów")
// never falls back to a full scan — an empty list after the __tests__
// filter just means "0 files checked", not "scan everything". `--full`
// keeps the old full-scan behavior for CI / manual audits, so the debt
// stays visible there.
//
// This test exercises the REAL registry files and the REAL, currently
// checked-in debt (not a synthetic fixture) via an isolated git worktree,
// so it fails loudly if the debt set changes shape or the fallback
// regresses.

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test, { after, afterEach, before, beforeEach } from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../../..');

const KNOWN_DEBT_FILES = [
  'ClosureDecisionQueue.tsx',
  'EffectivenessClosureQueue.tsx',
  'NotebookExportMenu.tsx',
  'NotebookHamburgerMenu.tsx',
  'NotebookInlineAIMenu.tsx',
];

let worktreeDir;

function git(args, cwd = repoRoot) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function runCheckActions(args, cwd = worktreeDir) {
  return spawnSync('bash', ['scripts/check-actions.sh', ...args], {
    cwd,
    encoding: 'utf8',
  });
}

before(() => {
  // Isolated linked worktree at HEAD so staging a fixture file never touches
  // the real, currently-staged SlashMenu fix in the primary worktree.
  const base = mkdtempSync(join(tmpdir(), 'check-actions-wt-'));
  rmSync(base, { recursive: true, force: true });
  git(['worktree', 'add', '--detach', base, 'HEAD']);
  worktreeDir = base;
});

after(() => {
  if (!worktreeDir) return;
  try {
    git(['worktree', 'remove', '--force', worktreeDir]);
  } catch {
    // best-effort cleanup
  }
});

// Files touched by the current test, so afterEach can restore precisely
// those instead of paying for a `git reset --hard` across ~26k tracked
// files on every test (repo-wide reset measured ~10s/test — targeted
// restore of 1-2 files is near-instant).
let touchedPaths = [];

function stageFixtureEdit(relPath) {
  const abs = join(worktreeDir, relPath);
  const original = readFileSync(abs, 'utf8');
  writeFileSync(abs, `${original}\n// checkActionsStagedScope fixture touch\n`);
  git(['add', relPath], worktreeDir);
  touchedPaths.push(relPath);
}

beforeEach(() => {
  touchedPaths = [];
  // Mirror the working-tree copy of the script under test into the fixture
  // worktree. `git worktree add HEAD` only sees committed content, so this
  // is what lets the test exercise an in-progress (not yet committed) edit
  // to check-actions.sh, and is a harmless no-op once the fix is committed.
  copyFileSync(
    join(repoRoot, 'scripts/check-actions.sh'),
    join(worktreeDir, 'scripts/check-actions.sh')
  );
});

afterEach(() => {
  for (const relPath of touchedPaths) {
    // Restores both the index and the working tree for this one path back
    // to HEAD — cheap, unlike a full `reset --hard`.
    git(['checkout', 'HEAD', '--', relPath], worktreeDir);
  }
  touchedPaths = [];
});

test('staged-only (pre-commit) mode does not block a commit that only touches a MyWork __tests__ file', () => {
  stageFixtureEdit(
    'src/components/MyWork/notebook/__tests__/SlashMenu.blockConfiguration.test.tsx'
  );

  const result = runCheckActions([]);

  assert.equal(result.status, 0, `expected exit 0, got:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /rejestr OK/);
});

test('--full still surfaces the pre-existing MyWork action-registry debt', () => {
  const result = runCheckActions(['--full']);

  assert.notEqual(result.status, 0, 'expected --full to fail on known pre-existing debt');
  const out = `${result.stdout}\n${result.stderr}`;
  for (const debtFile of KNOWN_DEBT_FILES) {
    assert.match(
      out,
      new RegExp(debtFile.replace('.', '\\.')),
      `expected --full output to mention ${debtFile}`
    );
  }
});

test('staged-only mode still blocks when a debt file itself is staged with a real change', () => {
  stageFixtureEdit('src/components/MyWork/ClosureDecisionQueue.tsx');

  const result = runCheckActions([]);

  assert.notEqual(result.status, 0, 'expected staged-only mode to still flag a directly staged debt file');
  assert.match(`${result.stdout}${result.stderr}`, /ClosureDecisionQueue\.tsx/);
});
