import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const manifestPath = path.join(
  repoRoot,
  'docs/program/waves/WAVE_03_ACCEPTANCE/canonical-16-module-bindings.json'
);
const routesPath = path.join(repoRoot, 'src/routes/AppRoutes.tsx');
const routeConfigPath = path.join(repoRoot, 'src/routes/routeConfig.ts');
const menuPath = path.join(repoRoot, 'src/components/navigation/Sidebar/menuConfig.ts');

const [manifestRaw, routes, routeConfig, menu] = await Promise.all([
  readFile(manifestPath, 'utf8'),
  readFile(routesPath, 'utf8'),
  readFile(routeConfigPath, 'utf8'),
  readFile(menuPath, 'utf8'),
]);
const manifest = JSON.parse(manifestRaw);

assert.equal(manifest.schemaVersion, 1, 'Unsupported binding manifest version');
assert.equal(manifest.modules.length, 16, 'The canonical denominator must remain exactly 16');
assert.equal(new Set(manifest.modules.map((module) => module.id)).size, 16, 'Module IDs must be unique');

for (const module of manifest.modules) {
  assert.ok(module.route.startsWith('/'), `${module.id}: canonical route must be absolute`);
  assert.ok(module.component, `${module.id}: selected component is missing`);
  assert.match(routes, new RegExp(`\\b${module.component}\\b`), `${module.id}: component is absent from AppRoutes`);
  assert.ok(
    ['CANONICAL_REACHABLE', 'CANONICAL_WITH_GAP'].includes(module.sourceStatus),
    `${module.id}: invalid source status`
  );
  assert.equal(module.ownerDecision, 'PENDING', `${module.id}: owner decision changed without freeze review`);
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
  assert.ok(routeBlock.includes(componentToken), `${id}: canonical route does not select ${componentToken}`);
}

assert.ok(menu.includes('viewId: AppView.FULL_STEP2_INITIATIVES'), 'Sidebar must select InitiativesHub');
assert.ok(menu.includes('viewId: AppView.FULL_STEP5_EXECUTION'), 'Sidebar must select ExecutionHub');
assert.ok(menu.includes('viewId: AppView.BENEFITS_REALIZATION'), 'Sidebar must select Results');
assert.ok(routeConfig.includes('[AppView.BENEFITS_REALIZATION]: ROUTES.RESULTS'), 'Results AppView mapping drifted');

// This guard is intentionally narrow: legacy source may remain, but the
// canonical /results route block must never remount the retired ResultsHub.
const resultsRouteAt = routes.indexOf('path={ROUTES.RESULTS}');
const resultsNextRouteAt = routes.indexOf('\n        <Route', resultsRouteAt + 1);
const resultsRouteBlock = routes.slice(resultsRouteAt, resultsNextRouteAt);
assert.ok(!resultsRouteBlock.includes('<ResultsHub'), 'Canonical /results remounted retired ResultsHub');

const gaps = manifest.modules.filter((module) => module.sourceStatus === 'CANONICAL_WITH_GAP');
console.log(
  JSON.stringify(
    {
      ok: true,
      denominator: manifest.modules.length,
      canonicalReachable: manifest.modules.length - gaps.length,
      canonicalWithGap: gaps.length,
      gapModules: gaps.map((module) => module.id),
      ownerFreeze: manifest.status,
    },
    null,
    2
  )
);
