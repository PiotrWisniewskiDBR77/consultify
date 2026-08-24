import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const reporter = resolve(root, 'scripts/recovery/report-worktree-inventory.mjs');

test('reports every registered worktree without exposing diff content', () => {
  const expected = spawnSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(expected.status, 0, expected.stderr);
  const expectedCount = expected.stdout.split(/^worktree /m).length - 1;

  const run = spawnSync(process.execPath, [reporter, root], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);

  const report = JSON.parse(run.stdout);
  assert.equal(report.totals.worktrees, expectedCount);
  assert.equal(report.worktrees.length, expectedCount);
  assert.ok(report.worktrees.every((entry) => /^[a-f0-9]{64}$/.test(entry.trackedDiffSha256)));
  assert.ok(report.worktrees.every((entry) => !Object.hasOwn(entry, 'diff')));
  assert.ok(report.worktrees.some((entry) => entry.path === root));
  assert.ok(report.worktrees.some((entry) => entry.bare));
  assert.ok(report.totals.unavailable >= 0);
});
