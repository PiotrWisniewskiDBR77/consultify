import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test, { afterEach } from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const scriptPath = path.join(repoRoot, 'scripts/dev/verify-canonical-16-module-bindings.mjs');
const sourceManifestPath = path.join(
  repoRoot,
  'docs/program/waves/WAVE_03_ACCEPTANCE/canonical-16-module-bindings.json'
);
const sourceRoutesPath = path.join(repoRoot, 'src/routes/AppRoutes.tsx');
const temporaryRoots = [];

afterEach(() => {
  while (temporaryRoots.length) rmSync(temporaryRoots.pop(), { recursive: true, force: true });
});

function runFixture({
  transformManifest = (value) => value,
  transformRoutes = (value) => value,
} = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'canonical-16-'));
  temporaryRoots.push(root);
  const manifestPath = path.join(root, 'manifest.json');
  const routesPath = path.join(root, 'AppRoutes.tsx');
  const manifest = transformManifest(JSON.parse(readFileSync(sourceManifestPath, 'utf8')));
  const routes = transformRoutes(readFileSync(sourceRoutesPath, 'utf8'));
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(routesPath, routes);
  return spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      CANONICAL_16_MANIFEST_PATH: manifestPath,
      CANONICAL_16_ROUTES_PATH: routesPath,
    },
  });
}

test('passes when no module declares forbiddenCanonicalComponent', () => {
  const result = runFixture({
    transformManifest: (manifest) => ({
      ...manifest,
      modules: manifest.modules.map(
        ({ forbiddenCanonicalComponent: _forbidden, ...module }) => module
      ),
    }),
  });
  assert.equal(result.status, 0, result.stderr);
});

test('passes when the canonical Results route does not mount ResultsHub', () => {
  const result = runFixture();
  assert.equal(result.status, 0, result.stderr);
});

test('rejects ResultsHub inside the canonical Results route block', () => {
  const result = runFixture({
    transformRoutes: (routes) =>
      routes.replace('<ResultsOwnerReviewEntry />', '<ResultsOwnerReviewEntry /><ResultsHub />'),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ResultsHub/);
});

test('rejects a canonical component that is also forbidden', () => {
  const result = runFixture({
    transformManifest: (manifest) => ({
      ...manifest,
      modules: manifest.modules.map((module) =>
        module.id === 'results'
          ? { ...module, forbiddenCanonicalComponent: module.component }
          : module
      ),
    }),
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cannot also be forbidden/);
});

test('checks a forbidden component when its canonical route is the last sibling', () => {
  const source = readFileSync(sourceRoutesPath, 'utf8');
  const routeToken = 'path={ROUTES.RESULTS}';
  const routeAt = source.indexOf(routeToken);
  const nextRouteAt = source.indexOf('\n        <Route', routeAt + routeToken.length);
  const routeBlock = source.slice(routeAt, nextRouteAt === -1 ? undefined : nextRouteAt);
  const withoutOriginalBlock = `${source.slice(0, routeAt)}${source.slice(nextRouteAt)}`;
  const result = runFixture({
    transformRoutes: () => `${withoutOriginalBlock}\n        <Route ${routeBlock}`,
  });
  assert.equal(result.status, 0, result.stderr);
});
