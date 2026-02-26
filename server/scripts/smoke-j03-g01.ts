#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type Check = { name: string; pass: boolean };

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function includesAll(content: string, needles: string[]): boolean {
  return needles.every((n) => content.includes(n));
}

function main(): void {
  const root = process.cwd();
  const checks: Check[] = [];

  const rbRoutes = read(path.join(root, 'server/src/routes/report-builder.routes.ts'));
  const rbService = read(path.join(root, 'server/src/services/reportBuilderService.ts'));
  const rbProfiles = read(path.join(root, 'server/src/config/reportInvocationProfiles.ts'));
  const rbHook = read(path.join(root, 'src/components/ReportBuilder/useReportBuilder.ts'));
  const rbSourceSelect = read(path.join(root, 'src/components/ReportBuilder/steps/SourceSelectStep.tsx'));
  const executionHub = read(path.join(root, 'src/components/Execution/ExecutionHub.tsx'));
  const analytics = read(path.join(root, 'src/services/funnelAnalytics.ts'));

  checks.push({
    name: 'J03 routes: upload bundle list/detail endpoints',
    pass: includesAll(rbRoutes, ["/sources/upload_bundle", "/sources/upload_bundle/:sourceId"]),
  });
  checks.push({
    name: 'J03 routes: source type mapped to UPLOAD_BUNDLE',
    pass: rbRoutes.includes("sourceType: 'UPLOAD_BUNDLE'"),
  });
  checks.push({
    name: 'J03 service: source type includes UPLOAD_BUNDLE',
    pass: rbService.includes("| 'UPLOAD_BUNDLE'"),
  });
  checks.push({
    name: 'J03 service: template fallback for UPLOAD_BUNDLE present',
    pass: includesAll(rbService, [
      "fallbackSourceType = sourceType === 'UPLOAD_BUNDLE' ? 'INTERVIEW' : sourceType",
      "sourceType === 'UPLOAD_BUNDLE' && (tplSourceType === 'INTERVIEW' || tplSourceType === 'TOOL')",
    ]),
  });
  checks.push({
    name: 'J03 frontend source selector includes UPLOAD_BUNDLE',
    pass: includesAll(rbHook, ["| 'UPLOAD_BUNDLE'"]) && includesAll(rbSourceSelect, ["type: 'UPLOAD_BUNDLE'"]),
  });
  checks.push({
    name: 'J03 invocation profiles allow UPLOAD_BUNDLE',
    pass: rbProfiles.includes("'UPLOAD_BUNDLE'"),
  });

  checks.push({
    name: 'G01 analytics catalog includes execution events',
    pass: includesAll(analytics, ["'execution_hub_opened'", "'execution_status_updated'"]),
  });
  checks.push({
    name: 'G01 execution hub emits opened event',
    pass: executionHub.includes("trackFunnelEvent('execution_hub_opened'"),
  });
  checks.push({
    name: 'G01 execution hub emits status update event',
    pass: executionHub.includes("trackFunnelEvent('execution_status_updated'"),
  });
  checks.push({
    name: 'G01 timeline view event emitted on mode switch',
    pass: includesAll(executionHub, ["handleViewModeChange", "trackFunnelEvent('execution_timeline_viewed'"]),
  });

  const failed = checks.filter((c) => !c.pass);
  console.log('\n[smoke-j03-g01] Summary:');
  for (const c of checks) {
    console.log(` - ${c.pass ? 'OK' : 'FAIL'} ${c.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((f) => f.name).join(', ')}`);
  }

  console.log('\n[smoke-j03-g01] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error('[smoke-j03-g01] Failed:', (error as Error)?.message || error);
  process.exit(1);
}

