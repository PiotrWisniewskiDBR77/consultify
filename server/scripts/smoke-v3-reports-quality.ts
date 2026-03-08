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

  const routes = read(root, 'server/src/routes/report-builder.routes.ts');
  const exportPanel = read(root, 'src/components/ReportBuilder/ExportSharePanel.tsx');
  const outlineStep = read(root, 'src/components/ReportBuilder/steps/OutlineProposalStep.tsx');

  checks.push({
    name: 'Reports export endpoints enforce quality gates before file generation',
    pass: includesAll(routes, [
      'enforceQualityGatesForExport',
      "router.get('/:id/export/pdf'",
      "router.get('/:id/export/pptx'",
      "router.get('/:id/export/docx', exportDocx)",
      'REPORT_NOT_READY_FOR_EXPORT',
      'qualityReport',
    ]),
  });

  checks.push({
    name: 'Reports outline API keeps compatibility for sections and variants',
    pass: includesAll(routes, [
      "'/:id/propose-outline'",
      'res.json({ variants, sections: variants[0]?.sections || [] })',
    ]) && includesAll(outlineStep, [
      'res?.sections ?? res?.variants?.[0]?.sections ?? res?.outline ?? []',
      '/propose-outline',
    ]),
  });

  checks.push({
    name: 'Reports export panel reads backend quality gates and blocks export on errors',
    pass: includesAll(exportPanel, [
      '/api/report-builder/${reportId}/quality-gates',
      'qualityReport?.canExport === false',
      'const exportDisabled = isLoading || qualityLoading || hasErrors',
      'disabled={exportDisabled}',
    ]),
  });

  const failed = checks.filter((check) => !check.pass);

  console.log('\n[smoke-v3-reports-quality] Summary:');
  for (const check of checks) {
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((item) => item.name).join(', ')}`);
  }

  console.log('\n[smoke-v3-reports-quality] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error('[smoke-v3-reports-quality] Failed:', (error as Error)?.message || error);
  process.exit(1);
}
