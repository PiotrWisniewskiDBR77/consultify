import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test, { after, before } from 'node:test';

const repoRoot = resolve(import.meta.dirname, '../../..');
let worktreeDir;

function git(args, cwd = repoRoot) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function run(args, cwd = worktreeDir) {
  return spawnSync('bash', ['scripts/check-mock-lifecycle.sh', ...args], { cwd, encoding: 'utf8' });
}

before(() => {
  const dir = mkdtempSync(join(tmpdir(), 'check-mock-lifecycle-wt-'));
  rmSync(dir, { recursive: true, force: true });
  git(['worktree', 'add', '--detach', dir, 'HEAD']);
  worktreeDir = dir;
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  copyFileSync(join(repoRoot, 'scripts/check-mock-lifecycle.sh'), join(dir, 'scripts/check-mock-lifecycle.sh'));
  copyFileSync(join(repoRoot, 'scripts/check-mock-lifecycle.baseline.json'), join(dir, 'scripts/check-mock-lifecycle.baseline.json'));
  mkdirSync(join(dir, 'fixtures'), { recursive: true });
});

after(() => {
  if (!worktreeDir) return;
  try { git(['worktree', 'remove', '--force', worktreeDir]); } catch { /* best effort */ }
});

test('report mode names bare vi.fn() as a non-blocking warning', () => {
  const file = 'fixtures/report.test.ts';
  writeFileSync(join(worktreeDir, file), "beforeAll(() => { vi.fn().mockResolvedValue('x'); });\n");
  const result = run([file]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /fixtures\/report\.test\.ts:1: WARNING/);
  assert.match(result.stdout, /0 blocking violation\(s\), 1 warning\(s\)/);
});

// FIX-211: only vi.spyOn(...) reliably loses its implementation under the
// repo's clearAllMocks() beforeEach (confirmed empirically, see the FIX-211
// report). Bare vi.fn() survives regardless of beforeEach, so it must never
// block a commit - it stays a report-only warning (previous test).
test('--ci does NOT block a bare vi.fn() left unreinstalled in beforeAll', () => {
  const file = 'fixtures/bare-fn-unreinstalled.test.ts';
  writeFileSync(join(worktreeDir, file), "beforeAll(() => { vi.fn().mockResolvedValue('x'); });\n");
  const result = run(['--ci', file]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test('--ci blocks a vi.spyOn(...) left unreinstalled in beforeAll and passes a beforeEach reinstall of the same target', () => {
  const bad = 'fixtures/bad.test.ts';
  writeFileSync(
    join(worktreeDir, bad),
    "beforeAll(() => { vi.spyOn(svc, 'call').mockResolvedValue('x'); });\n"
  );
  let result = run(['--ci', bad]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /fixtures\/bad\.test\.ts:1:/);

  const good = 'fixtures/good.test.ts';
  writeFileSync(join(worktreeDir, good), [
    "beforeAll(() => { vi.spyOn(svc, 'call').mockResolvedValue('x'); });",
    "beforeEach(() => { vi.spyOn(svc, 'call').mockResolvedValue('x'); });",
    '',
  ].join('\n'));
  result = run(['--ci', good]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

// FIX-211 punkt 1: matching must be per-target, not "any setter anywhere in
// beforeEach clears the whole file" - reproduces the audit's own repro
// (two spies armed in beforeAll, beforeEach reinstalls only one).
test('--ci blocks per-target: reinstalling one spy in beforeEach does not excuse a sibling spy left stale', () => {
  const file = 'fixtures/two-spies-one-reinstalled.test.ts';
  writeFileSync(join(worktreeDir, file), [
    "beforeAll(() => {",
    "  vi.spyOn(targetA, 'call').mockReturnValue('A_MOCK');",
    "  vi.spyOn(targetB, 'call').mockReturnValue('B_MOCK');",
    '});',
    'beforeEach(() => {',
    "  vi.spyOn(targetA, 'call').mockReturnValue('A_MOCK');",
    '});',
    '',
  ].join('\n'));
  const result = run(['--ci', file]);
  assert.notEqual(result.status, 0);
  const out = `${result.stdout}\n${result.stderr}`;
  assert.match(out, /two-spies-one-reinstalled\.test\.ts:3:/); // targetB - unreinstalled
  assert.doesNotMatch(out, /two-spies-one-reinstalled\.test\.ts:2:/); // targetA - reinstalled, not flagged
});

// A spy variable reinstalled by identifier (not by repeating vi.spyOn) must
// still resolve to the same target and not be flagged.
test('--ci does not block a spy variable reinstalled by identifier in beforeEach', () => {
  const file = 'fixtures/spy-var-reinstalled.test.ts';
  writeFileSync(join(worktreeDir, file), [
    'let spy;',
    "beforeAll(() => { spy = vi.spyOn(svc, 'call').mockReturnValue(1); });",
    'beforeEach(() => { spy.mockReturnValue(2); });',
    '',
  ].join('\n'));
  const result = run(['--ci', file]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
