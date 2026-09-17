import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  MODULES,
  SURFACE_KINDS,
  buildVariants,
  matrixContract,
  parseVariant,
  routeMatchesModule,
  variantKey,
} from './contract.mjs';
import { computeDelta, validateVariantResult } from './evidence.mjs';
import { isDomainMutationRequest } from './network.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('matrix keeps the full 8-variant and 128-module-run denominator', () => {
  const contract = matrixContract();
  assert.equal(contract.variantCount, 8);
  assert.equal(contract.modulesPerVariant, 16);
  assert.equal(contract.moduleRuns, 128);
  assert.equal(contract.requiredSurfaceCells, 896);
  assert.equal(new Set(buildVariants().map(variantKey)).size, 8);
});

test('only declared exact variants parse', () => {
  const key = 'owner-dbr77-dbr77-owner-pl-dark';
  assert.equal(variantKey(parseVariant(key)), key);
  assert.throws(() => parseVariant('tomek-dbr77-owner-pl-dark'), /Unknown E2E-1 variant/);
  assert.equal(parseVariant(key).secretPrefix, 'E2E_OWNER_DBR77');
});

test('workflow variants and service-account secrets exactly match the contract', () => {
  const workflow = fs.readFileSync(
    path.join(repoRoot, '.github/workflows/e2e-1-matrix.yml'),
    'utf8'
  );
  const workflowVariants = [...workflow.matchAll(/^\s{10}- ([a-z0-9-]+)$/gm)].map(
    ([, variant]) => variant
  );
  assert.deepEqual(workflowVariants, buildVariants().map(variantKey));
  for (const name of [
    'E2E_ADMIN_NW_EMAIL',
    'E2E_ADMIN_NW_PASSWORD',
    'E2E_OWNER_DBR77_EMAIL',
    'E2E_OWNER_DBR77_PASSWORD',
  ]) {
    assert.ok(workflow.includes(`${name}: ` + '${{ secrets.' + name + ' }}'));
  }
  assert.doesNotMatch(workflow, /E2E_(IRINA|KASIA|TOMEK)_(EMAIL|PASSWORD)/);
});

test('module landing accepts only the declared route or its canonical route', () => {
  const admin = MODULES.find(({ id }) => id === '14-admin');
  assert.equal(routeMatchesModule('/admin/people', admin), true);
  assert.equal(routeMatchesModule('/admin/team/members', admin), true);
  assert.equal(routeMatchesModule('/admin/team/members?tab=active', admin), true);
  assert.equal(routeMatchesModule('/admin/security', admin), false);
});

test('validation cannot silently shrink a module or surface denominator', () => {
  const variant = buildVariants()[0];
  const result = {
    variant: variantKey(variant),
    modules: MODULES.map(({ id, route }) => ({ id, route })),
    cells: MODULES.flatMap((module) =>
      SURFACE_KINDS.map((kind) => ({ module: module.id, kind, status: 'PASS' }))
    ),
    cleanup: { verified: true },
    flags: {},
  };
  assert.deepEqual(validateVariantResult(result, variant), []);
  result.cells.pop();
  assert.match(validateVariantResult(result, variant).join('\n'), /missing denominator cell/);
});

test('delta reports PASS to failure as regression and failure to PASS as fix', () => {
  const previous = {
    cells: [
      { variant: 'v', module: 'm', kind: 'menu1', control: 'a', status: 'PASS' },
      { variant: 'v', module: 'm', kind: 'menu2', control: 'b', status: 'FAIL' },
    ],
  };
  const current = {
    cells: [
      { variant: 'v', module: 'm', kind: 'menu1', control: 'a', status: 'FAIL' },
      { variant: 'v', module: 'm', kind: 'menu2', control: 'b', status: 'PASS' },
    ],
  };
  const delta = computeDelta(previous, current);
  assert.equal(delta.regressions.length, 1);
  assert.equal(delta.fixes.length, 1);
});

test('mutation gate counts only same-origin domain writes', () => {
  const base = 'https://staging.consultify.ai';
  assert.equal(
    isDomainMutationRequest({ url: `${base}/api/conclusions/sync`, method: 'POST' }, base),
    true
  );
  assert.equal(
    isDomainMutationRequest({ url: `${base}/api/auth/switch-organization`, method: 'POST' }, base),
    false
  );
  assert.equal(
    isDomainMutationRequest({ url: `${base}/api/v10/teresa/voice-event`, method: 'POST' }, base),
    false
  );
  assert.equal(isDomainMutationRequest({ url: `${base}/api/errors`, method: 'POST' }, base), false);
  assert.equal(
    isDomainMutationRequest(
      { url: 'https://www.google-analytics.com/g/collect', method: 'POST' },
      base
    ),
    false
  );
  assert.equal(isDomainMutationRequest({ url: `${base}/api/tasks`, method: 'GET' }, base), false);
});

test('web-vitals beacon is whitelisted by exact path+method, not a blanket /api/analytics rule', () => {
  const base = 'https://staging.consultify.ai';
  // DEC-590 (Wpis 39): the app fires POST /api/analytics/web-vitals on its own;
  // run 1 counted it as 248 false "unexpected writes" and blocked all 16 menu1.
  assert.equal(
    isDomainMutationRequest({ url: `${base}/api/analytics/web-vitals`, method: 'POST' }, base),
    false,
    'passive web-vitals POST must be allowed'
  );
  // A real domain write that happens to live under /api/analytics is still caught.
  assert.equal(
    isDomainMutationRequest({ url: `${base}/api/analytics/custom-events`, method: 'POST' }, base),
    true,
    'a non-whitelisted /api/analytics POST must still count as a domain write'
  );
  // The whitelist is method-aware: same path, different method is a write.
  assert.equal(
    isDomainMutationRequest({ url: `${base}/api/analytics/web-vitals`, method: 'PUT' }, base),
    true,
    'web-vitals under a non-whitelisted method must count as a domain write'
  );
});
