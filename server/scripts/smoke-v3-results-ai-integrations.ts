#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type Check = { name: string; pass: boolean };

function read(root: string, relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function includesAll(content: string, needles: string[]): boolean {
  return needles.every((needle) => content.includes(needle));
}

function main(): void {
  const root = process.cwd();
  const checks: Check[] = [];

  const benefitsRoutes = read(root, 'server/src/routes/benefits.routes.ts');
  const kpiDeviationTest = read(root, 'tests/unit/backend/results/kpiDeviationService.test.ts');
  const attributionService = read(root, 'server/src/services/kpiAttributionService.ts');
  const attributionPanel = read(root, 'src/components/Benefits/KPIAttributionPanel.tsx');
  const attributionTest = read(root, 'tests/unit/backend/results/kpiAttributionService.test.ts');
  const intentRouter = read(root, 'server/src/services/ai/intentRouter.ts');
  const aiRoutes = read(root, 'server/src/routes/ai.routes.ts');
  const intentRouterTest = read(root, 'tests/unit/backend/ai/intentRouter.test.ts');
  const llmRoutes = read(root, 'server/src/routes/llm.routes.ts');
  const integrationSettings = read(root, 'src/components/settings/IntegrationSettings.tsx');

  checks.push({
    name: 'H04 deviation cases support closure evidence and action status updates',
    pass: includesAll(benefitsRoutes, [
      '/deviation-cases/:caseId/actions/:actionId',
      '/deviation-cases/:caseId/close',
      'evidenceText',
      'evidenceRef',
      'resolutionNotes',
    ]),
  });

  // H04 UI: the drawer this check read (src/components/Results/KPITimeSeriesDrawer.tsx)
  // was deleted with the retired ResultsHub subtree. The live deviation-closure
  // surface is src/components/ResultsVNext/kpiTool/KpiDeviationCaseSubview.tsx on
  // /results/kpi/:kpiId/deviation-cases/:caseId, talking to kpiDeviationApi.ts —
  // covered by src/components/ResultsVNext/kpiTool/__tests__/kpiDeviationChildren.api.test.ts.
  // The backend contract above (benefitsRoutes) is still asserted.

  checks.push({
    name: 'H04 backend deviation contract has a non-placeholder test',
    pass: includesAll(kpiDeviationTest, [
      "describe('handleTimeSeriesRecorded'",
      'creates a deviation case and notifies owner on RED',
      'handleTimeSeriesRecorded({',
    ]),
  });

  checks.push({
    name: 'H06 attribution service computes heuristic share with uncertainty disclosure',
    pass: includesAll(attributionService, [
      'computeAttribution(',
      'initiative_kpi_mappings',
      'unexplainedPercent',
      'assumptions',
      'disclaimer',
    ]),
  });

  checks.push({
    name: 'H06 attribution UI surfaces policy, breakdown, and snapshot save',
    pass: includesAll(attributionPanel, [
      '/benefits/attribution/${kpiId}',
      '/benefits/attribution/${selectedKpi}/snapshot',
      'Attribution policy',
      'Attribution Breakdown',
    ]),
  });

  checks.push({
    name: 'H06 attribution has a non-placeholder regression test',
    pass: includesAll(attributionTest, [
      'computeAttribution',
      'returns heuristic contributions while preserving manual-mapping uncertainty',
      'initiative_kpi_mappings',
    ]),
  });

  checks.push({
    name: 'N09 intent router classifies and routes workflows with context artifacts',
    pass: includesAll(intentRouter, [
      'export function classifyIntent',
      'export async function routeIntent',
      'requiredContext',
      'contextArtifacts',
      'deep_research',
      'execution',
    ]),
  });

  checks.push({
    name: 'N09 API exposes both classify and route endpoints',
    pass: includesAll(aiRoutes, [
      '/intent/classify',
      '/intent/route',
      'classifyIntent(message)',
      'routeIntent(message, orgId',
    ]),
  });

  checks.push({
    name: 'N09 intent router has a non-placeholder regression test',
    pass: includesAll(intentRouterTest, [
      "describe('intentRouter'",
      'routes evidence-heavy analysis to deep research workflow',
      'routes task and timeline changes to execution workflow',
    ]),
  });

  checks.push({
    name: 'N10 org coverage report evaluates policy, org enablement, and health',
    pass: includesAll(llmRoutes, [
      '/use-cases/overview',
      'policyAllowed',
      'enabledForOrg',
      'healthyPurposes',
      'coveragePct',
    ]),
  });

  checks.push({
    name: 'M14 integrations UI shows explicit sync scope labels',
    pass: includesAll(integrationSettings, [
      'sync_scope?:',
      'sync_scope_label?:',
      "integrations.scope.readOnly",
      "integrations.scope.bidirectional",
      'getSyncScopeMeta(connected.sync_scope).label',
    ]),
  });

  const failed = checks.filter((check) => !check.pass);

  console.log('\n[smoke-v3-results-ai-integrations] Summary:');
  for (const check of checks) {
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((item) => item.name).join(', ')}`);
  }

  console.log('\n[smoke-v3-results-ai-integrations] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error(
    '[smoke-v3-results-ai-integrations] Failed:',
    (error as Error)?.message || error
  );
  process.exit(1);
}
