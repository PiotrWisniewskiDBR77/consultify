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

  const financeHub = read(root, 'src/components/Economics/FinanceHub.tsx');
  const financeTypes = read(root, 'src/components/Economics/financeTypes.ts');
  const financeData = read(root, 'src/components/Economics/hooks/useFinanceData.ts');
  const analysisService = read(root, 'server/src/services/financialAnalysisService.ts');
  const valuationService = read(root, 'server/src/services/valuationService.ts');
  const economicsRoutes = read(root, 'server/src/routes/economics.routes.ts');
  const budgetWorkspace = read(root, 'src/components/Benefits/BudgetWorkspace.tsx');

  checks.push({
    name: 'Finance investment tab is a first-class kind and investment_case workflow',
    pass: includesAll(financeTypes, [
      "FinanceKind = 'models' | 'analysis' | 'investment' | 'prediction' | 'valuation'",
      "investment: { code: 'INV'",
    ]) && includesAll(financeHub, [
      "defaultAnalysisType={activeTab === 'investment' ? 'investment_case' : 'comprehensive'}",
      'Create a dedicated investment case with NPV, IRR, payback, and ROI metrics from this tab.',
    ]) && includesAll(financeData, [
      "kind: activeTab === 'investment' ? 'investment' : 'analysis'",
      "normalized === 'investment_case'",
    ]),
  });

  checks.push({
    name: 'Finance analysis service computes investment metrics',
    pass: includesAll(analysisService, [
      'function computeInvestmentRatios',
      "category: 'investment'",
      "code: 'npv'",
      "code: 'irr_pct'",
      "code: 'payback_periods'",
      "code: 'roi_pct'",
    ]),
  });

  checks.push({
    name: 'Valuation supports financial_model sources instead of branch blocker',
    pass:
      includesAll(valuationService, [
        'loadForecastFromFinancialModel(',
        'computeModel(modelId)',
        'persistComputeResult(modelId, recomputed, model.scenario || \'base\')',
        "sourceType: 'financial_model'",
      ]) &&
      !valuationService.includes('T054 source is not available in this branch; use Budget or Manual'),
  });

  checks.push({
    name: 'Budget document import parses extracted text instead of inserting hardcoded zeros',
    pass:
      includesAll(economicsRoutes, [
        'documentText is required',
        'Could not extract supported budget lines from the document.',
        'extractLineValue',
        'Capital Expenditure',
      ]) &&
      includesAll(budgetWorkspace, [
        'const documentText = await docImportFile.text()',
        "documentText,",
        "'Content-Type': 'application/json'",
      ]) &&
      !economicsRoutes.includes("{ code: 'revenue', name: 'Revenue', type: 'P&L', value: 0 }"),
  });

  const failed = checks.filter((check) => !check.pass);

  console.log('\n[smoke-v3-finance-gap-closure] Summary:');
  for (const check of checks) {
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((item) => item.name).join(', ')}`);
  }

  console.log('\n[smoke-v3-finance-gap-closure] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error(
    '[smoke-v3-finance-gap-closure] Failed:',
    (error as Error)?.message || error
  );
  process.exit(1);
}
