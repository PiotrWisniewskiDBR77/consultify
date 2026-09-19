import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  CLASS_SEVERITY,
  buildGroups,
  classifyCell,
  classifyResult,
  flagDiff,
  flagMap,
  flagProfile,
  groupKey,
  localeOf,
  worstClass,
} from './classify.mjs';
import { appConsoleErrors, isHarnessConsoleNoise } from './consoleNoise.mjs';
import { writeVariantArtifacts } from './evidence.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const LIGHT = 'admin-nw-northwind-admin-en-light';
const DARK = 'admin-nw-northwind-admin-en-dark';

function cell(overrides = {}) {
  return {
    variant: LIGHT,
    module: '02-my-work',
    kind: 'menu2',
    control: 'Tasks',
    status: 'FAIL',
    note: '',
    consoleErrors: [],
    httpErrors: [],
    ...overrides,
  };
}

function result(overrides = {}) {
  return {
    variant: LIGHT,
    modules: [{ id: '02-my-work', route: '/my-work', settle: [{ route: '/my-work', spinnerGone: true }] }],
    cells: [],
    cleanup: { verified: true, mutatingRequests: [] },
    flags: { runtime: { VITE_MEETING_PROTOCOL: false } },
    ...overrides,
  };
}

test('a view that attempts a write is a PRODUCT defect, not a harness problem', () => {
  const verdict = classifyCell(cell({ status: 'BLOCKED' }));
  assert.equal(verdict.class, 'PRODUCT');
  assert.equal(verdict.confidence, 'high');
});

test('app-reported errors stay PRODUCT even when the route never settled', () => {
  const stuck = { stuckRoute: true };
  assert.equal(
    classifyCell(cell({ httpErrors: ['GET /api/tasks -> 503'] }), stuck).class,
    'PRODUCT'
  );
  assert.equal(
    classifyCell(cell({ consoleErrors: ['Uncaught TypeError: x is not a function'] }), stuck).class,
    'PRODUCT'
  );
  assert.equal(classifyCell(cell({ httpErrors: ['GET /api/tasks -> 403'] }), stuck).class, 'PRODUCT');
});

test('the harness own blocked-request console noise is not an app error', () => {
  // Measured in the real local run (18.09): route.abort('blockedbyclient') makes
  // Chromium log ERR_BLOCKED_BY_CLIENT, which scored 02-my-work/menu2 and
  // 08-projects/menu2 as PRODUCT "uncaught console error" instead of CONTRACT.
  const noise = 'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector';
  assert.equal(isHarnessConsoleNoise(noise), true);
  assert.equal(isHarnessConsoleNoise('Uncaught TypeError: x is not a function'), false);
  assert.deepEqual(appConsoleErrors([noise, 'Uncaught TypeError: boom']), [
    'Uncaught TypeError: boom',
  ]);

  const missing = classifyCell(cell({ status: 'MISSING', consoleErrors: [noise] }));
  assert.equal(missing.class, 'CONTRACT');
  assert.doesNotMatch(missing.reason, /console error/);
  assert.equal(
    classifyCell(cell({ status: 'MISSING', consoleErrors: [noise, 'Uncaught TypeError: boom'] }))
      .class,
    'PRODUCT'
  );
});

test('a browser-level connectivity failure is ENV, not a product defect', () => {
  // Measured in the real local run (18.09): 09-execution/menu2 and
  // 09-execution/right-panel scored PRODUCT on net::ERR_INTERNET_DISCONNECTED —
  // no server was ever reached, so neither the app nor the harness contract is
  // at fault.
  const offline = 'Failed to load resource: net::ERR_INTERNET_DISCONNECTED';
  const verdict = classifyCell(cell({ status: 'MISSING', consoleErrors: [offline] }));
  assert.equal(verdict.class, 'ENV');
  assert.equal(verdict.confidence, 'high');
  assert.match(verdict.reason, /never reached a server/);

  assert.equal(
    classifyCell(
      cell({ status: 'FAIL', consoleErrors: [offline, 'Uncaught TypeError: boom'] })
    ).class,
    'PRODUCT',
    'a genuine app error keeps the cell PRODUCT'
  );
  assert.equal(
    classifyCell(cell({ status: 'FAIL', consoleErrors: [offline], httpErrors: ['GET /api/x -> 503'] }))
      .class,
    'PRODUCT',
    'an app-reported 5xx outranks the connectivity failure'
  );
});

test('a non-interactable control with a stuck spinner is ENV, not PRODUCT', () => {
  const verdict = classifyCell(
    cell({ note: 'locator.click: Timeout 8000ms exceeded.' }),
    { stuckRoute: true }
  );
  assert.equal(verdict.class, 'ENV');
  assert.match(verdict.reason, /never settled/);
});

test('a flag profile that moved inside one principal makes its cells ENV', () => {
  const verdict = classifyCell(cell({ status: 'MISSING' }), { flagMinority: true });
  assert.equal(verdict.class, 'ENV');
  assert.match(verdict.reason, /flag profile differs/);
});

test('MISSING in every comparable variant is CONTRACT; MISSING in one of two is PRODUCT', () => {
  const absent = classifyCell(cell({ status: 'MISSING' }), { group: { total: 2, nonPassing: 2 } });
  assert.equal(absent.class, 'CONTRACT');
  assert.equal(absent.confidence, 'high');

  const themeSpecific = classifyCell(cell({ status: 'MISSING' }), {
    group: { total: 2, nonPassing: 1 },
  });
  assert.equal(themeSpecific.class, 'PRODUCT');
  assert.match(themeSpecific.reason, /fine in 1\/2 comparable variants/);

  const alone = classifyCell(cell({ status: 'MISSING' }));
  assert.equal(alone.class, 'CONTRACT');
  assert.equal(alone.confidence, 'low', 'single-variant evidence must not claim certainty');
});

test('a click timeout with no app error is CONTRACT; an unexplained FAIL is PRODUCT', () => {
  const timeout = classifyCell(cell({ note: 'locator.click: Timeout 8000ms exceeded.' }));
  assert.equal(timeout.class, 'CONTRACT');

  const unexplained = classifyCell(cell({ note: '' }));
  assert.equal(unexplained.class, 'PRODUCT');
  assert.equal(unexplained.confidence, 'low');
});

test('menu1 landing on the wrong route is PRODUCT with the measured route in the reason', () => {
  const verdict = classifyCell(
    cell({
      module: '14-admin',
      kind: 'menu1',
      control: '/admin/people',
      routeAfter: '/login',
    }),
    { module: { id: '14-admin', route: '/admin/people', canonicalRoutes: ['/admin/team/members'] } }
  );
  assert.equal(verdict.class, 'PRODUCT');
  assert.match(verdict.reason, /landed on \/login/);
});

test('PASS cells are never classified and the default bias is PRODUCT', () => {
  assert.equal(classifyCell(cell({ status: 'PASS' })), null);
  assert.deepEqual(CLASS_SEVERITY, ['PRODUCT', 'ENV', 'CONTRACT']);
  assert.equal(worstClass({ PRODUCT: 0, CONTRACT: 4, ENV: 2 }), 'ENV');
  assert.equal(worstClass({ PRODUCT: 1, CONTRACT: 4, ENV: 2 }), 'PRODUCT');
  assert.equal(worstClass({ PRODUCT: 0, CONTRACT: 0, ENV: 0 }), null);
});

test('the flag profile is order-insensitive and moves only with a value', () => {
  const a = result({ flags: { runtime: { A: true, B: 'x' } } });
  const b = result({ flags: { runtime: { B: 'x', A: true } } });
  const c = result({ flags: { runtime: { A: false, B: 'x' } } });
  assert.equal(flagProfile(a), flagProfile(b));
  assert.notEqual(flagProfile(a), flagProfile(c));
  assert.equal(flagProfile(result({ flags: {} })), 'none');
  assert.deepEqual(flagDiff(a, c), [{ flag: 'runtime.A', a: true, b: false }]);
});

test('the flag profile covers the v8 snapshot, not only an empty runtime map', () => {
  // Measured 18.09 on the local stack: /api/feature-flags/runtime returned {} for
  // both variants while /api/v8/admin/flags returned 9 flags. A runtime-only
  // fingerprint hashed the same empty map for every variant, so the flag axis
  // could never explain a difference.
  const emptyRuntime = result({ flags: { runtime: {}, v8: { PMO: true, OUTPUTS: false } } });
  const movedV8 = result({ flags: { runtime: {}, v8: { OUTPUTS: false, PMO: false } } });
  assert.notEqual(flagProfile(emptyRuntime), 'none');
  assert.notEqual(flagProfile(emptyRuntime), flagProfile(movedV8));
  assert.deepEqual(flagDiff(emptyRuntime, movedV8), [{ flag: 'v8.PMO', a: true, b: false }]);
  assert.deepEqual(
    Object.keys(flagMap(emptyRuntime)),
    ['v8.OUTPUTS', 'v8.PMO'],
    'names are source-prefixed and sorted, so a runtime and a v8 flag cannot collide'
  );
});

test('groups only compare variants of the same principal and locale', () => {
  const results = [
    result({ variant: LIGHT, cells: [cell({ status: 'MISSING' })] }),
    result({ variant: DARK, cells: [cell({ variant: DARK, status: 'PASS' })] }),
    result({ variant: 'owner-dbr77-dbr77-owner-en-light', cells: [cell({ status: 'MISSING' })] }),
  ];
  const groups = buildGroups(results, (item) => localeOf(item.variant), (item) =>
    item.variant.startsWith('admin-nw') ? 'admin-nw/northwind' : 'owner-dbr77/dbr77'
  );
  const adminKey = groupKey('admin-nw/northwind', 'en', cell({}));
  assert.deepEqual(groups.get(adminKey), { key: adminKey, total: 2, nonPassing: 1 });
  const ownerKey = groupKey('owner-dbr77/dbr77', 'en', cell({}));
  assert.deepEqual(groups.get(ownerKey), { key: ownerKey, total: 1, nonPassing: 1 });
});

test('classifyResult annotates every non-PASS cell and counts the split', () => {
  const classified = classifyResult(
    result({
      variant: LIGHT,
      cells: [
        cell({ status: 'PASS' }),
        cell({ kind: 'menu3', control: 'More', status: 'BLOCKED' }),
        cell({ kind: 'kebab', control: 'none', status: 'MISSING' }),
      ],
    }),
    { locale: 'en', principal: 'admin-nw/northwind' }
  );
  assert.deepEqual(classified.counts, { PRODUCT: 1, CONTRACT: 1, ENV: 0 });
  assert.equal(classified.nonPassing, 2);
  assert.equal(classified.cells[0].classification, undefined);
  assert.equal(classified.cells[1].classification.class, 'PRODUCT');
});

test('the per-variant artifact carries the class of every red cell (evidence.mjs wiring)', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e1-variant-'));
  writeVariantArtifacts({
    outDir,
    result: result({
      variant: LIGHT,
      cells: [
        cell({ status: 'PASS' }),
        cell({ kind: 'create', control: 'New task', httpErrors: ['POST /api/tasks -> 500'] }),
      ],
    }),
    previous: null,
  });
  const written = JSON.parse(fs.readFileSync(path.join(outDir, 'result.json'), 'utf8'));
  assert.deepEqual(written.classes, { PRODUCT: 1, CONTRACT: 0, ENV: 0 });
  assert.equal(written.cells[1].classification.class, 'PRODUCT');
  assert.equal(written.cells[0].classification, undefined);
  assert.ok(written.flagProfile.length === 12, 'flag profile fingerprint must be recorded');

  const report = fs.readFileSync(path.join(outDir, 'REPORT.md'), 'utf8');
  assert.match(report, /- Classes: PRODUCT 1 · CONTRACT 0 · ENV 0/);
  assert.match(report, /\| Class \| Why \|/);
  assert.match(report, /\| FAIL \| PRODUCT \| server error on view: POST \/api\/tasks -> 500 \|/);
  fs.rmSync(outDir, { recursive: true, force: true });
});

// WIRING (not a mirror): the aggregate — the artifact CTO reads — must name the
// class of every red. Two fixtures through the real aggregate.mjs process: one
// whose reds are app errors (FAIL_PRODUCT) and one whose only red is a surface
// absent in both themes (FAIL_CONTRACT).
function runAggregate(variants) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e1-agg-'));
  for (const item of variants) {
    const dir = path.join(root, item.variant);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(item, null, 2));
  }
  const out = path.join(root, 'aggregate');
  const run = spawnSync(
    process.execPath,
    [path.join(here, 'aggregate.mjs'), root, out],
    { encoding: 'utf8' }
  );
  const summary = JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8'));
  const report = fs.readFileSync(path.join(out, 'REPORT.md'), 'utf8');
  fs.rmSync(root, { recursive: true, force: true });
  return { status: run.status, stdout: run.stdout, stderr: run.stderr, summary, report };
}

test('aggregate labels app-error reds FAIL_PRODUCT and reports the split', () => {
  const { status, summary, report } = runAggregate([
    result({
      variant: LIGHT,
      cells: [cell({ httpErrors: ['GET /api/tasks -> 500'], note: '' })],
    }),
    result({ variant: DARK, cells: [cell({ variant: DARK, status: 'PASS' })] }),
  ]);
  assert.equal(status, 1, 'the gate must stay red for a product defect');
  assert.equal(summary.status, 'FAIL_PRODUCT');
  assert.deepEqual(summary.classes, { PRODUCT: 1, CONTRACT: 0, ENV: 0 });
  assert.equal(summary.worstClass, 'PRODUCT');
  assert.match(report, /Non-passing cells: 1 \(PRODUCT 1 · CONTRACT 0 · ENV 0\)/);
  assert.match(report, /\| FAIL \| PRODUCT \| server error on view: GET \/api\/tasks -> 500 \|/);
});

test('aggregate labels a surface absent in both themes FAIL_CONTRACT, not a product defect', () => {
  const { status, summary, report } = runAggregate([
    result({ variant: LIGHT, cells: [cell({ status: 'MISSING', control: 'none' })] }),
    result({ variant: DARK, cells: [cell({ variant: DARK, status: 'MISSING', control: 'none' })] }),
  ]);
  assert.equal(status, 1, 'a stale contract must still fail the run — it is never silent');
  assert.equal(summary.status, 'FAIL_CONTRACT');
  assert.deepEqual(summary.classes, { PRODUCT: 0, CONTRACT: 2, ENV: 0 });
  assert.match(report, /selector or product contract, not a regression/);
});

test('aggregate flags a flag profile that moved inside one principal', () => {
  const plLight = 'admin-nw-northwind-admin-pl-light';
  const plDark = 'admin-nw-northwind-admin-pl-dark';
  const { summary } = runAggregate([
    result({ variant: LIGHT, cells: [] }),
    result({ variant: DARK, cells: [] }),
    result({ variant: plLight, cells: [] }),
    result({
      variant: plDark,
      flags: { runtime: { VITE_MEETING_PROTOCOL: true } },
      cells: [cell({ variant: plDark, status: 'MISSING', control: 'none' })],
    }),
  ]);
  assert.equal(summary.flagIssues.length, 1);
  assert.match(summary.flagIssues[0], /admin-nw\/northwind: 2 flag profiles/);
  assert.match(summary.flagIssues[0], /VITE_MEETING_PROTOCOL false→true/);
  assert.ok(summary.flagIssues[0].includes(`minority ${plDark}`));
  assert.deepEqual(summary.classes, { PRODUCT: 0, CONTRACT: 0, ENV: 1 });
  assert.equal(summary.status, 'FAIL_ENV');
});

test('aggregate names surfaces that exist for one principal only instead of folding them into PRODUCT', () => {
  const { summary, report } = runAggregate([
    result({ variant: LIGHT, cells: [cell({ status: 'PASS' })] }),
    result({
      variant: 'owner-dbr77-dbr77-owner-en-light',
      cells: [cell({ variant: 'owner-dbr77-dbr77-owner-en-light', status: 'MISSING', control: 'none' })],
    }),
  ]);
  assert.equal(summary.principalOnlySurfaces.length, 1);
  assert.deepEqual(summary.principalOnlySurfaces[0].renderedFor, ['admin-nw/northwind']);
  assert.deepEqual(summary.principalOnlySurfaces[0].absentFor, ['owner-dbr77/dbr77']);
  assert.match(report, /Surfaces present for one principal only/);
});
