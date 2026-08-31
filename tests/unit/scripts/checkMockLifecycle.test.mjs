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

test('report mode names the file and line but remains non-blocking', () => {
  const file = 'fixtures/report.test.ts';
  writeFileSync(join(worktreeDir, file), "beforeAll(() => { vi.fn().mockResolvedValue('x'); });\n");
  const result = run([file]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /fixtures\/report\.test\.ts:1:/);
});

test('--ci blocks new beforeAll debt and passes a beforeEach reinstall', () => {
  const bad = 'fixtures/bad.test.ts';
  writeFileSync(join(worktreeDir, bad), "beforeAll(() => { vi.fn().mockResolvedValue('x'); });\n");
  let result = run(['--ci', bad]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /fixtures\/bad\.test\.ts:1:/);

  const good = 'fixtures/good.test.ts';
  writeFileSync(join(worktreeDir, good), [
    "const mock = vi.fn();",
    "beforeAll(() => { mock.mockResolvedValue('x'); });",
    "beforeEach(() => { mock.mockResolvedValue('x'); });",
    '',
  ].join('\n'));
  result = run(['--ci', good]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
