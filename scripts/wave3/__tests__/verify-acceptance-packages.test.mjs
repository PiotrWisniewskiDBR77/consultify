import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const verifier = resolve(root, 'scripts/wave3/verify-acceptance-packages.mjs');

test('Wave 3 has exactly 16 complete canonical acceptance packages', () => {
  const run = spawnSync(process.execPath, [verifier], {
    cwd: root,
    encoding: 'utf8',
  });

  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), {
    ok: true,
    modules: 16,
    gatesPerModule: 21,
    mobile: 'DEFERRED_NON_GATING',
    masterRows: 16,
  });
});
