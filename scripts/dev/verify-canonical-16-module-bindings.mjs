import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const defaultManifestPath = path.join(
  repoRoot,
  'docs/program/waves/WAVE_03_ACCEPTANCE/canonical-16-module-bindings.json'
);
const defaultRoutesPath = path.join(repoRoot, 'src/routes/AppRoutes.tsx');

// CANONICAL_16_MANIFEST_PATH / CANONICAL_16_ROUTES_PATH exist so the guard's
// own test suite (scripts/dev/__tests__/verifyCanonical16Bindings.test.mjs)
// can point the script at throwaway fixtures instead of the real repo files.
// They must never be honored outside that harness — a stray/leaked env var
// in a dev shell or CI job would silently swap in an arbitrary manifest/
// routes file and make the gate meaningless. Restrict them to NODE_ENV=test
// and ignore (with a warning, not a silent no-op) otherwise.
const isTestEnv = process.env.NODE_ENV === 'test';

function resolveOverridablePath(envVarName, defaultPath) {
  const override = process.env[envVarName];
  if (!override) return { value: defaultPath, overridden: false };
  if (!isTestEnv) {
    console.warn(
      `verify-canonical-16-module-bindings: ignoring ${envVarName} (only honored when NODE_ENV=test); using ${defaultPath}`
    );
    return { value: defaultPath, overridden: false };
  }
  return { value: override, overridden: true };
}

const manifestResolved = resolveOverridablePath('CANONICAL_16_MANIFEST_PATH', defaultManifestPath);
const routesResolved = resolveOverridablePath('CANONICAL_16_ROUTES_PATH', defaultRoutesPath);
const manifestPath = manifestResolved.value;
const routesPath = routesResolved.value;
const routeConfigPath = path.join(repoRoot, 'src/routes/routeConfig.ts');
const menuPath = path.join(repoRoot, 'src/components/navigation/Sidebar/menuConfig.ts');
const verdictsPath = path.join(
  repoRoot,
  'docs/program/waves/WAVE_03_ACCEPTANCE/canonical-16-module-owner-verdicts.json'
);
const observationsPath = path.join(
  repoRoot,
  'docs/program/waves/WAVE_03_ACCEPTANCE/canonical-16-module-owner-observations.json'
);
const acceptanceRoot = path.dirname(verdictsPath);

function assertAcceptanceEvidence(relativePath, label) {
  assert.ok(relativePath, `${label}: path is missing`);
  const absolutePath = path.resolve(repoRoot, relativePath);
  assert.ok(
    absolutePath.startsWith(`${acceptanceRoot}${path.sep}`),
    `${label}: path escapes WAVE_03_ACCEPTANCE`
  );
  return readFile(absolutePath);
}

const [manifestRaw, verdictsRaw, observationsRaw, routes, routeConfig, menu] = await Promise.all([
  readFile(manifestPath, 'utf8'),
  readFile(verdictsPath, 'utf8'),
  readFile(observationsPath, 'utf8'),
  readFile(routesPath, 'utf8'),
  readFile(routeConfigPath, 'utf8'),
  readFile(menuPath, 'utf8'),
]);
const manifest = JSON.parse(manifestRaw);
const verdicts = JSON.parse(verdictsRaw);
const observations = JSON.parse(observationsRaw);

assert.equal(manifest.schemaVersion, 1, 'Unsupported binding manifest version');
assert.equal(manifest.modules.length, 16, 'The canonical denominator must remain exactly 16');
assert.equal(
  new Set(manifest.modules.map((module) => module.id)).size,
  16,
  'Module IDs must be unique'
);

for (const module of manifest.modules) {
  assert.ok(module.route.startsWith('/'), `${module.id}: canonical route must be absolute`);
  assert.ok(module.component, `${module.id}: selected component is missing`);
  if (module.forbiddenCanonicalComponent !== undefined) {
    assert.equal(
      typeof module.forbiddenCanonicalComponent,
      'string',
      `${module.id}: forbiddenCanonicalComponent must be a non-empty string`
    );
    assert.ok(
      module.forbiddenCanonicalComponent.trim(),
      `${module.id}: forbiddenCanonicalComponent must be a non-empty string`
    );
    assert.notEqual(
      module.forbiddenCanonicalComponent,
      module.component,
      `${module.id}: canonical component cannot also be forbidden`
    );
  }
  assert.match(
    routes,
    new RegExp(`\\b${module.component}\\b`),
    `${module.id}: component is absent from AppRoutes`
  );
  assert.ok(
    ['CANONICAL_REACHABLE', 'CANONICAL_WITH_GAP'].includes(module.sourceStatus),
    `${module.id}: invalid source status`
  );
  assert.ok(
    ['PENDING', 'ACCEPT', 'CHANGE', 'BLOCKED'].includes(module.ownerDecision),
    `${module.id}: invalid owner decision`
  );
}

assert.equal(
  new Set(verdicts.records.map((record) => record.module)).size,
  verdicts.records.length
);
const evidenceReads = [];
for (const record of verdicts.records) {
  const module = manifest.modules.find((entry) => entry.id === record.module);
  assert.ok(module, `${record.module}: verdict refers to an unknown module`);
  assert.equal(
    module.ownerDecision,
    record.verdict,
    `${record.module}: verdict and binding disagree`
  );
  assert.ok(module.ownerDecisionRecord, `${record.module}: binding lacks verdict record reference`);
  assert.ok(record.quoteFile, `${record.module}: verbatim quote file is missing`);
  assert.ok(record.evidence?.length > 0, `${record.module}: evidence is missing`);
  evidenceReads.push(assertAcceptanceEvidence(record.quoteFile, `${record.module}: quote`));
  for (const evidencePath of record.evidence) {
    evidenceReads.push(assertAcceptanceEvidence(evidencePath, `${record.module}: evidence`));
  }
}
await Promise.all(evidenceReads);

assert.equal(
  new Set(observations.records.map((record) => record.observationId)).size,
  observations.records.length,
  'observation IDs must be unique'
);
for (const record of observations.records) {
  assert.ok(
    manifest.modules.some((module) => module.id === record.module),
    `${record.module}: unknown observation module`
  );
  assert.equal(
    record.disposition,
    'CAPTURED_UNRECONCILED',
    `${record.observationId}: unexpected disposition`
  );
  assert.equal(record.ownerVerdictEffect, 'NONE_UNTIL_EXPLICIT_VERDICT');
  const quote = await assertAcceptanceEvidence(record.quoteFile, `${record.observationId}: quote`);
  assert.equal(
    crypto.createHash('sha256').update(quote).digest('hex'),
    record.quoteSha256,
    `${record.observationId}: quote hash drifted`
  );
  for (const item of record.evidence || []) {
    const bytes = await assertAcceptanceEvidence(item.path, `${record.observationId}: screenshot`);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), item.sha256);
    assert.equal(Buffer.byteLength(bytes), item.bytes);
  }
}
const nonPending = manifest.modules.filter((module) => module.ownerDecision !== 'PENDING');
assert.equal(
  nonPending.length,
  verdicts.records.length,
  'binding and verdict denominators disagree'
);
if (nonPending.length < 16) {
  assert.equal(manifest.status, 'OWNER_FREEZE_PENDING');
  assert.equal(verdicts.status, 'OWNER_FREEZE_PENDING');
}

const requiredRouteContracts = [
  ['my-work', 'path={`${ROUTES.MY_WORK}/*`', '<MyWorkView'],
  ['audits', 'path="/audit-programs"', '<AuditsMethodHub'],
  ['chat', 'path={ROUTES.AI_CHAT}', '<UnifiedChatPanel mode="full"'],
  ['interview', 'path={ROUTES.INTERVIEW}', '<InterviewHub'],
  ['tools', 'path={ROUTES.DISCOVERY_TOOLS.ROOT}', '<DiscoveryToolsHub'],
  ['assessment', 'path={`${ROUTES.ASSESSMENT.ROOT}/*`', '<AssessmentHub'],
  ['initiatives', 'path={ROUTES.INITIATIVES}', '<InitiativesHub'],
  ['finance', 'path={ROUTES.FINANCE}', '<EconomicsView'],
  ['execution', 'path={ROUTES.EXECUTION}', '<ExecutionHub'],
  ['materials', 'path={ROUTES.PRESENTATIONS}', '<ReportsAndPresentationsHub'],
  ['meetings', 'path={ROUTES.MEETING}', '<MeetingHub'],
  ['results', 'path={ROUTES.RESULTS}', '<ResultsOwnerReviewEntry'],
  ['settings', 'path={`${ROUTES.SETTINGS.ROOT}/*`', '<SettingsView'],
  ['organization', 'path={`${ROUTES.ORGANIZATION.ROOT}/*`', '<OrganizationView'],
  ['admin', 'path={`${ROUTES.ADMIN.ROOT}/*`', '<AdminView'],
  ['partner', 'path={`${ROUTES.PARTNER.LANDING}/*`', '<PartnerPortalViewNew'],
];

for (const [id, routeToken, componentToken] of requiredRouteContracts) {
  const routeAt = routes.indexOf(routeToken);
  assert.notEqual(routeAt, -1, `${id}: canonical route token is missing`);
  // Match only the next sibling route. A plain `<Route` search also matches
  // nested `<RouteErrorBoundary>` wrappers and truncates valid route blocks.
  const nextRouteAt = routes.indexOf('\n        <Route', routeAt + routeToken.length);
  const routeBlock = routes.slice(routeAt, nextRouteAt === -1 ? undefined : nextRouteAt);
  assert.ok(
    routeBlock.includes(componentToken),
    `${id}: canonical route does not select ${componentToken}`
  );
}

assert.ok(
  menu.includes('viewId: AppView.FULL_STEP2_INITIATIVES'),
  'Sidebar must select InitiativesHub'
);
assert.ok(
  menu.includes('viewId: AppView.FULL_STEP5_EXECUTION'),
  'Sidebar must select ExecutionHub'
);
assert.ok(menu.includes('viewId: AppView.BENEFITS_REALIZATION'), 'Sidebar must select Results');
assert.ok(
  routeConfig.includes('[AppView.BENEFITS_REALIZATION]: ROUTES.RESULTS'),
  'Results AppView mapping drifted'
);

// Data-driven: every module declaring forbiddenCanonicalComponent receives
// the same guard. Adding the manifest field is enough; this script does not
// need another module-specific branch (DEC-2026-08-24-04).
for (const module of manifest.modules) {
  const forbidden = module.forbiddenCanonicalComponent;
  if (!forbidden) continue;
  const contract = requiredRouteContracts.find(([id]) => id === module.id);
  assert.ok(contract, `${module.id}: forbiddenCanonicalComponent without a route contract`);
  const routeAt = routes.indexOf(contract[1]);
  assert.notEqual(routeAt, -1, `${module.id}: canonical route token is missing`);
  const nextRouteAt = routes.indexOf('\n        <Route', routeAt + contract[1].length);
  const block = routes.slice(routeAt, nextRouteAt === -1 ? undefined : nextRouteAt);
  assert.ok(
    !block.includes(`<${forbidden}`),
    `${module.id}: canonical route remounted the retired ${forbidden}`
  );
}

const gaps = manifest.modules.filter((module) => module.sourceStatus === 'CANONICAL_WITH_GAP');
for (const module of gaps) {
  assert.ok(
    module.dataStatus?.startsWith('QUALIFIED_'),
    `${module.id}: data/API status is not qualified`
  );
  assert.ok(module.apiFamilies?.length > 0, `${module.id}: API family evidence is missing`);
  assert.ok(module.gap, `${module.id}: qualified gap description is missing`);
}
console.log(
  JSON.stringify(
    {
      ok: true,
      denominator: manifest.modules.length,
      canonicalReachable: manifest.modules.length - gaps.length,
      canonicalWithGap: gaps.length,
      gapModules: gaps.map((module) => module.id),
      apiQualifiedGapModules: gaps.filter((module) => module.dataStatus?.startsWith('QUALIFIED_'))
        .length,
      ownerFreeze: manifest.status,
      ownerVerdictsCaptured: verdicts.records.length,
      ownerObservationsCaptured: observations.records.length,
      manifestPath,
      routesPath,
      manifestPathOverridden: manifestResolved.overridden,
      routesPathOverridden: routesResolved.overridden,
    },
    null,
    2
  )
);
