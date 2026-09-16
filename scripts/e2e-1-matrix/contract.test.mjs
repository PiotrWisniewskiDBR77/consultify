import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MODULES,
  SURFACE_KINDS,
  buildVariants,
  matrixContract,
  parseVariant,
  variantKey,
} from './contract.mjs';
import { computeDelta, validateVariantResult } from './evidence.mjs';
import { isDomainMutationRequest } from './network.mjs';

test('matrix keeps the full 16-variant and 256-module-run denominator', () => {
  const contract = matrixContract();
  assert.equal(contract.variantCount, 16);
  assert.equal(contract.modulesPerVariant, 16);
  assert.equal(contract.moduleRuns, 256);
  assert.equal(contract.requiredSurfaceCells, 1_792);
  assert.equal(new Set(buildVariants().map(variantKey)).size, 16);
});

test('only declared exact variants parse', () => {
  const key = 'tomek-dbr77-owner-pl-dark';
  assert.equal(variantKey(parseVariant(key)), key);
  assert.throws(() => parseVariant('tomek-dbr77-admin-pl-dark'), /Unknown E2E-1 variant/);
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
