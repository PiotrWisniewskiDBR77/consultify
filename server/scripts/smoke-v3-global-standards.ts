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

  const commentsCanvas = read(root, 'src/components/shared/NModeSections/CommentsCanvas.tsx');
  const initiativeView = read(root, 'src/components/Initiatives/InitiativeDocumentView.tsx');
  const taskView = read(root, 'src/components/MyWork/TaskDetailView.tsx');
  const budgetWorkspace = read(root, 'src/components/Benefits/BudgetWorkspace.tsx');
  const analysisWorkspace = read(root, 'src/components/Benefits/FinancialAnalysisWorkspace.tsx');
  const valuationWorkspace = read(root, 'src/components/Benefits/ValuationWorkspace.tsx');

  checks.push({
    name: 'Comments canvas respects locked state and localized controls',
    pass: includesAll(commentsCanvas, [
      'if (locked) return;',
      'disabled={locked}',
      "'Dodaj komentarz'",
      "'Add comment'",
      "'Mniej'",
      "'More'",
    ]),
  });

  checks.push({
    name: 'Initiative and task views propagate locked read-only state to shared sections',
    pass:
      includesAll(initiativeView, [
        'locked={!canEditCards}',
        'readOnly={!canEditCards}',
      ]) &&
      includesAll(taskView, [
        '<CommentsCanvas',
        'locked={isDone}',
        '<AttachmentsLinksCanvas',
        'readOnly={isDone}',
      ]),
  });

  checks.push({
    name: 'Economics workspaces route user-facing strings through i18n',
    pass:
      includesAll(budgetWorkspace, [
        'useTranslation',
        't(',
        'finance.budget.createFailed',
      ]) &&
      includesAll(analysisWorkspace, [
        'useTranslation',
        't(',
        'finance.analysis.createFailed',
      ]) &&
      includesAll(valuationWorkspace, [
        'useTranslation',
        't(',
        'valuation.export.failed',
      ]),
  });

  const failed = checks.filter((check) => !check.pass);

  console.log('\n[smoke-v3-global-standards] Summary:');
  for (const check of checks) {
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((item) => item.name).join(', ')}`);
  }

  console.log('\n[smoke-v3-global-standards] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error('[smoke-v3-global-standards] Failed:', (error as Error)?.message || error);
  process.exit(1);
}
