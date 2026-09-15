import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test, { afterEach } from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const script = resolve(root, 'scripts/check-flagi-dockerfile.mjs');
const roots = [];

afterEach(() => {
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});

function fixture({ srcContent, dockerfileArgs, wyjatki }) {
  const dir = mkdtempSync(resolve(tmpdir(), 'flagi-dockerfile-'));
  roots.push(dir);
  const srcDir = resolve(dir, 'src');
  mkdirSync(srcDir, { recursive: true });
  writeFileSync(resolve(srcDir, 'flag.ts'), srcContent);

  const dockerfileLines = [];
  for (const arg of dockerfileArgs) {
    dockerfileLines.push(`ARG ${arg}`);
    dockerfileLines.push(`ENV ${arg}=\${${arg}}`);
  }
  const dockerfilePath = resolve(dir, 'Dockerfile.api');
  writeFileSync(dockerfilePath, dockerfileLines.join('\n') + '\n');

  const wyjatkiPath = resolve(dir, 'wyjatki.json');
  writeFileSync(wyjatkiPath, JSON.stringify({ wyjatki: wyjatki || {} }));

  return { dir, srcDir, dockerfilePath, wyjatkiPath };
}

function run(fx) {
  return spawnSync(
    process.execPath,
    [script, '--src', fx.srcDir, '--dockerfile', fx.dockerfilePath, '--wyjatki', fx.wyjatkiPath],
    { encoding: 'utf8' },
  );
}

test('exits 1 and names the flag when a VITE_* read in src/ has no ARG in Dockerfile.api', () => {
  const fx = fixture({
    srcContent: "const on = import.meta.env.VITE_TEST_MISSING_FLAG === 'true';\nexport default on;\n",
    dockerfileArgs: [],
    wyjatki: {},
  });

  const result = run(fx);

  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /VITE_TEST_MISSING_FLAG/);
});

test('exits 0 when the flag has a matching ARG in Dockerfile.api', () => {
  const fx = fixture({
    srcContent: "const on = import.meta.env.VITE_TEST_PRESENT_FLAG === 'true';\nexport default on;\n",
    dockerfileArgs: ['VITE_TEST_PRESENT_FLAG'],
    wyjatki: {},
  });

  const result = run(fx);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /brakujace=0/);
});

test('exits 0 when the flag has no ARG but is listed with a reason in wyjatki.json', () => {
  const fx = fixture({
    srcContent: "const on = import.meta.env.VITE_TEST_DEV_ONLY_FLAG === 'true';\nexport default on;\n",
    dockerfileArgs: [],
    wyjatki: { VITE_TEST_DEV_ONLY_FLAG: 'dev-only debug toggle, not a product feature' },
  });

  const result = run(fx);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /brakujace=0/);
});

test('the real repo Dockerfile.api and scripts/flagi-dockerfile.wyjatki.json pass with zero missing flags', () => {
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /brakujace=0/);
});
