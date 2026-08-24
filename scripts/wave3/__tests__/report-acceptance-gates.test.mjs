import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const reporter = resolve(root, 'scripts/wave3/report-acceptance-gates.mjs');

test('classifies all 336 Wave 3 gates without flattening qualified or owner-gated states', () => {
  const run = spawnSync(process.execPath, [reporter], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ACCEPTANCE_PRODUCT_SHA: 'test-sha' },
  });

  assert.equal(run.status, 0, run.stderr);
  const report = JSON.parse(run.stdout);
  assert.equal(report.exactHead, 'test-sha');
  assert.equal(report.totals.modules, 16);
  assert.equal(report.totals.gates, 336);
  assert.equal(report.totals.missing, 0);
  const classifiedTotal =
    report.totals.closed +
    report.totals.qualified_pass +
    report.totals.owner_gated +
    report.totals.policy_gated +
    report.totals.open;
  assert.equal(classifiedTotal, 336);
  assert.equal(report.totals.unresolved, 336 - report.totals.closed);
  assert.ok(report.totals.closed > 0);
  assert.ok(report.totals.qualified_pass > 0);
  assert.ok(report.totals.owner_gated > 0);
  assert.ok(report.totals.open > 0);
  assert.equal(report.modules.length, 16);
  assert.ok(report.modules.every((module) => module.missing.length === 0));
  assert.ok(report.modules.every((module) => typeof module.fullyClosed === 'boolean'));
});
